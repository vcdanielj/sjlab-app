// ============================================
// SJ Lab — Products API
// ============================================


import { eq, asc } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { generateId, now } from '@/lib/utils';
import { getSession } from '@/lib/session';

// GET /api/products — List products (with category and workflow)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const products = await db.query.products.findMany({
      with: {
        category: true,
        workflow: true,
      },
      orderBy: [asc(schema.products.createdAt)],
    });

    // Group by category for the UI
    const categories = await db
      .select()
      .from(schema.categories)
      .orderBy(asc(schema.categories.sortOrder));

    const grouped = categories.map((cat) => ({
      ...cat,
      products: products.filter((p) => p.categoryId === cat.id),
    }));

    // Add uncategorized products
    const uncategorized = products.filter((p) => !p.categoryId);
    if (uncategorized.length > 0) {
      grouped.push({
        id: 'uncategorized',
        name: 'Sin Categoría',
        sortOrder: 999,
        products: uncategorized,
      });
    }

    return Response.json({ data: grouped });
  } catch {
    return Response.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}

// POST /api/products — Create a new product
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, categoryId, workflowId, details, suggestedPriceUsd } = body as {
      name?: string;
      categoryId?: string;
      workflowId?: string;
      details?: string;
      suggestedPriceUsd?: number;
    };

    if (!name?.trim()) {
      return Response.json({ error: 'El nombre es requerido' }, { status: 400 });
    }
    if (!workflowId) {
      return Response.json({ error: 'El flujo de trabajo es requerido' }, { status: 400 });
    }
    if (typeof suggestedPriceUsd !== 'number' || suggestedPriceUsd < 0) {
      return Response.json({ error: 'El precio sugerido debe ser un número positivo' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Verify workflow exists
    const workflow = await db.query.workflows.findFirst({
      where: eq(schema.workflows.id, workflowId),
    });
    if (!workflow) {
      return Response.json({ error: 'Flujo de trabajo no encontrado' }, { status: 404 });
    }

    // Verify category exists if provided
    if (categoryId) {
      const category = await db.query.categories.findFirst({
        where: eq(schema.categories.id, categoryId),
      });
      if (!category) {
        return Response.json({ error: 'Categoría no encontrada' }, { status: 404 });
      }
    }

    const id = generateId();
    const timestamp = now();

    await db.insert(schema.products).values({
      id,
      name: name.trim(),
      categoryId: categoryId || null,
      workflowId,
      details: details?.trim() || null,
      suggestedPriceUsd,
      isActive: true,
      createdAt: timestamp,
    });

    const created = await db.query.products.findFirst({
      where: eq(schema.products.id, id),
      with: {
        category: true,
        workflow: true,
      },
    });

    return Response.json({ data: created }, { status: 201 });
  } catch {
    return Response.json({ error: 'Error al crear producto' }, { status: 500 });
  }
}
