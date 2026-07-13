// ============================================
// SJ Lab — Order Step Movement API
// ============================================


import { eq, and, asc } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { generateId, now } from '@/lib/utils';
import { getSession } from '@/lib/session';

// PATCH /api/orders/[id]/step — Move order to a different step
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { toStepId } = body as { toStepId?: string };

    if (!toStepId) {
      return Response.json({ error: 'toStepId es requerido' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Get order
    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
    });

    if (!order) {
      return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    if (order.status !== 'active') {
      return Response.json({ error: 'Solo se pueden mover pedidos activos' }, { status: 400 });
    }

    // Verify target step exists and belongs to the same workflow
    const toStep = await db.query.workflowSteps.findFirst({
      where: eq(schema.workflowSteps.id, toStepId),
    });

    if (!toStep) {
      return Response.json({ error: 'Paso destino no encontrado' }, { status: 404 });
    }

    const fromStepId = order.currentStepId;
    const timestamp = now();

    // Update order
    await db
      .update(schema.orders)
      .set({ currentStepId: toStepId })
      .where(eq(schema.orders.id, id));

    // Record step history
    await db.insert(schema.orderStepHistory).values({
      id: generateId(),
      orderId: id,
      fromStepId,
      toStepId,
      movedBy: session.id,
      movedAt: timestamp,
    });

    return Response.json({
      data: { id, currentStepId: toStepId },
    });
  } catch {
    return Response.json({ error: 'Error al mover pedido' }, { status: 500 });
  }
}
