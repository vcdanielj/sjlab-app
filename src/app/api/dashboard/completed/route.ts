// ============================================
// SJ Lab — Dashboard Completed Orders API
// ============================================


import { sql, and, gte, lte } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/dashboard/completed?from=X&to=Y
// Returns completed orders count by time bucket (for line chart)
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

    const data: Array<{ label: string; completed: number }> = [];

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

      const [result] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.orders)
        .where(and(
          gte(schema.orders.completedAt, bucketFrom),
          lte(schema.orders.completedAt, bucketTo)
        ));

      data.push({ label, completed: result.total });
    }

    return Response.json({ data });
  } catch (err) {
    console.error('Error in GET /api/dashboard/completed:', err);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
