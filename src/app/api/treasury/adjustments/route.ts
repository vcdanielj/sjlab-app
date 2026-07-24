// ============================================
// SJ Lab — Treasury Adjustments API
// ============================================

import { eq, desc } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { generateId, now } from '@/lib/utils';
import { calculateTreasuryBalances } from '@/lib/treasury';

// GET /api/treasury/adjustments — List balance adjustments
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const adjustmentsList = await db
      .select({
        id: schema.treasuryAdjustments.id,
        accountId: schema.treasuryAdjustments.accountId,
        type: schema.treasuryAdjustments.type,
        amount: schema.treasuryAdjustments.amount,
        currency: schema.treasuryAdjustments.currency,
        reason: schema.treasuryAdjustments.reason,
        notes: schema.treasuryAdjustments.notes,
        adjustmentDate: schema.treasuryAdjustments.adjustmentDate,
        createdBy: schema.treasuryAdjustments.createdBy,
        createdByName: schema.users.name,
        createdAt: schema.treasuryAdjustments.createdAt,
      })
      .from(schema.treasuryAdjustments)
      .innerJoin(schema.users, eq(schema.treasuryAdjustments.createdBy, schema.users.id))
      .orderBy(desc(schema.treasuryAdjustments.adjustmentDate), desc(schema.treasuryAdjustments.createdAt))
      .limit(100);

    return Response.json({ data: adjustmentsList });
  } catch (error) {
    console.error('GET /api/treasury/adjustments error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Error al obtener historial de ajustes: ${msg}` }, { status: 500 });
  }
}

// POST /api/treasury/adjustments — Create a balance adjustment (requires reason)
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
      accountId,
      type,
      amount,
      currency,
      reason,
      notes,
      adjustmentDate,
    } = body as {
      accountId?: string;
      type?: 'inflow' | 'outflow';
      amount?: number;
      currency?: 'USD' | 'VES';
      reason?: string;
      notes?: string;
      adjustmentDate?: number;
    };

    if (!accountId) {
      return Response.json({ error: 'La cuenta a ajustar es requerida' }, { status: 400 });
    }
    if (!type || !['inflow', 'outflow'].includes(type)) {
      return Response.json({ error: 'El tipo de ajuste es inválido (inflow o outflow)' }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return Response.json({ error: 'El monto del ajuste debe ser un número positivo mayor a cero' }, { status: 400 });
    }
    if (!reason || !reason.trim()) {
      return Response.json({ error: 'El motivo / razón del ajuste es totalmente obligatorio' }, { status: 400 });
    }

    const timestamp = now();
    const finalAdjustmentDate = adjustmentDate || timestamp;
    const adjustmentId = generateId();

    await db.insert(schema.treasuryAdjustments).values({
      id: adjustmentId,
      accountId,
      type,
      amount: Number(amount),
      currency: currency || 'USD',
      reason: reason.trim(),
      notes: notes?.trim() || null,
      adjustmentDate: finalAdjustmentDate,
      createdBy: session.id,
      createdAt: timestamp,
    });

    const updatedBalances = await calculateTreasuryBalances(db);

    return Response.json(
      {
        data: {
          id: adjustmentId,
          balances: updatedBalances,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/treasury/adjustments error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Error al registrar ajuste de saldo: ${msg}` }, { status: 500 });
  }
}
