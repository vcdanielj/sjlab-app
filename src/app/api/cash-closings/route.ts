// ============================================
// SJ Lab — Cash Closings API
// ============================================

export const runtime = 'edge';

import { eq, desc, and, gt, lte, sql } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { generateId, now } from '@/lib/utils';

// GET /api/cash-closings — List past closures
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const closingsList = await db
      .select({
        id: schema.cashClosings.id,
        closingDate: schema.cashClosings.closingDate,
        closedBy: schema.cashClosings.closedBy,
        closedByName: schema.users.name,
        zelleExpected: schema.cashClosings.zelleExpected,
        zelleActual: schema.cashClosings.zelleActual,
        binanceExpected: schema.cashClosings.binanceExpected,
        binanceActual: schema.cashClosings.binanceActual,
        efectivoExpected: schema.cashClosings.efectivoExpected,
        efectivoActual: schema.cashClosings.efectivoActual,
        bolivaresExpected: schema.cashClosings.bolivaresExpected,
        bolivaresActual: schema.cashClosings.bolivaresActual,
        notes: schema.cashClosings.notes,
        createdAt: schema.cashClosings.createdAt,
      })
      .from(schema.cashClosings)
      .innerJoin(schema.users, eq(schema.cashClosings.closedBy, schema.users.id))
      .orderBy(desc(schema.cashClosings.closingDate))
      .limit(100);

    return Response.json({ data: closingsList });
  } catch (error) {
    console.error('GET /api/cash-closings error:', error);
    return Response.json({ error: 'Error al obtener historial de cierres' }, { status: 500 });
  }
}

// POST /api/cash-closings — Register a cash closing
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const body = await request.json();
    
    const {
      zelleActual,
      binanceActual,
      efectivoActual,
      bolivaresActual,
      notes,
    } = body as {
      zelleActual?: number;
      binanceActual?: number;
      efectivoActual?: number;
      bolivaresActual?: number;
      notes?: string;
    };

    if (
      zelleActual === undefined ||
      binanceActual === undefined ||
      efectivoActual === undefined ||
      bolivaresActual === undefined
    ) {
      return Response.json({ error: 'Todos los saldos reales son obligatorios' }, { status: 400 });
    }

    const timestamp = now();

    // 1. Get the last closing to determine the start of the period
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

    // 4. Calculate expected balances using FIFO/original amounts
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

    const id = generateId();

    await db.insert(schema.cashClosings).values({
      id,
      closingDate: periodEnd,
      closedBy: session.id,
      zelleExpected,
      zelleActual: Number(zelleActual),
      binanceExpected,
      binanceActual: Number(binanceActual),
      efectivoExpected,
      efectivoActual: Number(efectivoActual),
      bolivaresExpected,
      bolivaresActual: Number(bolivaresActual),
      notes: notes?.trim() || null,
      createdAt: timestamp,
    });

    return Response.json({ data: { id } }, { status: 201 });
  } catch (error) {
    console.error('POST /api/cash-closings error:', error);
    return Response.json({ error: 'Error al realizar el cierre de caja' }, { status: 500 });
  }
}
