// ============================================
// SJ Lab — Dashboard Production API
// ============================================


import { sql, and, gte, lte, eq, ne } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/dashboard/production?from=X&to=Y
// Returns order count distribution by workflow (for donut chart)
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const from = Number(url.searchParams.get('from') || 0);
    const to = Number(url.searchParams.get('to') || Math.floor(Date.now() / 1000));

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const rows = await db
      .select({
        workflowId: schema.products.workflowId,
        workflowName: schema.workflows.name,
        count: sql<number>`COUNT(${schema.orders.id})`,
      })
      .from(schema.orders)
      .innerJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .innerJoin(schema.workflows, eq(schema.products.workflowId, schema.workflows.id))
      .where(and(
        gte(schema.orders.createdAt, from),
        lte(schema.orders.createdAt, to),
        ne(schema.orders.status, 'cancelled')
      ))
      .groupBy(schema.products.workflowId, schema.workflows.name);

    const data = rows.map((r) => ({
      name: r.workflowName,
      value: r.count,
    }));

    return Response.json({ data });
  } catch (err) {
    console.error('Error in GET /api/dashboard/production:', err);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
