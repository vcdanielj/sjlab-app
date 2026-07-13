// ============================================
// SJ Lab — Portal Account API
// ============================================


import { eq, and, asc, sql } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/portal/account — Client's net balance and recent movements
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Financial summary
    const [orderTotals] = await db
      .select({
        totalInvoiced: sql<number>`COALESCE(SUM(${schema.orders.finalPriceUsd}), 0)`,
        orderCount: sql<number>`COUNT(*)`,
      })
      .from(schema.orders)
      .where(and(
        eq(schema.orders.clientId, session.id),
        sql`${schema.orders.status} != 'cancelled'`
      ));

    const [paymentTotals] = await db
      .select({
        totalPaid: sql<number>`COALESCE(SUM(${schema.payments.amountUsd}), 0)`,
        paymentCount: sql<number>`COUNT(*)`,
      })
      .from(schema.payments)
      .where(and(
        eq(schema.payments.clientId, session.id),
        eq(schema.payments.status, 'active')
      ));

    const totalInvoiced = Number(orderTotals.totalInvoiced);
    const totalPaid = Number(paymentTotals.totalPaid);
    const netBalance = totalPaid - totalInvoiced;

    // Build chronological movements (charges + credits)
    const orders = await db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        patientName: schema.orders.patientName,
        finalPriceUsd: schema.orders.finalPriceUsd,
        createdAt: schema.orders.createdAt,
        productName: schema.products.name,
      })
      .from(schema.orders)
      .leftJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .where(and(
        eq(schema.orders.clientId, session.id),
        sql`${schema.orders.status} != 'cancelled'`
      ))
      .orderBy(asc(schema.orders.createdAt));

    const payments = await db
      .select()
      .from(schema.payments)
      .where(and(
        eq(schema.payments.clientId, session.id),
        eq(schema.payments.status, 'active')
      ))
      .orderBy(asc(schema.payments.paymentDate));

    interface Movement {
      id: string;
      date: number;
      type: 'charge' | 'credit';
      concept: string;
      amount: number;
    }

    const movements: Movement[] = [];

    for (const order of orders) {
      movements.push({
        id: order.id,
        date: order.createdAt,
        type: 'charge',
        concept: `Pedido #${order.orderNumber} — ${order.patientName} (${order.productName || 'Producto'})`,
        amount: order.finalPriceUsd,
      });
    }

    for (const payment of payments) {
      const refLabel = payment.reference ? ` (Ref: ${payment.reference})` : '';
      movements.push({
        id: payment.id,
        date: payment.paymentDate,
        type: 'credit',
        concept: `Pago ${payment.currency} — ${payment.paymentMethod}${refLabel}`,
        amount: payment.amountUsd,
      });
    }

    // Sort chronologically (newest first for the UI)
    movements.sort((a, b) => b.date - a.date);

    return Response.json({
      data: {
        summary: {
          totalInvoiced,
          totalPaid,
          netBalance,
          orderCount: Number(orderTotals.orderCount),
          paymentCount: Number(paymentTotals.paymentCount),
        },
        movements,
      },
    });
  } catch {
    return Response.json({ error: 'Error al obtener cuenta' }, { status: 500 });
  }
}
