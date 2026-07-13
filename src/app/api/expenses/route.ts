// ============================================
// SJ Lab — Expenses API (CRUD) - Enhanced
// ============================================

import { desc, asc, like, and, gte, lte, sql, eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { getRatesForDate, formatDateCaracas, RATES_KV_BINDING } from '@/lib/rates';

function getExpenseScopeCondition(expenseScope: string) {
  if (expenseScope === 'personal') {
    return eq(schema.expenses.isPersonal, true);
  }
  if (expenseScope === 'lab') {
    return eq(schema.expenses.isPersonal, false);
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const categoryId = url.searchParams.get('categoryId') || '';
    const isRecurring = url.searchParams.get('isRecurring');
    const templates = url.searchParams.get('templates');
    const expenseScope = url.searchParams.get('expenseScope') || 'all';
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const baseConditions = [];
    if (search) {
      baseConditions.push(like(schema.expenses.description, `%${search}%`));
    }
    if (categoryId) {
      baseConditions.push(eq(schema.expenses.categoryId, categoryId));
    }
    if (from) {
      baseConditions.push(gte(schema.expenses.expenseDate, parseInt(from)));
    }
    if (to) {
      baseConditions.push(lte(schema.expenses.expenseDate, parseInt(to)));
    }
    if (isRecurring === 'true') {
      baseConditions.push(eq(schema.expenses.isRecurring, true));
    }
    // Templates mode: return only recurring templates for quick selection
    if (templates === 'true') {
      baseConditions.push(eq(schema.expenses.isRecurring, true));
    }

    const conditions = [...baseConditions];
    const scopeCondition = getExpenseScopeCondition(expenseScope);
    if (scopeCondition) {
      conditions.push(scopeCondition);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const summaryWhere = baseConditions.length > 0 ? and(...baseConditions) : undefined;

    const sortBy = url.searchParams.get('sortBy') || 'expenseDate';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    let orderByExpression;
    if (sortBy === 'expenseDate') {
      orderByExpression = sortOrder === 'asc' ? asc(schema.expenses.expenseDate) : desc(schema.expenses.expenseDate);
    } else if (sortBy === 'description') {
      orderByExpression = sortOrder === 'asc' ? asc(schema.expenses.description) : desc(schema.expenses.description);
    } else if (sortBy === 'categoryId') {
      orderByExpression = sortOrder === 'asc' ? asc(schema.expenses.categoryId) : desc(schema.expenses.categoryId);
    } else if (sortBy === 'isPersonal') {
      orderByExpression = sortOrder === 'asc' ? asc(schema.expenses.isPersonal) : desc(schema.expenses.isPersonal);
    } else if (sortBy === 'currency') {
      orderByExpression = sortOrder === 'asc' ? asc(schema.expenses.currency) : desc(schema.expenses.currency);
    } else if (sortBy === 'amountUsd') {
      orderByExpression = sortOrder === 'asc' ? asc(schema.expenses.amountUsd) : desc(schema.expenses.amountUsd);
    } else if (sortBy === 'isRecurring') {
      orderByExpression = sortOrder === 'asc' ? asc(schema.expenses.isRecurring) : desc(schema.expenses.isRecurring);
    } else {
      orderByExpression = desc(schema.expenses.expenseDate);
    }

    const [data, totalsResult, breakdownResult] = await Promise.all([
      db.select().from(schema.expenses).where(where).orderBy(orderByExpression).limit(limit).offset(offset),
      db
        .select({
          count: sql<number>`COUNT(*)`,
          totalAmountUsd: sql<number>`COALESCE(SUM(${schema.expenses.amountUsd}), 0)`,
        })
        .from(schema.expenses)
        .where(where),
      db
        .select({
          totalPersonalUsd: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 1 THEN ${schema.expenses.amountUsd} ELSE 0 END), 0)`,
          totalLabUsd: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 0 THEN ${schema.expenses.amountUsd} ELSE 0 END), 0)`,
        })
        .from(schema.expenses)
        .where(summaryWhere),
    ]);

    const total = Number(totalsResult[0]?.count ?? 0);
    const totalAmountUsd = Number(totalsResult[0]?.totalAmountUsd ?? 0);
    const totalPersonalUsd = Number(breakdownResult[0]?.totalPersonalUsd ?? 0);
    const totalLabUsd = Number(breakdownResult[0]?.totalLabUsd ?? 0);

    return Response.json({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: {
        totalAmountUsd,
        averageAmountUsd: total > 0 ? totalAmountUsd / total : 0,
        totalPersonalUsd,
        totalLabUsd,
      },
    });
  } catch (error) {
    console.error('GET /api/expenses error:', error);
    return Response.json({ error: 'Error al obtener gastos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const kv = (env as { RATES_KV?: RATES_KV_BINDING }).RATES_KV;
    const body = await request.json();
    const {
      description, category, categoryId,
      currency, amountOriginal, appliedExchangeRateType, exchangeRate,
      expenseDate, notes, isPersonal,
      isRecurring, recurrenceInterval, recurrenceTemplateId,
    } = body;

    const parsedExpenseDate = parseInt(expenseDate);
    if (!description?.trim() || (!amountOriginal && !body.amountUsd) || !parsedExpenseDate) {
      return Response.json({ error: 'Campos requeridos: descripción, monto, fecha' }, { status: 400 });
    }
    if (typeof isPersonal !== 'boolean') {
      return Response.json({ error: 'La clasificación del gasto es obligatoria' }, { status: 400 });
    }

    const orgAmount = amountOriginal ? parseFloat(amountOriginal) : parseFloat(body.amountUsd);

    // Fetch exchange rates for the expense date
    const dateStr = formatDateCaracas(parsedExpenseDate);
    const rates = await getRatesForDate(db, kv, dateStr);

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

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.insert(schema.expenses).values({
      id,
      description: description.trim(),
      category: category || 'otro',
      categoryId: categoryId || null,
      currency: currency || 'USD',
      amountOriginal: orgAmount,
      appliedExchangeRateType: rateType,
      exchangeRate: appliedRate,
      parallelExchangeRate: parallelRate,
      amountUsd: computedAmountUsd,
      amountRealUsd: computedAmountRealUsd,
      expenseDate: parsedExpenseDate,
      notes: notes?.trim() || null,
      isPersonal,
      isRecurring: isRecurring || false,
      recurrenceInterval: isRecurring ? (recurrenceInterval || 'monthly') : null,
      recurrenceTemplateId: recurrenceTemplateId || null,
      createdBy: session.id,
      createdAt: now,
    });

    return Response.json({ data: { id } }, { status: 201 });
  } catch (error) {
    console.error('POST /api/expenses error:', error);
    return Response.json({ error: 'Error al crear gasto' }, { status: 500 });
  }
}
