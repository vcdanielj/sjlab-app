// ============================================
// SJ Lab — Treasury Transfers API
// ============================================

import { eq, desc } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { generateId, now } from '@/lib/utils';
import { calculateTreasuryBalances } from '@/lib/treasury';

// GET /api/treasury/transfers — List transfers
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const transfersList = await db
      .select({
        id: schema.treasuryTransfers.id,
        fromAccountId: schema.treasuryTransfers.fromAccountId,
        toAccountId: schema.treasuryTransfers.toAccountId,
        amountFrom: schema.treasuryTransfers.amountFrom,
        currencyFrom: schema.treasuryTransfers.currencyFrom,
        amountTo: schema.treasuryTransfers.amountTo,
        currencyTo: schema.treasuryTransfers.currencyTo,
        exchangeRate: schema.treasuryTransfers.exchangeRate,
        transferDate: schema.treasuryTransfers.transferDate,
        reference: schema.treasuryTransfers.reference,
        notes: schema.treasuryTransfers.notes,
        createdBy: schema.treasuryTransfers.createdBy,
        createdByName: schema.users.name,
        createdAt: schema.treasuryTransfers.createdAt,
      })
      .from(schema.treasuryTransfers)
      .innerJoin(schema.users, eq(schema.treasuryTransfers.createdBy, schema.users.id))
      .orderBy(desc(schema.treasuryTransfers.transferDate), desc(schema.treasuryTransfers.createdAt))
      .limit(100);

    return Response.json({ data: transfersList });
  } catch (error) {
    console.error('GET /api/treasury/transfers error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Error al obtener historial de transferencias: ${msg}` }, { status: 500 });
  }
}

// POST /api/treasury/transfers — Create a transfer between accounts
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
      fromAccountId,
      toAccountId,
      amountFrom,
      currencyFrom,
      amountTo,
      currencyTo,
      exchangeRate,
      transferDate,
      reference,
      notes,
    } = body as {
      fromAccountId?: string;
      toAccountId?: string;
      amountFrom?: number;
      currencyFrom?: 'USD' | 'VES';
      amountTo?: number;
      currencyTo?: 'USD' | 'VES';
      exchangeRate?: number;
      transferDate?: number;
      reference?: string;
      notes?: string;
    };

    if (!fromAccountId || !toAccountId) {
      return Response.json({ error: 'Cuenta origen y cuenta destino son requeridas' }, { status: 400 });
    }
    if (fromAccountId === toAccountId) {
      return Response.json({ error: 'La cuenta origen y la cuenta destino deben ser diferentes' }, { status: 400 });
    }
    if (!amountFrom || amountFrom <= 0) {
      return Response.json({ error: 'El monto de origen debe ser mayor a cero' }, { status: 400 });
    }
    const finalAmountTo = amountTo && amountTo > 0 ? amountTo : amountFrom;

    const timestamp = now();
    const finalTransferDate = transferDate || timestamp;
    const transferId = generateId();

    await db.insert(schema.treasuryTransfers).values({
      id: transferId,
      fromAccountId,
      toAccountId,
      amountFrom: Number(amountFrom),
      currencyFrom: currencyFrom || 'USD',
      amountTo: Number(finalAmountTo),
      currencyTo: currencyTo || 'USD',
      exchangeRate: exchangeRate ? Number(exchangeRate) : null,
      transferDate: finalTransferDate,
      reference: reference?.trim() || null,
      notes: notes?.trim() || null,
      createdBy: session.id,
      createdAt: timestamp,
    });

    const updatedBalances = await calculateTreasuryBalances(db);

    return Response.json(
      {
        data: {
          id: transferId,
          balances: updatedBalances,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/treasury/transfers error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Error al registrar transferencia: ${msg}` }, { status: 500 });
  }
}
