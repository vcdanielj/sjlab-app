// ============================================
// SJ Lab — Treasury Engine Helper (Tesorería)
// ============================================

import { eq, and, gte, lte, asc } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { TreasuryAccountBalance, AccountMovement } from '@/types';

// Default start date: August 1st, 2026 (00:00:00 UTC)
export const AUG_1_2026_TIMESTAMP = 1785542400; // 2026-08-01 00:00:00 UTC

export const DEFAULT_ACCOUNTS = [
  { id: 'zelle', name: 'Zelle', currency: 'USD' as const, initialBalance: 0 },
  { id: 'binance', name: 'Binance', currency: 'USD' as const, initialBalance: 0 },
  { id: 'efectivo', name: 'Efectivo', currency: 'USD' as const, initialBalance: 0 },
  { id: 'bolivares', name: 'Bolívares', currency: 'VES' as const, initialBalance: 0 },
];

/**
 * Maps payment method string to treasury account ID
 */
export function mapPaymentMethodToAccount(method: string, currency: string): string {
  const m = (method || '').toLowerCase().trim();
  if (currency === 'VES' || m.includes('bolívares') || m.includes('bolivares') || m.includes('pago móvil') || m.includes('pago movil') || m.includes('ves')) {
    return 'bolivares';
  }
  if (m.includes('binance')) return 'binance';
  if (m.includes('efectivo') || m.includes('cash')) return 'efectivo';
  return 'zelle'; // Default USD account for Zelle / Transferencia
}

/**
 * Ensures standard accounts exist in the DB
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureTreasuryAccountsExist(db: any) {
  const existing = await db.select().from(schema.treasuryAccounts);
  const existingMap = new Map(existing.map((a: { id: string }) => [a.id, a]));

  const timestampNow = Math.floor(Date.now() / 1000);

  for (const acc of DEFAULT_ACCOUNTS) {
    if (!existingMap.has(acc.id)) {
      await db.insert(schema.treasuryAccounts).values({
        id: acc.id,
        name: acc.name,
        currency: acc.currency,
        initialBalance: acc.initialBalance,
        initialBalanceDate: AUG_1_2026_TIMESTAMP,
        isActive: true,
        updatedAt: timestampNow,
      });
    }
  }
}

/**
 * Calculates current real-time balances for all accounts starting from Aug 1st, 2026
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function calculateTreasuryBalances(db: any, startDate: number = AUG_1_2026_TIMESTAMP): Promise<Record<string, TreasuryAccountBalance>> {
  await ensureTreasuryAccountsExist(db);

  // 1. Fetch Accounts
  const dbAccounts = await db.select().from(schema.treasuryAccounts);

  // 2. Fetch Active Payments since startDate
  const payments = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.status, 'active'),
        gte(schema.payments.paymentDate, startDate)
      )
    );

  // 3. Fetch Expenses since startDate
  const expenses = await db
    .select()
    .from(schema.expenses)
    .where(gte(schema.expenses.expenseDate, startDate));

  // 4. Fetch Inter-account Transfers since startDate
  const transfers = await db
    .select()
    .from(schema.treasuryTransfers)
    .where(gte(schema.treasuryTransfers.transferDate, startDate));

  // 5. Fetch Adjustments since startDate
  const adjustments = await db
    .select()
    .from(schema.treasuryAdjustments)
    .where(gte(schema.treasuryAdjustments.adjustmentDate, startDate));

  // Initialize data structures
  const result: Record<string, TreasuryAccountBalance> = {};

  for (const acc of dbAccounts) {
    result[acc.id] = {
      id: acc.id,
      name: acc.name,
      currency: acc.currency as 'USD' | 'VES',
      initialBalance: Number(acc.initialBalance) || 0,
      initialBalanceDate: acc.initialBalanceDate || startDate,
      inflows: 0,
      outflows: 0,
      transfersIn: 0,
      transfersOut: 0,
      adjustmentsIn: 0,
      adjustmentsOut: 0,
      currentBalance: Number(acc.initialBalance) || 0,
    };
  }

  // Process Payments (Inflows from sales / cobros)
  for (const p of payments) {
    const accId = mapPaymentMethodToAccount(p.paymentMethod, p.currency);
    const amt = Number(p.amount) || 0;
    if (result[accId]) {
      result[accId].inflows += amt;
    }
  }

  // Process Expenses (Outflows)
  for (const e of expenses) {
    const accId = mapPaymentMethodToAccount(e.paymentMethod || '', e.currency);
    const amt = Number(e.amountOriginal) || 0;
    if (result[accId]) {
      result[accId].outflows += amt;
    }
  }

  // Process Transfers
  for (const t of transfers) {
    const fromId = t.fromAccountId;
    const toId = t.toAccountId;
    const amtFrom = Number(t.amountFrom) || 0;
    const amtTo = Number(t.amountTo) || 0;

    if (result[fromId]) {
      result[fromId].transfersOut += amtFrom;
    }
    if (result[toId]) {
      result[toId].transfersIn += amtTo;
    }
  }

  // Process Adjustments
  for (const adj of adjustments) {
    const accId = adj.accountId;
    const amt = Number(adj.amount) || 0;
    if (result[accId]) {
      if (adj.type === 'inflow') {
        result[accId].adjustmentsIn += amt;
      } else {
        result[accId].adjustmentsOut += amt;
      }
    }
  }

  // Calculate Net Current Balances
  for (const key of Object.keys(result)) {
    const b = result[key];
    b.inflows = Number(b.inflows.toFixed(2));
    b.outflows = Number(b.outflows.toFixed(2));
    b.transfersIn = Number(b.transfersIn.toFixed(2));
    b.transfersOut = Number(b.transfersOut.toFixed(2));
    b.adjustmentsIn = Number(b.adjustmentsIn.toFixed(2));
    b.adjustmentsOut = Number(b.adjustmentsOut.toFixed(2));

    const totalNet =
      b.initialBalance +
      b.inflows -
      b.outflows +
      b.transfersIn -
      b.transfersOut +
      b.adjustmentsIn -
      b.adjustmentsOut;

    b.currentBalance = Number(totalNet.toFixed(2));
  }

  return result;
}

/**
 * Returns full chronological movements statement for auditing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTreasuryMovementsStatement(
  db: any,
  accountId?: string,
  fromDate: number = AUG_1_2026_TIMESTAMP,
  toDate?: number
): Promise<AccountMovement[]> {
  await ensureTreasuryAccountsExist(db);

  const dbAccounts = await db.select().from(schema.treasuryAccounts);
  const accountMap = new Map<string, { name: string; currency: 'USD' | 'VES' }>(
    dbAccounts.map((a: { id: string; name: string; currency: string }) => [
      a.id,
      { name: a.name, currency: a.currency as 'USD' | 'VES' },
    ])
  );

  const rawEvents: Array<{
    id: string;
    date: number;
    type: 'cobro' | 'gasto' | 'transfer_in' | 'transfer_out' | 'adjustment_in' | 'adjustment_out';
    accountId: string;
    description: string;
    reference?: string | null;
    amount: number; // positive for in, negative for out
  }> = [];

  // 1. Payments
  const payments = await db
    .select({
      id: schema.payments.id,
      date: schema.payments.paymentDate,
      amount: schema.payments.amount,
      currency: schema.payments.currency,
      method: schema.payments.paymentMethod,
      ref: schema.payments.reference,
      clientName: schema.users.name,
    })
    .from(schema.payments)
    .innerJoin(schema.users, eq(schema.payments.clientId, schema.users.id))
    .where(
      and(
        eq(schema.payments.status, 'active'),
        gte(schema.payments.paymentDate, fromDate),
        toDate ? lte(schema.payments.paymentDate, toDate) : undefined
      )
    );

  for (const p of payments) {
    const accId = mapPaymentMethodToAccount(p.method, p.currency);
    rawEvents.push({
      id: p.id,
      date: p.date,
      type: 'cobro',
      accountId: accId,
      description: `Cobro de cliente: ${p.clientName || 'Cliente'} (${p.method})`,
      reference: p.ref,
      amount: Number(p.amount) || 0,
    });
  }

  // 2. Expenses
  const expenses = await db
    .select()
    .from(schema.expenses)
    .where(
      and(
        gte(schema.expenses.expenseDate, fromDate),
        toDate ? lte(schema.expenses.expenseDate, toDate) : undefined
      )
    );

  for (const e of expenses) {
    const accId = mapPaymentMethodToAccount(e.paymentMethod || '', e.currency);
    rawEvents.push({
      id: e.id,
      date: e.expenseDate,
      type: 'gasto',
      accountId: accId,
      description: `Gasto: ${e.description}`,
      reference: e.paymentMethod,
      amount: -(Number(e.amountOriginal) || 0),
    });
  }

  // 3. Transfers
  const transfers = await db
    .select({
      id: schema.treasuryTransfers.id,
      date: schema.treasuryTransfers.transferDate,
      fromAccountId: schema.treasuryTransfers.fromAccountId,
      toAccountId: schema.treasuryTransfers.toAccountId,
      amountFrom: schema.treasuryTransfers.amountFrom,
      amountTo: schema.treasuryTransfers.amountTo,
      ref: schema.treasuryTransfers.reference,
      notes: schema.treasuryTransfers.notes,
    })
    .from(schema.treasuryTransfers)
    .where(
      and(
        gte(schema.treasuryTransfers.transferDate, fromDate),
        toDate ? lte(schema.treasuryTransfers.transferDate, toDate) : undefined
      )
    );

  for (const t of transfers) {
    const fromAcc = accountMap.get(t.fromAccountId)?.name || t.fromAccountId;
    const toAcc = accountMap.get(t.toAccountId)?.name || t.toAccountId;

    // Outflow from origin
    rawEvents.push({
      id: `${t.id}-out`,
      date: t.date,
      type: 'transfer_out',
      accountId: t.fromAccountId,
      description: `Transferencia enviada a ${toAcc}${t.notes ? ` (${t.notes})` : ''}`,
      reference: t.ref,
      amount: -(Number(t.amountFrom) || 0),
    });

    // Inflow to destination
    rawEvents.push({
      id: `${t.id}-in`,
      date: t.date,
      type: 'transfer_in',
      accountId: t.toAccountId,
      description: `Transferencia recibida desde ${fromAcc}${t.notes ? ` (${t.notes})` : ''}`,
      reference: t.ref,
      amount: Number(t.amountTo) || 0,
    });
  }

  // 4. Adjustments
  const adjustments = await db
    .select()
    .from(schema.treasuryAdjustments)
    .where(
      and(
        gte(schema.treasuryAdjustments.adjustmentDate, fromDate),
        toDate ? lte(schema.treasuryAdjustments.adjustmentDate, toDate) : undefined
      )
    );

  for (const adj of adjustments) {
    const isGain = adj.type === 'inflow';
    rawEvents.push({
      id: adj.id,
      date: adj.adjustmentDate,
      type: isGain ? 'adjustment_in' : 'adjustment_out',
      accountId: adj.accountId,
      description: `Ajuste de saldo: ${adj.reason}${adj.notes ? ` (${adj.notes})` : ''}`,
      reference: isGain ? 'Ingreso/Ajuste (+)' : 'Egreso/Ajuste (-)',
      amount: isGain ? (Number(adj.amount) || 0) : -(Number(adj.amount) || 0),
    });
  }

  // Filter by account if requested
  const filteredEvents = accountId
    ? rawEvents.filter((ev) => ev.accountId === accountId)
    : rawEvents;

  // Sort ascending by date
  filteredEvents.sort((a, b) => a.date - b.date);

  // Compute running balance per account
  const runningBalances = new Map<string, number>();
  for (const acc of dbAccounts) {
    runningBalances.set(acc.id, Number(acc.initialBalance) || 0);
  }

  const movements: AccountMovement[] = [];

  for (const ev of filteredEvents) {
    const acc = accountMap.get(ev.accountId);
    const prevBalance = runningBalances.get(ev.accountId) || 0;
    const newBalance = Number((prevBalance + ev.amount).toFixed(2));
    runningBalances.set(ev.accountId, newBalance);

    movements.push({
      id: ev.id,
      date: ev.date,
      type: ev.type,
      accountId: ev.accountId,
      accountName: acc?.name || ev.accountId,
      currency: acc?.currency || 'USD',
      description: ev.description,
      reference: ev.reference,
      amount: ev.amount,
      runningBalance: newBalance,
    });
  }

  // Return reverse (latest first) for display
  return movements.reverse();
}
