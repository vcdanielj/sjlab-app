// ============================================
// SJ Lab — Payment Allocations list API
// ============================================


import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/payments/[id]/allocations — Get allocations (order distributions) for a payment
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Get all allocations for this payment along with order number and patient name
    const allocations = await db
      .select({
        id: schema.paymentAllocations.id,
        amountUsd: schema.paymentAllocations.amountUsd,
        createdAt: schema.paymentAllocations.createdAt,
        orderId: schema.paymentAllocations.orderId,
        orderNumber: schema.orders.orderNumber,
        patientName: schema.orders.patientName,
      })
      .from(schema.paymentAllocations)
      .innerJoin(
        schema.orders,
        eq(schema.paymentAllocations.orderId, schema.orders.id)
      )
      .where(eq(schema.paymentAllocations.paymentId, id));

    return Response.json({ data: allocations });
  } catch (err) {
    console.error('Error in GET /api/payments/[id]/allocations:', err);
    return Response.json({ error: 'Error interno al obtener las amortizaciones del pago' }, { status: 500 });
  }
}
