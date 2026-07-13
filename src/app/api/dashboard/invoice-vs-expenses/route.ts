// ============================================
// SJ Lab — Dashboard Invoice vs Expenses API
// ============================================

import { sql, and, gte, lte, ne } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/dashboard/invoice-vs-expenses?from=X&to=Y
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

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const periodDays = Math.max(Math.ceil((to - from) / 86400), 1);
    let bucketCount: number;

    if (periodDays <= 14) {
      bucketCount = periodDays;
    } else if (periodDays <= 90) {
      bucketCount = Math.ceil(periodDays / 7);
    } else {
      bucketCount = Math.ceil(periodDays / 30);
    }

    bucketCount = Math.min(bucketCount, 12);
    const bucketSize = Math.floor((to - from) / bucketCount);

    const data: Array<{
      label: string;
      invoiced: number;
      expenses: number;
      personalExpenses: number;
      labExpenses: number;
      margin: number;
    }> = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketFrom = from + (i * bucketSize);
      const bucketTo = i < bucketCount - 1 ? from + ((i + 1) * bucketSize) : to;

      const dateObj = new Date(bucketFrom * 1000);
      let label: string;
      if (periodDays <= 14) {
        label = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      } else if (periodDays <= 90) {
        label = `Sem ${i + 1}`;
      } else {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        label = months[dateObj.getMonth()];
      }

      const [invResult] = await db
        .select({ total: sql<number>`COALESCE(SUM(${schema.orders.finalPriceUsd}), 0)` })
        .from(schema.orders)
        .where(and(
          gte(schema.orders.createdAt, bucketFrom),
          lte(schema.orders.createdAt, bucketTo),
          ne(schema.orders.status, 'cancelled')
        ));

      const [expResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${schema.expenses.amountUsd}), 0)`,
          personal: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 1 THEN ${schema.expenses.amountUsd} ELSE 0 END), 0)`,
          lab: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 0 THEN ${schema.expenses.amountUsd} ELSE 0 END), 0)`,
        })
        .from(schema.expenses)
        .where(and(gte(schema.expenses.expenseDate, bucketFrom), lte(schema.expenses.expenseDate, bucketTo)));

      const invoiced = invResult.total;
      const expenseTotal = expenseScope === 'personal'
        ? expResult.personal
        : expenseScope === 'lab'
          ? expResult.lab
          : expResult.total;

      data.push({
        label,
        invoiced,
        expenses: expenseTotal,
        personalExpenses: expResult.personal,
        labExpenses: expResult.lab,
        margin: invoiced - expenseTotal,
      });
    }

    return Response.json({ data });
  } catch (err) {
    console.error('Error in GET /api/dashboard/invoice-vs-expenses:', err);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
