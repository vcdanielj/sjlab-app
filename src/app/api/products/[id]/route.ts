// ============================================
// SJ Lab — Product by ID API
// ============================================


import { eq, and } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// PUT /api/products/[id] — Edit product (workflow change only without active orders)
export async function PUT(
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
    const { name, categoryId, workflowId, details, suggestedPriceUsd, isActive } = body as {
      name?: string;
      categoryId?: string | null;
      workflowId?: string;
      details?: string | null;
      suggestedPriceUsd?: number;
      isActive?: boolean;
    };

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const existing = await db.query.products.findFirst({
      where: eq(schema.products.id, id),
    });

    if (!existing) {
      return Response.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // If changing workflow, check for active orders
    if (workflowId && workflowId !== existing.workflowId) {
      const activeOrders = await db
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(and(
          eq(schema.orders.productId, id),
          eq(schema.orders.status, 'active'),
        ))
        .limit(1);

      if (activeOrders.length > 0) {
        return Response.json(
          { error: 'No se puede cambiar el flujo de un producto con órdenes activas.' },
          { status: 409 }
        );
      }

      // Verify new workflow exists
      const workflow = await db.query.workflows.findFirst({
        where: eq(schema.workflows.id, workflowId),
      });
      if (!workflow) {
        return Response.json({ error: 'Flujo de trabajo no encontrado' }, { status: 404 });
      }
    }

    const updates: Partial<typeof schema.products.$inferInsert> = {};
    if (name?.trim()) updates.name = name.trim();
    if (categoryId !== undefined) updates.categoryId = categoryId;
    if (workflowId) updates.workflowId = workflowId;
    if (details !== undefined) updates.details = details?.trim() || null;
    if (typeof suggestedPriceUsd === 'number') updates.suggestedPriceUsd = suggestedPriceUsd;
    if (typeof isActive === 'boolean') updates.isActive = isActive;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No hay cambios' }, { status: 400 });
    }

    await db.update(schema.products).set(updates).where(eq(schema.products.id, id));

    const updated = await db.query.products.findFirst({
      where: eq(schema.products.id, id),
      with: {
        category: true,
        workflow: true,
      },
    });

    return Response.json({ data: updated });
  } catch {
    return Response.json({ error: 'Error al actualizar producto' }, { status: 500 });
  }
}

// DELETE /api/products/[id] — Soft-delete (set isActive = false)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const existing = await db.query.products.findFirst({
      where: eq(schema.products.id, id),
    });

    if (!existing) {
      return Response.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    await db
      .update(schema.products)
      .set({ isActive: false })
      .where(eq(schema.products.id, id));

    return Response.json({ data: { id, deleted: true } });
  } catch {
    return Response.json({ error: 'Error al eliminar producto' }, { status: 500 });
  }
}
