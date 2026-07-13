// ============================================
// SJ Lab — Dashboard Activity API
// ============================================


import { sql, desc, eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/dashboard/activity
// Returns the last 10 actions (step moves, payments, new orders)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Get recent step movements
    const recentMoves = await db
      .select({
        id: schema.orderStepHistory.id,
        timestamp: schema.orderStepHistory.movedAt,
        userName: schema.users.name,
        orderNumber: schema.orders.orderNumber,
        fromStepName: sql<string>`fs.name`,
        toStepName: sql<string>`ts.name`,
      })
      .from(schema.orderStepHistory)
      .innerJoin(schema.users, eq(schema.orderStepHistory.movedBy, schema.users.id))
      .innerJoin(schema.orders, eq(schema.orderStepHistory.orderId, schema.orders.id))
      .innerJoin(
        sql`workflow_steps AS ts`,
        sql`ts.id = ${schema.orderStepHistory.toStepId}`
      )
      .leftJoin(
        sql`workflow_steps AS fs`,
        sql`fs.id = ${schema.orderStepHistory.fromStepId}`
      )
      .orderBy(desc(schema.orderStepHistory.movedAt))
      .limit(5);

    // Get recent payments
    const recentPayments = await db
      .select({
        id: schema.payments.id,
        timestamp: schema.payments.createdAt,
        clientName: schema.users.name,
        amountRealUsd: schema.payments.amountRealUsd,
        currency: schema.payments.currency,
        paymentMethod: schema.payments.paymentMethod,
      })
      .from(schema.payments)
      .innerJoin(schema.users, eq(schema.payments.clientId, schema.users.id))
      .where(eq(schema.payments.status, 'active'))
      .orderBy(desc(schema.payments.createdAt))
      .limit(5);

    // Get recent orders
    const recentOrders = await db
      .select({
        id: schema.orders.id,
        timestamp: schema.orders.createdAt,
        clientName: schema.users.name,
        orderNumber: schema.orders.orderNumber,
        patientName: schema.orders.patientName,
      })
      .from(schema.orders)
      .innerJoin(schema.users, eq(schema.orders.clientId, schema.users.id))
      .orderBy(desc(schema.orders.createdAt))
      .limit(5);

    const orderIds = recentOrders.map((order) => order.id);
    const jobCounts = orderIds.length === 0
      ? []
      : await db
          .select({
            orderId: schema.orderProsthesisJobs.orderId,
            count: sql<number>`count(*)`,
          })
          .from(schema.orderProsthesisJobs)
          .where(sql`${schema.orderProsthesisJobs.orderId} IN (${sql.join(orderIds.map((id) => sql`${id}`), sql`, `)})`)
          .groupBy(schema.orderProsthesisJobs.orderId);

    const jobCountMap = new Map(jobCounts.map((item) => [item.orderId, item.count]));

    // Merge and sort all activities
    interface Activity {
      id: string;
      type: 'move' | 'payment' | 'order';
      timestamp: number;
      description: string;
      actor: string;
    }

    const activities: Activity[] = [];

    for (const m of recentMoves) {
      const fromLabel = m.fromStepName || 'Inicio';
      activities.push({
        id: m.id,
        type: 'move',
        timestamp: m.timestamp,
        description: `Pedido #${m.orderNumber}: ${fromLabel} → ${m.toStepName}`,
        actor: m.userName,
      });
    }

    for (const p of recentPayments) {
      activities.push({
        id: p.id,
        type: 'payment',
        timestamp: p.timestamp,
        description: `Pago $${p.amountRealUsd.toFixed(2)} (${p.currency} — ${p.paymentMethod})`,
        actor: p.clientName,
      });
    }

    for (const o of recentOrders) {
      const jobsCount = jobCountMap.get(o.id) || 1;
      activities.push({
        id: o.id,
        type: 'order',
        timestamp: o.timestamp,
        description: `Nuevo pedido #${o.orderNumber} — ${o.patientName} (${jobsCount} trabajo${jobsCount !== 1 ? 's' : ''})`,
        actor: o.clientName,
      });
    }

    // Sort by timestamp descending, take 10
    activities.sort((a, b) => b.timestamp - a.timestamp);
    const data = activities.slice(0, 10);

    return Response.json({ data });
  } catch (err) {
    console.error('Error in GET /api/dashboard/activity:', err);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
