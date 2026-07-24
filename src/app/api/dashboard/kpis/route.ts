// ============================================
// SJ Lab — Dashboard KPIs API
// ============================================


import { sql, and, gte, lte, eq, ne } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

function getExpenseScopeCondition(expenseScope: string) {
  if (expenseScope === 'personal') {
    return eq(schema.expenses.isPersonal, true);
  }
  if (expenseScope === 'lab') {
    return eq(schema.expenses.isPersonal, false);
  }
  return null;
}

// GET /api/dashboard/kpis?from=X&to=Y
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const from = Number(url.searchParams.get('from') || 0);
    const to = Number(url.searchParams.get('to') || Math.floor(Date.now() / 1000));
    const expenseScope = url.searchParams.get('expenseScope') || 'all';

    // Calculate previous period for comparison
    const periodLength = to - from;
    const prevFrom = from - periodLength;
    const prevTo = from;

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Current period KPIs
    const [currentInvoiced] = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.orders.finalPriceUsd}), 0)` })
      .from(schema.orders)
      .where(and(
        gte(schema.orders.createdAt, from),
        lte(schema.orders.createdAt, to),
        ne(schema.orders.status, 'cancelled')
      ));

    const [currentCollected] = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.payments.amountRealUsd}), 0)` })
      .from(schema.payments)
      .where(and(
        gte(schema.payments.paymentDate, from),
        lte(schema.payments.paymentDate, to),
        eq(schema.payments.status, 'active')
      ));

    const [currentOrders] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(schema.orders)
      .where(and(
        gte(schema.orders.createdAt, from),
        lte(schema.orders.createdAt, to),
        ne(schema.orders.status, 'cancelled')
      ));

    const [currentCompleted] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(schema.orders)
      .where(and(
        gte(schema.orders.completedAt, from),
        lte(schema.orders.completedAt, to)
      ));

    // Previous period KPIs (for comparison)
    const [prevInvoiced] = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.orders.finalPriceUsd}), 0)` })
      .from(schema.orders)
      .where(and(
        gte(schema.orders.createdAt, prevFrom),
        lte(schema.orders.createdAt, prevTo),
        ne(schema.orders.status, 'cancelled')
      ));

    const [prevCollected] = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.payments.amountRealUsd}), 0)` })
      .from(schema.payments)
      .where(and(
        gte(schema.payments.paymentDate, prevFrom),
        lte(schema.payments.paymentDate, prevTo),
        eq(schema.payments.status, 'active')
      ));

    const [prevOrders] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(schema.orders)
      .where(and(
        gte(schema.orders.createdAt, prevFrom),
        lte(schema.orders.createdAt, prevTo),
        ne(schema.orders.status, 'cancelled')
      ));

    const [prevCompleted] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(schema.orders)
      .where(and(
        gte(schema.orders.completedAt, prevFrom),
        lte(schema.orders.completedAt, prevTo)
      ));

    // Build sparkline data (7 buckets across the period)
    const bucketSize = Math.max(Math.floor(periodLength / 7), 1);
    const sparklineInvoiced: number[] = [];
    const sparklineCollected: number[] = [];
    const sparklinePersonalExpenses: number[] = [];
    const sparklineLabExpenses: number[] = [];

    for (let i = 0; i < 7; i++) {
      const bucketFrom = from + (i * bucketSize);
      const bucketTo = i < 6 ? from + ((i + 1) * bucketSize) : to;

      const [inv] = await db
        .select({ total: sql<number>`COALESCE(SUM(${schema.orders.finalPriceUsd}), 0)` })
        .from(schema.orders)
        .where(and(
          gte(schema.orders.createdAt, bucketFrom),
          lte(schema.orders.createdAt, bucketTo),
          ne(schema.orders.status, 'cancelled')
        ));

      const [col] = await db
        .select({ total: sql<number>`COALESCE(SUM(${schema.payments.amountRealUsd}), 0)` })
        .from(schema.payments)
        .where(and(
          gte(schema.payments.paymentDate, bucketFrom),
          lte(schema.payments.paymentDate, bucketTo),
          eq(schema.payments.status, 'active')
        ));

      const [expBreakdown] = await db
        .select({
          personal: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 1 THEN ${schema.expenses.amountRealUsd} ELSE 0 END), 0)`,
          lab: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 0 THEN ${schema.expenses.amountRealUsd} ELSE 0 END), 0)`,
        })
        .from(schema.expenses)
        .where(and(gte(schema.expenses.expenseDate, bucketFrom), lte(schema.expenses.expenseDate, bucketTo)));

      sparklineInvoiced.push(inv.total);
      sparklineCollected.push(col.total);
      sparklinePersonalExpenses.push(expBreakdown.personal);
      sparklineLabExpenses.push(expBreakdown.lab);
    }

    // New KPIs: Expenses, Margin, Collection Rate, Active Clients
    const currentExpenseConditions = [gte(schema.expenses.expenseDate, from), lte(schema.expenses.expenseDate, to)];
    const prevExpenseConditions = [gte(schema.expenses.expenseDate, prevFrom), lte(schema.expenses.expenseDate, prevTo)];
    const expenseScopeCondition = getExpenseScopeCondition(expenseScope);
    if (expenseScopeCondition) {
      currentExpenseConditions.push(expenseScopeCondition);
      prevExpenseConditions.push(expenseScopeCondition);
    }

    const [currentExpenses] = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.expenses.amountRealUsd}), 0)` })
      .from(schema.expenses)
      .where(and(...currentExpenseConditions));

    const [prevExpenses] = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.expenses.amountRealUsd}), 0)` })
      .from(schema.expenses)
      .where(and(...prevExpenseConditions));

    const [currentExpenseBreakdown] = await db
      .select({
        personal: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 1 THEN ${schema.expenses.amountRealUsd} ELSE 0 END), 0)`,
        lab: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 0 THEN ${schema.expenses.amountRealUsd} ELSE 0 END), 0)`,
      })
      .from(schema.expenses)
      .where(and(gte(schema.expenses.expenseDate, from), lte(schema.expenses.expenseDate, to)));

    const [prevExpenseBreakdown] = await db
      .select({
        personal: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 1 THEN ${schema.expenses.amountRealUsd} ELSE 0 END), 0)`,
        lab: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 0 THEN ${schema.expenses.amountRealUsd} ELSE 0 END), 0)`,
      })
      .from(schema.expenses)
      .where(and(gte(schema.expenses.expenseDate, prevFrom), lte(schema.expenses.expenseDate, prevTo)));

    const [activeClients] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(schema.users)
      .where(and(eq(schema.users.role, 'client'), eq(schema.users.isActive, true)));

    const netMargin = currentCollected.total - currentExpenses.total;
    const prevNetMargin = prevCollected.total - prevExpenses.total;
    const collectionRate = currentInvoiced.total > 0
      ? Math.round((currentCollected.total / currentInvoiced.total) * 100)
      : 0;
    const prevCollectionRate = prevInvoiced.total > 0
      ? Math.round((prevCollected.total / prevInvoiced.total) * 100)
      : 0;

    const currentAverageOrder = currentOrders.total > 0 
      ? currentInvoiced.total / currentOrders.total 
      : 0;
    const prevAverageOrder = prevOrders.total > 0 
      ? prevInvoiced.total / prevOrders.total 
      : 0;

    const [activeOrders] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(schema.orders)
      .where(and(eq(schema.orders.status, 'active')));

    // Recurring expenses calculation (monthly prorated)
    const recurringExpenses = await db
      .select({
        amountRealUsd: schema.expenses.amountRealUsd,
        amountUsd: schema.expenses.amountUsd,
        recurrenceInterval: schema.expenses.recurrenceInterval,
        recurrenceTemplateId: schema.expenses.recurrenceTemplateId,
      })
      .from(schema.expenses)
      .where(eq(schema.expenses.isRecurring, true));

    let totalMonthlyRecurring = 0;
    const seenTemplateIds = new Set<string>();

    for (const exp of recurringExpenses) {
      if (exp.recurrenceTemplateId && seenTemplateIds.has(exp.recurrenceTemplateId)) {
        continue;
      }
      if (exp.recurrenceTemplateId) {
        seenTemplateIds.add(exp.recurrenceTemplateId);
      }

      const amt = exp.amountRealUsd || exp.amountUsd || 0;
      const interval = (exp.recurrenceInterval || 'monthly').toLowerCase();

      if (interval === 'weekly') {
        totalMonthlyRecurring += amt * (52 / 12);
      } else if (interval === 'biweekly') {
        totalMonthlyRecurring += amt * 2;
      } else if (interval === 'monthly') {
        totalMonthlyRecurring += amt;
      } else if (interval === 'quarterly') {
        totalMonthlyRecurring += amt / 3;
      } else if (interval === 'yearly') {
        totalMonthlyRecurring += amt / 12;
      } else {
        totalMonthlyRecurring += amt;
      }
    }

    const pendingCollection = Math.max(0, currentInvoiced.total - currentCollected.total);
    const prevPendingCollection = Math.max(0, prevInvoiced.total - prevCollected.total);

    const expenseRatio = currentInvoiced.total > 0
      ? Math.round((currentExpenses.total / currentInvoiced.total) * 100)
      : 0;
    const prevExpenseRatio = prevInvoiced.total > 0
      ? Math.round((prevExpenses.total / prevInvoiced.total) * 100)
      : 0;

    return Response.json({
      data: {
        totalInvoiced: {
          value: currentInvoiced.total,
          previous: prevInvoiced.total,
          sparkline: sparklineInvoiced,
        },
        totalCollected: {
          value: currentCollected.total,
          previous: prevCollected.total,
          sparkline: sparklineCollected,
        },
        newOrders: {
          value: currentOrders.total,
          previous: prevOrders.total,
        },
        completedOrders: {
          value: currentCompleted.total,
          previous: prevCompleted.total,
        },
        totalExpenses: {
          value: currentExpenses.total,
          previous: prevExpenses.total,
        },
        personalExpenses: {
          value: currentExpenseBreakdown.personal,
          previous: prevExpenseBreakdown.personal,
          sparkline: sparklinePersonalExpenses,
        },
        labExpenses: {
          value: currentExpenseBreakdown.lab,
          previous: prevExpenseBreakdown.lab,
          sparkline: sparklineLabExpenses,
        },
        netMargin: {
          value: netMargin,
          previous: prevNetMargin,
        },
        collectionRate: {
          value: collectionRate,
          previous: prevCollectionRate,
        },
        activeClients: {
          value: activeClients.total,
          previous: 0,
        },
        averageOrderValue: {
          value: currentAverageOrder,
          previous: prevAverageOrder,
        },
        activeOrders: {
          value: activeOrders.total,
          previous: 0,
        },
        monthlyRecurringExpense: {
          value: totalMonthlyRecurring,
          previous: 0,
        },
        pendingCollection: {
          value: pendingCollection,
          previous: prevPendingCollection,
        },
        expenseRatio: {
          value: expenseRatio,
          previous: prevExpenseRatio,
        },
        avgDailyExpense: {
          value: Math.round(currentExpenses.total / Math.max(1, Math.round((to - from) / 86400))),
          previous: Math.round(prevExpenses.total / Math.max(1, Math.round((prevTo - prevFrom) / 86400))),
        },
      },
    });
  } catch (err) {
    console.error('Error in GET /api/dashboard/kpis:', err);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
