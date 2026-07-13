// ============================================
// SJ Lab — Dashboard Top Clients API
// ============================================


import { sql, and, gte, lte, eq, ne } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/dashboard/top-clients?from=X&to=Y
// Returns top 5 clients by invoiced amount in the period
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
        clientId: schema.orders.clientId,
        clientName: schema.users.name,
        total: sql<number>`COALESCE(SUM(${schema.orders.finalPriceUsd}), 0)`,
        orderCount: sql<number>`COUNT(${schema.orders.id})`,
      })
      .from(schema.orders)
      .innerJoin(schema.users, eq(schema.orders.clientId, schema.users.id))
      .where(and(
        gte(schema.orders.createdAt, from),
        lte(schema.orders.createdAt, to),
        ne(schema.orders.status, 'cancelled')
      ))
      .groupBy(schema.orders.clientId, schema.users.name)
      .orderBy(sql`SUM(${schema.orders.finalPriceUsd}) DESC`)
      .limit(5);

    const data = rows.map((r) => ({
      name: r.clientName,
      total: Number(r.total.toFixed(2)),
      orders: r.orderCount,
    }));

    return Response.json({ data });
  } catch (err) {
    console.error('Error in GET /api/dashboard/top-clients:', err);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
