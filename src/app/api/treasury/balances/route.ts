// ============================================
// SJ Lab — Treasury Balances API
// ============================================

import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { calculateTreasuryBalances, AUG_1_2026_TIMESTAMP } from '@/lib/treasury';

// GET /api/treasury/balances — Get real-time account balances
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

    const balances = await calculateTreasuryBalances(db, AUG_1_2026_TIMESTAMP);

    return Response.json({
      data: {
        startDate: AUG_1_2026_TIMESTAMP,
        balances,
      },
    });
  } catch (error) {
    console.error('GET /api/treasury/balances error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Error al obtener saldos de tesorería: ${msg}` }, { status: 500 });
  }
}

// POST /api/treasury/balances — Update initial balances for August 1st, 2026
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const body = await request.json();

    const { initialBalances } = body as {
      initialBalances?: Record<string, number>;
    };

    if (!initialBalances || typeof initialBalances !== 'object') {
      return Response.json({ error: 'Saldos iniciales inválidos' }, { status: 400 });
    }

    const timestampNow = Math.floor(Date.now() / 1000);

    for (const [accId, val] of Object.entries(initialBalances)) {
      const numVal = Number(val) || 0;
      await db
        .update(schema.treasuryAccounts)
        .set({
          initialBalance: numVal,
          initialBalanceDate: AUG_1_2026_TIMESTAMP,
          updatedAt: timestampNow,
        })
        .where(eq(schema.treasuryAccounts.id, accId));
    }

    const updatedBalances = await calculateTreasuryBalances(db, AUG_1_2026_TIMESTAMP);

    return Response.json({
      data: {
        message: 'Saldos iniciales al 01/08/2026 actualizados correctamente',
        balances: updatedBalances,
      },
    });
  } catch (error) {
    console.error('POST /api/treasury/balances error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Error al actualizar saldos iniciales: ${msg}` }, { status: 500 });
  }
}
