// ============================================
// SJ Lab — Void Payment API
// ============================================


import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { voidPayment } from '@/lib/fifo';

// PATCH /api/payments/[id]/void — Void a registered payment
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const payment = await db.query.payments.findFirst({
      where: eq(schema.payments.id, id),
    });

    if (!payment) {
      return Response.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    if (payment.status === 'voided') {
      return Response.json({ error: 'Este pago ya ha sido anulado' }, { status: 400 });
    }

    // Run inside database — try transaction first, fallback to sequential
    try {
      await db.transaction(async (tx) => {
        await voidPayment(tx, id);
      });
    } catch (txError) {
      console.error('Void transaction failed, falling back:', txError);
      await voidPayment(db, id);
    }

    return Response.json({
      data: {
        id,
        status: 'voided',
      },
    });
  } catch (err) {
    console.error('Error voiding payment:', err);
    const message = err instanceof Error ? err.message : 'Error interno al anular el pago';
    return Response.json({ error: message }, { status: 500 });
  }
}
