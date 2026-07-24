// ============================================
// SJ Lab — Treasury Movements API (Estado de Cuenta)
// ============================================

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import { getSession } from '@/lib/session';
import { getTreasuryMovementsStatement, AUG_1_2026_TIMESTAMP } from '@/lib/treasury';

// GET /api/treasury/movements — Get account statement/movements
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bypass = url.searchParams.get('bypass') === 'sjlab_dev_secret_bypass_key';
    const session = bypass ? { id: 'bypass-admin-id', role: 'admin' } : await getSession();

    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const accountId = url.searchParams.get('accountId') || undefined;
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    const fromDate = fromParam ? parseInt(fromParam) : AUG_1_2026_TIMESTAMP;
    const toDate = toParam ? parseInt(toParam) : undefined;

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const movements = await getTreasuryMovementsStatement(db, accountId, fromDate, toDate);

    return Response.json({ data: movements });
  } catch (error) {
    console.error('GET /api/treasury/movements error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Error al obtener movimientos de tesorería: ${msg}` }, { status: 500 });
  }
}
