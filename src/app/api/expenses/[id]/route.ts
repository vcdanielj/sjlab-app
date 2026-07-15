import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { getRatesForDate, formatDateCaracas, RATES_KV_BINDING } from '@/lib/rates';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const body = await request.json();

    // Fetch existing expense record
    const [existing] = await db
      .select()
      .from(schema.expenses)
      .where(eq(schema.expenses.id, id))
      .limit(1);

    if (!existing) {
      return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }

    const currency = body.currency !== undefined ? body.currency : existing.currency;
    const paymentMethod = body.paymentMethod !== undefined ? body.paymentMethod : existing.paymentMethod;
    const amountOriginal = body.amountOriginal !== undefined 
      ? (body.amountOriginal ? parseFloat(body.amountOriginal) : null) 
      : existing.amountOriginal;
    const expenseDate = body.expenseDate !== undefined ? parseInt(body.expenseDate) : existing.expenseDate;
    const appliedExchangeRateType = body.appliedExchangeRateType !== undefined 
      ? body.appliedExchangeRateType 
      : existing.appliedExchangeRateType;
    const exchangeRate = body.exchangeRate !== undefined 
      ? (body.exchangeRate ? parseFloat(body.exchangeRate) : null) 
      : existing.exchangeRate;

    if (paymentMethod !== undefined && !paymentMethod?.trim()) {
      return Response.json({ error: 'El método de pago / cuenta es obligatorio' }, { status: 400 });
    }

    const orgAmount = amountOriginal || body.amountUsd || existing.amountOriginal || existing.amountUsd;

    // Fetch exchange rates for the date
    const dateStr = formatDateCaracas(expenseDate);
    const rates = await getRatesForDate(db, (env as { RATES_KV?: RATES_KV_BINDING }).RATES_KV, dateStr);

    const rateType = appliedExchangeRateType || (currency === 'VES' ? 'USD_PARALLEL' : null);
    let appliedRate: number | null = null;
    let parallelRate: number | null = null;
    let computedAmountUsd = orgAmount;
    let computedAmountRealUsd = orgAmount;

    if (currency === 'VES') {
      parallelRate = rates.usdParallel;
      if (rateType === 'USD_PARALLEL') appliedRate = rates.usdParallel;
      else if (rateType === 'USD_BCV') appliedRate = rates.usdBcv;
      else if (rateType === 'EUR_BCV') appliedRate = rates.eurBcv;
      else if (rateType === 'MANUAL') appliedRate = Number(exchangeRate) || 1.0;
      else appliedRate = rates.usdParallel;

      computedAmountUsd = Number((orgAmount / appliedRate).toFixed(2));
      computedAmountRealUsd = Number((orgAmount / parallelRate).toFixed(2));
    } else {
      // currency === 'USD'
      computedAmountUsd = orgAmount;
      computedAmountRealUsd = orgAmount;
    }

    const updates: Record<string, unknown> = {
      description: body.description ? body.description.trim() : existing.description,
      category: body.category || existing.category,
      categoryId: body.categoryId !== undefined ? (body.categoryId || null) : existing.categoryId,
      currency,
      paymentMethod: paymentMethod ? paymentMethod.trim() : null,
      amountOriginal: orgAmount,
      appliedExchangeRateType: rateType,
      exchangeRate: appliedRate,
      parallelExchangeRate: parallelRate,
      amountUsd: computedAmountUsd,
      amountRealUsd: computedAmountRealUsd,
      expenseDate,
      notes: body.notes !== undefined ? (body.notes?.trim() || null) : existing.notes,
      isPersonal: typeof body.isPersonal === 'boolean' ? body.isPersonal : existing.isPersonal,
      isRecurring: body.isRecurring !== undefined ? body.isRecurring : existing.isRecurring,
      recurrenceInterval: body.recurrenceInterval !== undefined ? (body.recurrenceInterval || null) : existing.recurrenceInterval,
    };

    await db.update(schema.expenses).set(updates).where(eq(schema.expenses.id, id));
    return Response.json({ data: { id } });
  } catch (error) {
    console.error('PUT /api/expenses/[id] error:', error);
    return Response.json({ error: 'Error al actualizar gasto' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await db.delete(schema.expenses).where(eq(schema.expenses.id, id));
    return Response.json({ data: { deleted: true } });
  } catch (error) {
    console.error('DELETE /api/expenses/[id] error:', error);
    return Response.json({ error: 'Error al eliminar gasto' }, { status: 500 });
  }
}
