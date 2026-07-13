// ============================================
// SJ Lab — Expense Category Detail API
// ============================================

import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.color !== undefined) updates.color = body.color;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'Sin campos' }, { status: 400 });
    }

    await db.update(schema.expenseCategories).set(updates).where(eq(schema.expenseCategories.id, id));
    return Response.json({ data: { id } });
  } catch (error) {
    console.error('PUT /api/expense-categories/[id] error:', error);
    return Response.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await db.delete(schema.expenseCategories).where(eq(schema.expenseCategories.id, id));
    return Response.json({ data: { deleted: true } });
  } catch (error) {
    console.error('DELETE /api/expense-categories/[id] error:', error);
    return Response.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
