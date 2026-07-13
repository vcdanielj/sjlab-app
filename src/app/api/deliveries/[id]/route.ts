import { and, eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'tech')) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const delivery = await db.query.deliveries.findFirst({
      where: eq(schema.deliveries.id, id),
    });

    if (!delivery) {
      return Response.json({ error: 'Delivery no encontrado' }, { status: 404 });
    }

    if (delivery.status === 'completed') {
      return Response.json(
        { error: 'No se puede eliminar un delivery completado porque ya impacta la contabilidad.' },
        { status: 409 }
      );
    }

    const paymentReference = `DELIVERY-${id}`;
    const relatedPayment = await db.query.deliveryPayments.findFirst({
      where: eq(schema.deliveryPayments.reference, paymentReference),
    });

    if (relatedPayment) {
      return Response.json(
        { error: 'No se puede eliminar un delivery con pagos registrados.' },
        { status: 409 }
      );
    }

    await db.delete(schema.deliveries).where(and(eq(schema.deliveries.id, id)));

    return Response.json({ data: { id, deleted: true } });
  } catch (error) {
    console.error('DELETE /api/deliveries/[id] error:', error);
    return Response.json({ error: 'Error al eliminar delivery' }, { status: 500 });
  }
}
