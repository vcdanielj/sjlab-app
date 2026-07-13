// ============================================
// SJ Lab — Expense Categories API (CRUD)
// ============================================

import { desc, eq, asc } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const data = await db
      .select()
      .from(schema.expenseCategories)
      .orderBy(asc(schema.expenseCategories.sortOrder));

    return Response.json({ data });
  } catch (error) {
    console.error('GET /api/expense-categories error:', error);
    return Response.json({ error: 'Error al obtener categorías' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const body = await request.json();
    const { name, color } = body;

    if (!name?.trim()) {
      return Response.json({ error: 'Nombre requerido' }, { status: 400 });
    }

    // Get max sort order
    const existing = await db.select().from(schema.expenseCategories).orderBy(desc(schema.expenseCategories.sortOrder)).limit(1);
    const nextOrder = (existing[0]?.sortOrder ?? 0) + 1;

    const id = crypto.randomUUID();
    await db.insert(schema.expenseCategories).values({
      id,
      name: name.trim(),
      color: color || '#6B7280',
      sortOrder: nextOrder,
      isActive: true,
    });

    return Response.json({ data: { id } }, { status: 201 });
  } catch (error) {
    console.error('POST /api/expense-categories error:', error);
    return Response.json({ error: 'Error al crear categoría' }, { status: 500 });
  }
}
