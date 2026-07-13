import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { eq } from 'drizzle-orm';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'delivery') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { amount } = body;

    if (!amount || typeof amount !== 'number') {
      return Response.json({ error: 'Monto inválido' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const delivery = await db.query.deliveries.findFirst({
      where: eq(schema.deliveries.id, id),
    });

    if (!delivery) {
      return Response.json({ error: 'Delivery no encontrado' }, { status: 404 });
    }

    if (delivery.status !== 'pending') {
      return Response.json({ error: 'El servicio ya no está pendiente' }, { status: 400 });
    }

    await db.update(schema.deliveries)
      .set({
        status: 'proposed',
        proposedAmountUsd: amount,
        deliveryUserId: session.id,
      })
      .where(eq(schema.deliveries.id, id));

    return Response.json({ success: true });
  } catch (error) {
    console.error('POST /api/deliveries/[id]/propose error:', error);
    return Response.json({ error: 'Error al enviar propuesta' }, { status: 500 });
  }
}
