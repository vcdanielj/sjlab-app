// ============================================
// SJ Lab — Dashboard Revenue API
// ============================================


import { sql, and, gte, lte, eq, ne } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/dashboard/revenue?from=X&to=Y
// Returns grouped data for invoiced vs collected by time bucket
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const from = Number(url.searchParams.get('from') || 0);
    const to = Number(url.searchParams.get('to') || Math.floor(Date.now() / 1000));

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Determine bucket count and size based on period length
    const periodDays = Math.max(Math.ceil((to - from) / 86400), 1);
    let bucketCount: number;
    let labelFormat: 'day' | 'week' | 'month';

    if (periodDays <= 14) {
      bucketCount = periodDays;
      labelFormat = 'day';
    } else if (periodDays <= 90) {
      bucketCount = Math.ceil(periodDays / 7);
      labelFormat = 'week';
    } else {
      bucketCount = Math.ceil(periodDays / 30);
      labelFormat = 'month';
    }

    bucketCount = Math.min(bucketCount, 12);
    const bucketSize = Math.floor((to - from) / bucketCount);

    const data: Array<{ label: string; invoiced: number; collected: number }> = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketFrom = from + (i * bucketSize);
      const bucketTo = i < bucketCount - 1 ? from + ((i + 1) * bucketSize) : to;

      // Label
      const dateObj = new Date(bucketFrom * 1000);
      let label: string;
      if (labelFormat === 'day') {
        label = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      } else if (labelFormat === 'week') {
        label = `Sem ${i + 1}`;
      } else {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        label = months[dateObj.getMonth()];
      }

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

      data.push({
        label,
        invoiced: Number(inv.total.toFixed(2)),
        collected: Number(col.total.toFixed(2)),
      });
    }

    return Response.json({ data });
  } catch (err) {
    console.error('Error in GET /api/dashboard/revenue:', err);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
