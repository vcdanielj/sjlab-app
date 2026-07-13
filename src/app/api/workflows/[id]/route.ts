// ============================================
// SJ Lab — Workflow by ID API
// ============================================


import { eq, asc, and } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/workflows/[id] — Get single workflow with steps
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const workflow = await db.query.workflows.findFirst({
      where: eq(schema.workflows.id, id),
      with: {
        steps: {
          orderBy: [asc(schema.workflowSteps.sortOrder)],
        },
      },
    });

    if (!workflow) {
      return Response.json({ error: 'Flujo no encontrado' }, { status: 404 });
    }

    return Response.json({ data: workflow });
  } catch {
    return Response.json({ error: 'Error al obtener flujo' }, { status: 500 });
  }
}

// PUT /api/workflows/[id] — Edit workflow name
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
    const { name, isActive } = body as { name?: string; isActive?: boolean };

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Check workflow exists
    const existing = await db.query.workflows.findFirst({
      where: eq(schema.workflows.id, id),
    });

    if (!existing) {
      return Response.json({ error: 'Flujo no encontrado' }, { status: 404 });
    }

    const updates: Partial<typeof schema.workflows.$inferInsert> = {};
    if (name?.trim()) updates.name = name.trim();
    if (typeof isActive === 'boolean') updates.isActive = isActive;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No hay cambios' }, { status: 400 });
    }

    await db.update(schema.workflows).set(updates).where(eq(schema.workflows.id, id));

    const updated = await db.query.workflows.findFirst({
      where: eq(schema.workflows.id, id),
      with: {
        steps: {
          orderBy: [asc(schema.workflowSteps.sortOrder)],
        },
      },
    });

    return Response.json({ data: updated });
  } catch {
    return Response.json({ error: 'Error al actualizar flujo' }, { status: 500 });
  }
}

// DELETE /api/workflows/[id] — Delete only if no products with active orders
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

    // Check if workflow has products
    const productsWithWorkflow = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(and(
        eq(schema.products.workflowId, id),
        eq(schema.products.isActive, true),
      ))
      .limit(1);

    if (productsWithWorkflow.length > 0) {
      return Response.json(
        { error: 'No se puede eliminar un flujo con productos activos. Desactive los productos primero.' },
        { status: 409 }
      );
    }

    // Check for active orders on products of this workflow
    const activeOrders = await db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .innerJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .where(and(
        eq(schema.products.workflowId, id),
        eq(schema.orders.status, 'active'),
      ))
      .limit(1);

    if (activeOrders.length > 0) {
      return Response.json(
        { error: 'No se puede eliminar un flujo con órdenes activas.' },
        { status: 409 }
      );
    }

    // Soft-delete: deactivate instead of physical delete
    await db.update(schema.workflows).set({ isActive: false }).where(eq(schema.workflows.id, id));

    return Response.json({ data: { id, deleted: true } });
  } catch {
    return Response.json({ error: 'Error al eliminar flujo' }, { status: 500 });
  }
}
