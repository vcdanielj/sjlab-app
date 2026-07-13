// ============================================
// SJ Lab — Financial Summary API
// ============================================


import { eq, and, sql } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/finances/summary — Fetch accounts receivable, total client credits, and monthly collections
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // 1. Calculate active client balances to compute totalCxC and totalSurplus
    const orderStats = db
      .select({
        clientId: schema.orders.clientId,
        totalInvoiced: sql<number>`COALESCE(sum(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.finalPriceUsd} ELSE 0 END), 0)`.as('total_invoiced'),
      })
      .from(schema.orders)
      .groupBy(schema.orders.clientId)
      .as('orderStats');

    const paymentStats = db
      .select({
        clientId: schema.payments.clientId,
        totalPaid: sql<number>`COALESCE(sum(CASE WHEN ${schema.payments.status} = 'active' THEN ${schema.payments.amountUsd} ELSE 0 END), 0)`.as('total_paid'),
      })
      .from(schema.payments)
      .groupBy(schema.payments.clientId)
      .as('paymentStats');

    const clients = await db
      .select({
        totalInvoiced: sql<number>`COALESCE(${orderStats.totalInvoiced}, 0)`,
        totalPaid: sql<number>`COALESCE(${paymentStats.totalPaid}, 0)`,
      })
      .from(schema.users)
      .leftJoin(orderStats, eq(schema.users.id, orderStats.clientId))
      .leftJoin(paymentStats, eq(schema.users.id, paymentStats.clientId))
      .where(eq(schema.users.role, 'client'));

    let totalCxC = 0;
    let totalSurplus = 0;

    for (const c of clients) {
      const balance = Number(c.totalPaid) - Number(c.totalInvoiced);
      if (balance < -0.005) {
        totalCxC += Math.abs(balance);
      } else if (balance > 0.005) {
        totalSurplus += balance;
      }
    }

    // 2. Calculate monthly collections (payments registered this calendar month)
    const nowLocal = new Date();
    // Start of current month in local/Caracas alignment
    const startOfMonth = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), 1, 0, 0, 0);
    const startOfMonthTimestamp = Math.floor(startOfMonth.getTime() / 1000);

    const [monthlyColl] = await db
      .select({
        total: sql<number>`COALESCE(sum(${schema.payments.amountRealUsd}), 0)`,
      })
      .from(schema.payments)
      .where(
        and(
          eq(schema.payments.status, 'active'),
          sql`${schema.payments.paymentDate} >= ${startOfMonthTimestamp}`
        )
      );

    return Response.json({
      data: {
        totalCxC: Number(totalCxC.toFixed(2)),
        totalSurplus: Number(totalSurplus.toFixed(2)),
        monthlyCollections: Number(Number(monthlyColl?.total || 0).toFixed(2)),
      },
    });
  } catch (err) {
    console.error('Error in GET /api/finances/summary:', err);
    return Response.json({ error: 'Error interno al obtener resumen financiero' }, { status: 500 });
  }
}
