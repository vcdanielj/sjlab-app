// ============================================
// SJ Lab — Unidentified Payments API (Pagos por Conciliar)
// ============================================

import { eq, desc, inArray } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { generateId, now } from '@/lib/utils';
import { PAYMENT_METHODS_BY_CURRENCY } from '@/lib/constants';

// GET /api/treasury/unidentified?status=pending|reconciled|voided|all — List unidentified payments
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const rows = await db
      .select({
        id: schema.unidentifiedPayments.id,
        currency: schema.unidentifiedPayments.currency,
        amount: schema.unidentifiedPayments.amount,
        paymentMethod: schema.unidentifiedPayments.paymentMethod,
        reference: schema.unidentifiedPayments.reference,
        paymentDate: schema.unidentifiedPayments.paymentDate,
        notes: schema.unidentifiedPayments.notes,
        status: schema.unidentifiedPayments.status,
        reconciledPaymentId: schema.unidentifiedPayments.reconciledPaymentId,
        reconciledAt: schema.unidentifiedPayments.reconciledAt,
        voidedAt: schema.unidentifiedPayments.voidedAt,
        createdBy: schema.unidentifiedPayments.createdBy,
        createdByName: schema.users.name,
        createdAt: schema.unidentifiedPayments.createdAt,
      })
      .from(schema.unidentifiedPayments)
      .innerJoin(schema.users, eq(schema.unidentifiedPayments.createdBy, schema.users.id))
      .where(
        status === 'pending' || status === 'reconciled' || status === 'voided'
          ? eq(schema.unidentifiedPayments.status, status)
          : undefined
      )
      .orderBy(desc(schema.unidentifiedPayments.paymentDate), desc(schema.unidentifiedPayments.createdAt))
      .limit(100);

    // Resolve client names of reconciled payments (separate query to keep JOINs <= 3)
    const paymentIds = rows.map((r) => r.reconciledPaymentId).filter((id): id is string => !!id);
    const clientByPayment = new Map<string, string>();
    if (paymentIds.length > 0) {
      const linked = await db
        .select({ paymentId: schema.payments.id, clientName: schema.users.name })
        .from(schema.payments)
        .innerJoin(schema.users, eq(schema.payments.clientId, schema.users.id))
        .where(inArray(schema.payments.id, paymentIds));
      for (const l of linked) clientByPayment.set(l.paymentId, l.clientName);
    }

    const data = rows.map((r) => ({
      ...r,
      reconciledClientName: r.reconciledPaymentId ? clientByPayment.get(r.reconciledPaymentId) || null : null,
    }));

    return Response.json({ data });
  } catch (error) {
    console.error('GET /api/treasury/unidentified error:', error);
    return Response.json({ error: 'Error al obtener pagos por conciliar' }, { status: 500 });
  }
}

// POST /api/treasury/unidentified — Register an incoming payment with unknown origin
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { currency, amount, paymentMethod, reference, paymentDate, notes } = body as {
      currency?: 'USD' | 'VES';
      amount?: number;
      paymentMethod?: string;
      reference?: string;
      paymentDate?: number;
      notes?: string;
    };

    if (!currency || !['USD', 'VES'].includes(currency)) {
      return Response.json({ error: 'Moneda inválida' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return Response.json({ error: 'El monto debe ser un número positivo mayor a cero' }, { status: 400 });
    }
    const allowedMethods: readonly string[] = PAYMENT_METHODS_BY_CURRENCY[currency];
    if (!paymentMethod || !allowedMethods.includes(paymentMethod)) {
      return Response.json({ error: 'Método de pago inválido para la moneda seleccionada' }, { status: 400 });
    }
    if (currency === 'VES' && !reference?.trim()) {
      return Response.json({ error: 'La referencia es obligatoria para pagos en VES' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const timestamp = now();
    const id = generateId();

    await db.insert(schema.unidentifiedPayments).values({
      id,
      currency,
      amount: Number(amount),
      paymentMethod,
      reference: reference?.trim() || null,
      paymentDate: paymentDate || timestamp,
      notes: notes?.trim() || null,
      status: 'pending',
      createdBy: session.id,
      createdAt: timestamp,
    });

    return Response.json({ data: { id } }, { status: 201 });
  } catch (error) {
    console.error('POST /api/treasury/unidentified error:', error);
    return Response.json({ error: 'Error al registrar el pago por conciliar' }, { status: 500 });
  }
}
