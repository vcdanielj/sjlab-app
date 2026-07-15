// ============================================
// SJ Lab — Cash Closings Calculation API
// ============================================

export const runtime = 'edge';

import { eq, desc, and, gt, lte } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { now } from '@/lib/utils';

// GET /api/cash-closings/calculate — Calculate expected balances
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const timestamp = now();

    // 1. Get the last closing
    const [lastClosing] = await db
      .select()
      .from(schema.cashClosings)
      .orderBy(desc(schema.cashClosings.closingDate))
      .limit(1);

    const periodStart = lastClosing ? lastClosing.closingDate : 0;
    const periodEnd = timestamp;

    // 2. Fetch payments and expenses in this period
    const activePayments = await db
      .select()
      .from(schema.payments)
      .where(
        and(
          eq(schema.payments.status, 'active'),
          gt(schema.payments.paymentDate, periodStart),
          lte(schema.payments.paymentDate, periodEnd)
        )
      );

    const activeExpenses = await db
      .select()
      .from(schema.expenses)
      .where(
        and(
          gt(schema.expenses.expenseDate, periodStart),
          lte(schema.expenses.expenseDate, periodEnd)
        )
      );

    // 3. Compute starting balances
    const zelleStart = lastClosing ? lastClosing.zelleActual : 0;
    const binanceStart = lastClosing ? lastClosing.binanceActual : 0;
    const efectivoStart = lastClosing ? lastClosing.efectivoActual : 0;
    const bolivaresStart = lastClosing ? lastClosing.bolivaresActual : 0;

    // 4. Calculate expected balances and flows
    let zelleInflows = 0;
    let zelleOutflows = 0;
    let binanceInflows = 0;
    let binanceOutflows = 0;
    let efectivoInflows = 0;
    let efectivoOutflows = 0;
    let bolivaresInflows = 0;
    let bolivaresOutflows = 0;

    for (const p of activePayments) {
      const amt = Number(p.amount) || 0;
      if (p.currency === 'VES') {
        bolivaresInflows += amt;
      } else {
        // currency === 'USD'
        if (p.paymentMethod === 'Zelle' || p.paymentMethod === 'Transferencia') {
          zelleInflows += amt;
        } else if (p.paymentMethod === 'Binance') {
          binanceInflows += amt;
        } else if (p.paymentMethod === 'Efectivo') {
          efectivoInflows += amt;
        }
      }
    }

    for (const e of activeExpenses) {
      const amt = Number(e.amountOriginal) || 0;
      if (e.currency === 'VES') {
        bolivaresOutflows += amt;
      } else {
        // currency === 'USD'
        if (e.paymentMethod === 'Zelle' || e.paymentMethod === 'Transferencia') {
          zelleOutflows += amt;
        } else if (e.paymentMethod === 'Binance') {
          binanceOutflows += amt;
        } else if (e.paymentMethod === 'Efectivo') {
          efectivoOutflows += amt;
        }
      }
    }

    const zelleExpected = Number((zelleStart + zelleInflows - zelleOutflows).toFixed(2));
    const binanceExpected = Number((binanceStart + binanceInflows - binanceOutflows).toFixed(2));
    const efectivoExpected = Number((efectivoStart + efectivoInflows - efectivoOutflows).toFixed(2));
    const bolivaresExpected = Number((bolivaresStart + bolivaresInflows - bolivaresOutflows).toFixed(2));

    return Response.json({
      data: {
        periodStart,
        periodEnd,
        lastClosingDate: lastClosing ? lastClosing.closingDate : null,
        lastClosingId: lastClosing ? lastClosing.id : null,
        balances: {
          zelle: {
            start: zelleStart,
            inflows: zelleInflows,
            outflows: zelleOutflows,
            expected: zelleExpected,
          },
          binance: {
            start: binanceStart,
            inflows: binanceInflows,
            outflows: binanceOutflows,
            expected: binanceExpected,
          },
          efectivo: {
            start: efectivoStart,
            inflows: efectivoInflows,
            outflows: efectivoOutflows,
            expected: efectivoExpected,
          },
          bolivares: {
            start: bolivaresStart,
            inflows: bolivaresInflows,
            outflows: bolivaresOutflows,
            expected: bolivaresExpected,
          },
        },
      },
    });
  } catch (error) {
    console.error('GET /api/cash-closings/calculate error:', error);
    return Response.json({ error: 'Error al calcular saldos de caja' }, { status: 500 });
  }
}
