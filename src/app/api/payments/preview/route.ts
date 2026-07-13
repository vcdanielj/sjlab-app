// ============================================
// SJ Lab — Payment Allocation Preview API
// ============================================


import { eq, and, asc, sql } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/payments/preview?clientId=X&amountUsd=Y — Dry-run preview of FIFO allocation
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const clientId = url.searchParams.get('clientId');
    const amountUsdStr = url.searchParams.get('amountUsd');

    if (!clientId) {
      return Response.json({ error: 'El parámetro clientId es requerido' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Verify client exists
    const client = await db.query.users.findFirst({
      where: and(
        eq(schema.users.id, clientId),
        eq(schema.users.role, 'client')
      ),
    });

    if (!client) {
      return Response.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const amountUsd = amountUsdStr ? Number(amountUsdStr) : 0;

    // Fetch all pending orders for manual selection UI
    const pendingOrders = await db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.clientId, clientId),
          sql`${schema.orders.amountPaidUsd} < ${schema.orders.finalPriceUsd}`,
          sql`${schema.orders.status} != 'cancelled'`
        )
      )
      .orderBy(asc(schema.orders.createdAt));

    interface PreviewAllocation {
      orderId: string;
      orderNumber: number;
      patientName: string;
      finalPriceUsd: number;
      amountPaidUsd: number;
      allocatedAmountUsd: number;
    }

    const result = {
      allocations: [] as PreviewAllocation[],
      surplusUsd: amountUsd,
      pendingOrders: pendingOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        patientName: o.patientName,
        finalPriceUsd: o.finalPriceUsd,
        amountPaidUsd: o.amountPaidUsd,
      }))
    };

    if (amountUsd > 0) {
      let availableBalance = amountUsd;
      for (const order of pendingOrders) {
        if (availableBalance <= 0) break;
        const remaining = order.finalPriceUsd - order.amountPaidUsd;
        const allocated = Math.min(remaining, availableBalance);
        if (allocated > 0.005) {
          result.allocations.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            patientName: order.patientName,
            finalPriceUsd: order.finalPriceUsd,
            amountPaidUsd: order.amountPaidUsd,
            allocatedAmountUsd: Number(allocated.toFixed(2)),
          });
          availableBalance -= allocated;
        }
      }
      result.surplusUsd = Number(availableBalance.toFixed(2));
    }

    return Response.json({ data: result });
  } catch (err) {
    console.error('Error in GET /api/payments/preview:', err);
    return Response.json({ error: 'Error interno al generar la previsualización' }, { status: 500 });
  }
}
