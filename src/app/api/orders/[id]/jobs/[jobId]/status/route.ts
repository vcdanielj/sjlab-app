import { and, eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { now } from '@/lib/utils';
import { getSession } from '@/lib/session';
import { buildOrderProgressSummary } from '@/lib/order-prosthesis';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, jobId } = await params;
    const body = await request.json();
    const { status } = body as { status?: string };

    if (!status || !['pending', 'completed'].includes(status)) {
      return Response.json({ error: 'Estado inválido para el trabajo de prótesis' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const existingJob = await db.query.orderProsthesisJobs.findFirst({
      where: and(
        eq(schema.orderProsthesisJobs.id, jobId),
        eq(schema.orderProsthesisJobs.orderId, id)
      ),
    });

    if (!existingJob) {
      return Response.json({ error: 'Trabajo de prótesis no encontrado' }, { status: 404 });
    }

    const completedAt = status === 'completed' ? now() : null;

    await db
      .update(schema.orderProsthesisJobs)
      .set({
        status: status as 'pending' | 'completed',
        completedAt,
      })
      .where(eq(schema.orderProsthesisJobs.id, jobId));

    const jobs = await db
      .select({
        id: schema.orderProsthesisJobs.id,
        patientName: schema.orderProsthesisJobs.patientName,
        status: schema.orderProsthesisJobs.status,
      })
      .from(schema.orderProsthesisJobs)
      .where(eq(schema.orderProsthesisJobs.orderId, id));

    return Response.json({
      data: {
        id: jobId,
        status,
        progress: buildOrderProgressSummary(
          jobs.map((job) => ({
            id: job.id,
            patientName: job.patientName,
            status: job.status,
          }))
        ),
      },
    });
  } catch (error) {
    console.error('PATCH /api/orders/[id]/jobs/[jobId]/status error:', error);
    return Response.json({ error: 'Error al actualizar trabajo de prótesis' }, { status: 500 });
  }
}
