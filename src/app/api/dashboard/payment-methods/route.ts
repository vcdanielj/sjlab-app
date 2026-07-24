// ============================================
// SJ Lab — Dashboard Payment Methods API
// ============================================

import { sql, and, gte, lte, eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

const METHOD_LABELS: Record<string, { name: string; color: string }> = {
  zelle: { name: 'Zelle', color: '#6366F1' },
  efectivo: { name: 'Efectivo USD', color: '#10B981' },
  efectivo_ves: { name: 'Efectivo Bs', color: '#059669' },
  pago_movil: { name: 'Pago Móvil', color: '#F59E0B' },
  transferencia: { name: 'Transferencia Bs', color: '#3B82F6' },
  binance: { name: 'Binance Pay', color: '#F7931A' },
  otro: { name: 'Otros', color: '#6B7280' },
};

const PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#F7931A', '#14B8A6', '#8B5CF6'];

// GET /api/dashboard/payment-methods?from=X&to=Y
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

    const rows = await db
      .select({
        method: schema.payments.paymentMethod,
        total: sql<number>`COALESCE(SUM(${schema.payments.amountRealUsd}), 0)`,
        count: sql<number>`COUNT(${schema.payments.id})`,
      })
      .from(schema.payments)
      .where(and(
        gte(schema.payments.paymentDate, from),
        lte(schema.payments.paymentDate, to),
        eq(schema.payments.status, 'active')
      ))
      .groupBy(schema.payments.paymentMethod)
      .orderBy(sql`SUM(${schema.payments.amountRealUsd}) DESC`);

    let totalSum = 0;
    for (const r of rows) {
      if (r.total > 0) totalSum += r.total;
    }

    const data = rows
      .filter((r) => r.total > 0)
      .map((r, idx) => {
        const key = (r.method || 'otro').toLowerCase().replace(/\s+/g, '_');
        const meta = METHOD_LABELS[key] || {
          name: r.method || 'Otros',
          color: PALETTE[idx % PALETTE.length],
        };
        return {
          name: meta.name,
          color: meta.color,
          value: Number(r.total.toFixed(2)),
          count: Number(r.count),
          percentage: totalSum > 0 ? Number(((r.total / totalSum) * 100).toFixed(1)) : 0,
        };
      });

    return Response.json({ data, totalSum: Number(totalSum.toFixed(2)) });
  } catch (err) {
    console.error('Error in GET /api/dashboard/payment-methods:', err);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
