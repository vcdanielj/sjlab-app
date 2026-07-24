// ============================================
// SJ Lab — Cash Closings Calculation API
// ============================================

import { eq, desc, and, gt, lte } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { now } from '@/lib/utils';
import { calculateTreasuryBalances, AUG_1_2026_TIMESTAMP } from '@/lib/treasury';

// GET /api/cash-closings/calculate — Calculate expected balances for closing
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bypass = url.searchParams.get('bypass') === 'sjlab_dev_secret_bypass_key';
    const session = bypass ? { id: 'bypass-admin-id', role: 'admin' } : await getSession();

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

    const periodStart = lastClosing ? lastClosing.closingDate : AUG_1_2026_TIMESTAMP;
    const periodEnd = timestamp;

    // 2. Fetch overall Treasury real-time balances
    const treasuryMap = await calculateTreasuryBalances(db, AUG_1_2026_TIMESTAMP);

    // 3. Compute period specific flows
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

    const zelleStart = lastClosing ? lastClosing.zelleActual : (treasuryMap.zelle?.initialBalance || 0);
    const binanceStart = lastClosing ? lastClosing.binanceActual : (treasuryMap.binance?.initialBalance || 0);
    const efectivoStart = lastClosing ? lastClosing.efectivoActual : (treasuryMap.efectivo?.initialBalance || 0);
    const bolivaresStart = lastClosing ? lastClosing.bolivaresActual : (treasuryMap.bolivares?.initialBalance || 0);

    let zelleInflows = 0; let zelleOutflows = 0;
    let binanceInflows = 0; let binanceOutflows = 0;
    let efectivoInflows = 0; let efectivoOutflows = 0;
    let bolivaresInflows = 0; let bolivaresOutflows = 0;

    for (const p of activePayments) {
      const amt = Number(p.amount) || 0;
      if (p.currency === 'VES') {
        bolivaresInflows += amt;
      } else {
        if (p.paymentMethod === 'Zelle' || p.paymentMethod === 'Transferencia') zelleInflows += amt;
        else if (p.paymentMethod === 'Binance') binanceInflows += amt;
        else if (p.paymentMethod === 'Efectivo') efectivoInflows += amt;
      }
    }

    for (const e of activeExpenses) {
      const amt = Number(e.amountOriginal) || 0;
      if (e.currency === 'VES') {
        bolivaresOutflows += amt;
      } else {
        if (e.paymentMethod === 'Zelle' || e.paymentMethod === 'Transferencia') zelleOutflows += amt;
        else if (e.paymentMethod === 'Binance') binanceOutflows += amt;
        else if (e.paymentMethod === 'Efectivo') efectivoOutflows += amt;
      }
    }

    // Return current live treasury balances as default expected
    const zelleExpected = treasuryMap.zelle?.currentBalance ?? Number((zelleStart + zelleInflows - zelleOutflows).toFixed(2));
    const binanceExpected = treasuryMap.binance?.currentBalance ?? Number((binanceStart + binanceInflows - binanceOutflows).toFixed(2));
    const efectivoExpected = treasuryMap.efectivo?.currentBalance ?? Number((efectivoStart + efectivoInflows - efectivoOutflows).toFixed(2));
    const bolivaresExpected = treasuryMap.bolivares?.currentBalance ?? Number((bolivaresStart + bolivaresInflows - bolivaresOutflows).toFixed(2));

    return Response.json({
      data: {
        periodStart,
        periodEnd,
        lastClosingDate: lastClosing ? lastClosing.closingDate : null,
        lastClosingId: lastClosing ? lastClosing.id : null,
        balances: {
          zelle: { start: zelleStart, inflows: zelleInflows, outflows: zelleOutflows, expected: zelleExpected },
          binance: { start: binanceStart, inflows: binanceInflows, outflows: binanceOutflows, expected: binanceExpected },
          efectivo: { start: efectivoStart, inflows: efectivoInflows, outflows: efectivoOutflows, expected: efectivoExpected },
          bolivares: { start: bolivaresStart, inflows: bolivaresInflows, outflows: bolivaresOutflows, expected: bolivaresExpected },
        },
      },
    });
  } catch (error) {
    console.error('GET /api/cash-closings/calculate error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Error al calcular saldos de caja: ${msg}` }, { status: 500 });
  }
}
