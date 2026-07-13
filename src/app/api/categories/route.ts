// ============================================
// SJ Lab — Categories API
// ============================================


import { eq, asc, max } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { generateId } from '@/lib/utils';
import { getSession } from '@/lib/session';

// GET /api/categories — List all categories
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const categories = await db
      .select()
      .from(schema.categories)
      .orderBy(asc(schema.categories.sortOrder));

    return Response.json({ data: categories });
  } catch {
    return Response.json({ error: 'Error al obtener categorías' }, { status: 500 });
  }
}

// POST /api/categories — Create a new category
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name?.trim()) {
      return Response.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Get next sort order
    const [maxOrder] = await db
      .select({ maxSort: max(schema.categories.sortOrder) })
      .from(schema.categories);

    const id = generateId();
    await db.insert(schema.categories).values({
      id,
      name: name.trim(),
      sortOrder: (maxOrder?.maxSort ?? 0) + 1,
    });

    const created = await db.query.categories.findFirst({
      where: eq(schema.categories.id, id),
    });

    return Response.json({ data: created }, { status: 201 });
  } catch {
    return Response.json({ error: 'Error al crear categoría' }, { status: 500 });
  }
}
