// ============================================
// SJ Lab — Category by ID API
// ============================================


import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// PUT /api/categories/[id] — Rename category
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
    const { name } = body as { name?: string };

    if (!name?.trim()) {
      return Response.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const existing = await db.query.categories.findFirst({
      where: eq(schema.categories.id, id),
    });

    if (!existing) {
      return Response.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    await db
      .update(schema.categories)
      .set({ name: name.trim() })
      .where(eq(schema.categories.id, id));

    return Response.json({ data: { ...existing, name: name.trim() } });
  } catch {
    return Response.json({ error: 'Error al actualizar categoría' }, { status: 500 });
  }
}

// DELETE /api/categories/[id] — Delete only if no products
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

    // Check for products in this category
    const productsInCategory = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.categoryId, id))
      .limit(1);

    if (productsInCategory.length > 0) {
      return Response.json(
        { error: 'No se puede eliminar una categoría con productos. Mueva o elimine los productos primero.' },
        { status: 409 }
      );
    }

    await db.delete(schema.categories).where(eq(schema.categories.id, id));

    return Response.json({ data: { id, deleted: true } });
  } catch {
    return Response.json({ error: 'Error al eliminar categoría' }, { status: 500 });
  }
}
