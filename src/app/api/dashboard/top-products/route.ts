// ============================================
// SJ Lab — Dashboard Top Products API
// ============================================

import { sql, and, gte, lte, ne, eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/dashboard/top-products?from=X&to=Y
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
        productId: schema.orders.productId,
        name: schema.products.name,
        total: sql<number>`COALESCE(SUM(${schema.orders.finalPriceUsd}), 0)`,
        orderCount: sql<number>`COUNT(${schema.orders.id})`,
      })
      .from(schema.orders)
      .innerJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .where(and(
        gte(schema.orders.createdAt, from),
        lte(schema.orders.createdAt, to),
        ne(schema.orders.status, 'cancelled')
      ))
      .groupBy(schema.orders.productId, schema.products.name)
      .orderBy(sql`SUM(${schema.orders.finalPriceUsd}) DESC`)
      .limit(5);

    const data = rows.map((r) => ({
      name: r.name,
      total: Number(r.total.toFixed(2)),
      orders: Number(r.orderCount),
    }));

    return Response.json({ data });
  } catch (err) {
    console.error('Error in GET /api/dashboard/top-products:', err);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
