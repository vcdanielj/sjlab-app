// ============================================
// SJ Lab — Workflow Step by ID API
// ============================================


import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// PUT /api/workflows/[id]/steps/[stepId] — Edit step name or toggle active
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { stepId } = await params;
    const body = await request.json();
    const { name, isActive } = body as { name?: string; isActive?: boolean };

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Verify step exists
    const existing = await db.query.workflowSteps.findFirst({
      where: eq(schema.workflowSteps.id, stepId),
    });

    if (!existing) {
      return Response.json({ error: 'Paso no encontrado' }, { status: 404 });
    }

    const updates: Partial<typeof schema.workflowSteps.$inferInsert> = {};
    if (name?.trim()) updates.name = name.trim();
    if (typeof isActive === 'boolean') updates.isActive = isActive;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No hay cambios' }, { status: 400 });
    }

    // If deactivating, check for active orders on this step
    if (isActive === false) {
      const ordersOnStep = await db
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(eq(schema.orders.currentStepId, stepId))
        .limit(1);

      if (ordersOnStep.length > 0) {
        return Response.json(
          { error: 'No se puede desactivar un paso con órdenes activas. Mueva las órdenes primero.' },
          { status: 409 }
        );
      }
    }

    await db
      .update(schema.workflowSteps)
      .set(updates)
      .where(eq(schema.workflowSteps.id, stepId));

    const updated = await db.query.workflowSteps.findFirst({
      where: eq(schema.workflowSteps.id, stepId),
    });

    return Response.json({ data: updated });
  } catch {
    return Response.json({ error: 'Error al actualizar paso' }, { status: 500 });
  }
}
