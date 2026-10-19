// ============================================
// SJ Lab — Void Unidentified Payment API
// ============================================

import { eq, and } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { now } from '@/lib/utils';

// PATCH /api/treasury/unidentified/[id]/void — Void a pending unidentified payment
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

    const record = await db.query.unidentifiedPayments.findFirst({
      where: eq(schema.unidentifiedPayments.id, id),
    });

    if (!record) {
      return Response.json({ error: 'Pago por conciliar no encontrado' }, { status: 404 });
    }
    if (record.status !== 'pending') {
      return Response.json(
        { error: record.status === 'reconciled' ? 'Este pago ya fue conciliado; anula el pago del cliente' : 'Este pago ya fue anulado' },
        { status: 409 }
      );
    }

    await db
      .update(schema.unidentifiedPayments)
      .set({ status: 'voided', voidedAt: now() })
      .where(and(eq(schema.unidentifiedPayments.id, id), eq(schema.unidentifiedPayments.status, 'pending')));

    return Response.json({ data: { id, status: 'voided' } });
  } catch (error) {
    console.error('PATCH /api/treasury/unidentified/[id]/void error:', error);
    return Response.json({ error: 'Error al anular el pago por conciliar' }, { status: 500 });
  }
}
