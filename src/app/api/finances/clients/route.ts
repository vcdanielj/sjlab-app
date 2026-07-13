// ============================================
// SJ Lab — Financial Clients list API
// ============================================


import { eq, and, sql, asc } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/finances/clients — List client balances with search and balance status filters
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const balanceStatus = url.searchParams.get('balanceStatus') || 'all'; // cxc, surplus, zero, all
    const sortBy = url.searchParams.get('sortBy') || 'name';
    const sortOrder = url.searchParams.get('sortOrder') || 'asc';

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const conditions = [eq(schema.users.role, 'client')];

    if (search) {
      conditions.push(
        sql`(${schema.users.name} LIKE ${'%' + search + '%'} OR ${schema.users.clinicName} LIKE ${'%' + search + '%'})`
      );
    }

    // Sub-aggregations for order stats (avoid correlated subqueries — Drizzle parametrizes column refs)
    const orderStats = db
      .select({
        clientId: schema.orders.clientId,
        activeOrders: sql<number>`count(CASE WHEN ${schema.orders.status} = 'active' THEN 1 END)`.as('active_orders'),
        totalInvoiced: sql<number>`COALESCE(sum(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.finalPriceUsd} ELSE 0 END), 0)`.as('total_invoiced'),
      })
      .from(schema.orders)
      .groupBy(schema.orders.clientId)
      .as('orderStats');

    // Sub-aggregation for payment stats
    const paymentStats = db
      .select({
        clientId: schema.payments.clientId,
        totalPaid: sql<number>`COALESCE(sum(CASE WHEN ${schema.payments.status} = 'active' THEN ${schema.payments.amountUsd} ELSE 0 END), 0)`.as('total_paid'),
        lastPaymentDate: sql<number | null>`max(CASE WHEN ${schema.payments.status} = 'active' THEN ${schema.payments.paymentDate} END)`.as('last_payment_date'),
      })
      .from(schema.payments)
      .groupBy(schema.payments.clientId)
      .as('paymentStats');

    const clients = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        clinicName: schema.users.clinicName,
        isActive: schema.users.isActive,
        activeOrders: sql<number>`COALESCE(${orderStats.activeOrders}, 0)`,
        totalInvoiced: sql<number>`COALESCE(${orderStats.totalInvoiced}, 0)`,
        totalPaid: sql<number>`COALESCE(${paymentStats.totalPaid}, 0)`,
        lastPaymentDate: paymentStats.lastPaymentDate,
      })
      .from(schema.users)
      .leftJoin(orderStats, eq(schema.users.id, orderStats.clientId))
      .leftJoin(paymentStats, eq(schema.users.id, paymentStats.clientId))
      .where(and(...conditions))
      .orderBy(asc(schema.users.name));

    // Map and enrich with balance status
    let enriched = clients.map((c) => {
      const invoiced = Number(c.totalInvoiced);
      const paid = Number(c.totalPaid);
      return {
        id: c.id,
        name: c.name,
        clinicName: c.clinicName,
        isActive: c.isActive,
        activeOrders: Number(c.activeOrders),
        totalInvoiced: invoiced,
        totalPaid: paid,
        balance: Number((paid - invoiced).toFixed(2)),
        lastPaymentDate: c.lastPaymentDate,
      };
    });

    // Filter based on client balance status
    if (balanceStatus === 'cxc') {
      enriched = enriched.filter((c) => c.balance < -0.005);
    } else if (balanceStatus === 'surplus') {
      enriched = enriched.filter((c) => c.balance > 0.005);
    } else if (balanceStatus === 'zero') {
      enriched = enriched.filter((c) => Math.abs(c.balance) <= 0.005);
    }

    // Sort enriched array
    enriched.sort((a, b) => {
      let valA: any = a[sortBy as keyof typeof a];
      let valB: any = b[sortBy as keyof typeof b];

      // Special cases
      if (sortBy === 'progress') {
        const pctA = a.totalInvoiced > 0 ? (a.totalPaid / a.totalInvoiced) : 0;
        const pctB = b.totalInvoiced > 0 ? (b.totalPaid / b.totalInvoiced) : 0;
        valA = pctA;
        valB = pctB;
      }

      if (valA === null || valA === undefined) return sortOrder === 'asc' ? 1 : -1;
      if (valB === null || valB === undefined) return sortOrder === 'asc' ? -1 : 1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return sortOrder === 'asc'
        ? (valA > valB ? 1 : valA < valB ? -1 : 0)
        : (valB > valA ? 1 : valB < valA ? -1 : 0);
    });

    return Response.json({ data: enriched });
  } catch (err) {
    console.error('Error in GET /api/finances/clients:', err);
    return Response.json({ error: 'Error interno al obtener saldos de clientes' }, { status: 500 });
  }
}
