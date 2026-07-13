// ============================================
// SJ Lab — Payments API
// ============================================


import { eq, and, desc, inArray } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { generateId, now } from '@/lib/utils';
import { getSession } from '@/lib/session';
import { applyPayment, applyManualAllocations } from '@/lib/fifo';
import { getRatesForDate, formatDateCaracas, RATES_KV_BINDING } from '@/lib/rates';

// GET /api/payments?clientId=X — List payment history for a client
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const clientId = url.searchParams.get('clientId');

    if (!clientId) {
      return Response.json({ error: 'Falta el ID del cliente (clientId)' }, { status: 400 });
    }

    // Portal security: clients can only fetch their own payments
    if (session.role === 'client' && session.id !== clientId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const paymentsList = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.clientId, clientId))
      .orderBy(desc(schema.payments.paymentDate), desc(schema.payments.createdAt))
      .limit(100);

    return Response.json({ data: paymentsList });
  } catch {
    return Response.json({ error: 'Error al obtener pagos' }, { status: 500 });
  }
}

// POST /api/payments — Register a payment (USD or VES with exchange rate)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      clientId,
      currency,
      amount,
      appliedExchangeRateType,
      exchangeRate,
      paymentMethod,
      reference,
      paymentDate,
      orderAllocations,
    } = body as {
      clientId?: string;
      currency?: 'USD' | 'VES';
      amount?: number;
      appliedExchangeRateType?: 'USD_PARALLEL' | 'USD_BCV' | 'EUR_BCV' | 'MANUAL';
      exchangeRate?: number;
      paymentMethod?: string;
      reference?: string;
      paymentDate?: number;
      orderAllocations?: { orderId: string; amountUsd: number }[];
    };

    // Validations
    if (!clientId) return Response.json({ error: 'El cliente es requerido' }, { status: 400 });
    if (!currency || !['USD', 'VES'].includes(currency)) {
      return Response.json({ error: 'Moneda inválida' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return Response.json({ error: 'El monto debe ser un número positivo mayor a cero' }, { status: 400 });
    }
    if (currency === 'VES' && appliedExchangeRateType === 'MANUAL' && (!exchangeRate || exchangeRate <= 0)) {
      return Response.json({ error: 'La tasa de cambio manual es requerida para pagos en VES' }, { status: 400 });
    }
    if (!paymentMethod?.trim()) {
      return Response.json({ error: 'El método de pago es requerido' }, { status: 400 });
    }
    if (currency === 'VES' && !reference?.trim()) {
      return Response.json({ error: 'La referencia es obligatoria para pagos en VES' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const kv = (env as { RATES_KV?: RATES_KV_BINDING }).RATES_KV;

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

    const timestamp = now();
    const finalPaymentDate = paymentDate || timestamp;

    // Fetch exchange rates for the payment date
    const dateStr = formatDateCaracas(finalPaymentDate);
    const rates = await getRatesForDate(db, kv, dateStr);

    const rateType = appliedExchangeRateType || 'USD_PARALLEL';
    let appliedRate = 1.0;
    if (rateType === 'USD_PARALLEL') appliedRate = rates.usdParallel;
    else if (rateType === 'USD_BCV') appliedRate = rates.usdBcv;
    else if (rateType === 'EUR_BCV') appliedRate = rates.eurBcv;
    else if (rateType === 'MANUAL') appliedRate = Number(exchangeRate) || 1.0;

    const parallelRate = rates.usdParallel;

    // Calculate USD amounts using bi-currency formulas
    let amountUsd = 0;
    let amountRealUsd = 0;

    if (currency === 'VES') {
      amountUsd = Number((amount / appliedRate).toFixed(2));
      amountRealUsd = Number((amount / parallelRate).toFixed(2));
    } else {
      amountUsd = amount;
      amountRealUsd = Number(((amount * appliedRate) / parallelRate).toFixed(2));
    }

    // Validate manual allocations if provided
    if (orderAllocations && orderAllocations.length > 0) {
      const totalAllocated = orderAllocations.reduce((sum, a) => sum + (Number(a.amountUsd) || 0), 0);
      if (totalAllocated > amountUsd + 0.01) {
        return Response.json({ error: 'El monto total asignado supera el monto del pago' }, { status: 400 });
      }

      // Fetch referenced orders to validate
      const orderIds = orderAllocations.map(a => a.orderId);
      const dbOrders = await db
        .select()
        .from(schema.orders)
        .where(
          and(
            inArray(schema.orders.id, orderIds),
            eq(schema.orders.clientId, clientId)
          )
        );

      if (dbOrders.length !== orderIds.length) {
        return Response.json({ error: 'Uno o más pedidos no fueron encontrados o no pertenecen al cliente' }, { status: 400 });
      }

      for (const alloc of orderAllocations) {
        const order = dbOrders.find(o => o.id === alloc.orderId);
        if (!order) {
          return Response.json({ error: 'Pedido no encontrado' }, { status: 400 });
        }
        if (order.status === 'cancelled') {
          return Response.json({ error: `No se puede asignar un pago a un pedido cancelado: #${order.orderNumber}` }, { status: 400 });
        }
        const remaining = order.finalPriceUsd - order.amountPaidUsd;
        if (alloc.amountUsd > remaining + 0.01) {
          return Response.json({
            error: `El monto asignado (${alloc.amountUsd} USD) supera el saldo pendiente (${remaining.toFixed(2)} USD) del pedido #${order.orderNumber}`
          }, { status: 400 });
        }
      }
    }

    const paymentId = generateId();

    let allocations: { orderId: string; amountUsd: number }[] = [];

    // Run inside database — try transaction first, fallback to sequential
    try {
      await db.transaction(async (tx) => {
        // 1. Insert Payment
        await tx.insert(schema.payments).values({
          id: paymentId,
          clientId,
          currency,
          amount,
          appliedExchangeRateType: rateType,
          exchangeRate: appliedRate,
          parallelExchangeRate: parallelRate,
          amountUsd,
          amountRealUsd,
          paymentMethod: paymentMethod.trim(),
          reference: reference?.trim() || null,
          paymentDate: finalPaymentDate,
          status: 'active',
          createdAt: timestamp,
        });

        // 2. Distribute (using Commercial USD, which is amountUsd)
        if (orderAllocations && orderAllocations.length > 0) {
          allocations = await applyManualAllocations(tx, clientId, paymentId, orderAllocations, timestamp);
        } else {
          allocations = await applyPayment(tx, clientId, amountUsd, paymentId);
        }
      });
    } catch (txError) {
      console.error('Payment transaction failed, falling back to sequential:', txError);

      // 1. Insert Payment
      await db.insert(schema.payments).values({
        id: paymentId,
        clientId,
        currency,
        amount,
        appliedExchangeRateType: rateType,
        exchangeRate: appliedRate,
        parallelExchangeRate: parallelRate,
        amountUsd,
        amountRealUsd,
        paymentMethod: paymentMethod.trim(),
        reference: reference?.trim() || null,
        paymentDate: finalPaymentDate,
        status: 'active',
        createdAt: timestamp,
      });

      // 2. Distribute
      if (orderAllocations && orderAllocations.length > 0) {
        allocations = await applyManualAllocations(db, clientId, paymentId, orderAllocations, timestamp);
      } else {
        allocations = await applyPayment(db, clientId, amountUsd, paymentId);
      }
    }

    return Response.json(
      {
        data: {
          id: paymentId,
          amountUsd,
          allocations,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error in POST /api/payments:', err);
    const message = err instanceof Error ? err.message : 'Error interno al registrar el pago';
    return Response.json({ error: message }, { status: 500 });
  }
}

