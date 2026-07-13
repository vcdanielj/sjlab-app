// ============================================
// SJ Lab — Order Status API
// ============================================


import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { now } from '@/lib/utils';
import { getSession } from '@/lib/session';
import { sendOrderReadyEmail } from '@/lib/email';
import {
  canMarkOrderAsCompleted,
  formatIncompleteOrderProsthesisJobs,
  getIncompleteOrderProsthesisJobs,
} from '@/lib/order-prosthesis';

// PATCH /api/orders/[id]/status — Change order status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status?: string };

    const validStatuses = ['completed', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return Response.json({ error: `Estado debe ser uno de: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const { env, ctx } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
    });

    if (!order) {
      return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const jobs = await db
      .select({
        id: schema.orderProsthesisJobs.id,
        patientName: schema.orderProsthesisJobs.patientName,
        status: schema.orderProsthesisJobs.status,
        productName: schema.products.name,
        categoryName: schema.categories.name,
      })
      .from(schema.orderProsthesisJobs)
      .innerJoin(schema.products, eq(schema.orderProsthesisJobs.productId, schema.products.id))
      .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
      .where(eq(schema.orderProsthesisJobs.orderId, id));

    if (status === 'completed' && jobs.length > 0) {
      if (!canMarkOrderAsCompleted(jobs)) {
        const incompleteJobs = getIncompleteOrderProsthesisJobs(jobs);
        return Response.json(
          {
            error: 'No se puede marcar el pedido como listo porque hay trabajos incompletos.',
            incompleteJobs: formatIncompleteOrderProsthesisJobs(incompleteJobs),
          },
          { status: 400 }
        );
      }
    }

    const timestamp = now();
    const updates: Partial<typeof schema.orders.$inferInsert> = {
      status: status as 'completed' | 'delivered' | 'cancelled',
    };

    if (status === 'completed') updates.completedAt = timestamp;
    if (status === 'delivered') updates.deliveredAt = timestamp;

    await db.update(schema.orders).set(updates).where(eq(schema.orders.id, id));

    if (status === 'completed') {
      ctx.waitUntil(sendOrderReadyEmail({ orderId: id, db }));
    }

    return Response.json({ data: { id, status } });
  } catch {
    return Response.json({ error: 'Error al cambiar estado' }, { status: 500 });
  }
}
