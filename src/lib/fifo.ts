// ============================================
// SJ Lab — FIFO Current Account Engine
// ============================================

import { eq, and, asc, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { generateId, now } from './utils';
import type { Database } from '@/db';

// Accept both the full database instance and transaction contexts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbOrTx = Database | Parameters<Database['transaction']>[0] extends (tx: infer T) => any ? T : never;
// Simplified: use the common subset interface
type DatabaseLike = Pick<Database, 'select' | 'insert' | 'update' | 'delete' | 'run'>;

/**
 * Apply a payment to unpaid or underpaid orders in FIFO order (oldest first).
 */
export async function applyPayment(
  db: DatabaseLike,
  clientId: string,
  amountUsd: number,
  paymentId: string
) {
  // 1. Get all pending active/completed (non-cancelled) orders for the client ordered by createdAt ASC
  const pendingOrders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.clientId, clientId),
        sql`${schema.orders.amountPaidUsd} < ${schema.orders.finalPriceUsd}`,
        sql`${schema.orders.status} != 'cancelled'`
      )
    )
    .orderBy(asc(schema.orders.createdAt));

  let availableBalance = amountUsd;
  const allocationsCreated = [];

  for (const order of pendingOrders) {
    if (availableBalance <= 0) break;

    const remaining = order.finalPriceUsd - order.amountPaidUsd;
    const allocated = Math.min(remaining, availableBalance);

    // Keep allocation strictly non-zero and avoid tiny float values due to JS precision
    if (allocated > 0.005) {
      const allocationId = generateId();
      const timestamp = now();

      // Create payment allocation
      await db.insert(schema.paymentAllocations).values({
        id: allocationId,
        paymentId,
        orderId: order.id,
        amountUsd: Number(allocated.toFixed(2)),
        createdAt: timestamp,
      });

      // Update order amount paid
      await db
        .update(schema.orders)
        .set({
          amountPaidUsd: sql`${schema.orders.amountPaidUsd} + ${Number(allocated.toFixed(2))}`,
        })
        .where(eq(schema.orders.id, order.id));

      availableBalance -= allocated;
      allocationsCreated.push({
        orderId: order.id,
        amountUsd: Number(allocated.toFixed(2)),
      });
    }
  }

  return allocationsCreated;
}

/**
 * Preview how a payment would be allocated across pending orders (Dry-run).
 */
export async function previewPaymentAllocations(
  db: DatabaseLike,
  clientId: string,
  amountUsd: number
) {
  const pendingOrders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.clientId, clientId),
        sql`${schema.orders.amountPaidUsd} < ${schema.orders.finalPriceUsd}`,
        sql`${schema.orders.status} != 'cancelled'`
      )
    )
    .orderBy(asc(schema.orders.createdAt));

  let availableBalance = amountUsd;
  const allocations = [];

  for (const order of pendingOrders) {
    if (availableBalance <= 0) break;

    const remaining = order.finalPriceUsd - order.amountPaidUsd;
    const allocated = Math.min(remaining, availableBalance);

    if (allocated > 0.005) {
      allocations.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        patientName: order.patientName,
        finalPriceUsd: order.finalPriceUsd,
        amountPaidUsd: order.amountPaidUsd,
        allocatedAmountUsd: Number(allocated.toFixed(2)),
      });
      availableBalance -= allocated;
    }
  }

  return {
    allocations,
    surplusUsd: Number(availableBalance.toFixed(2)),
  };
}

/**
 * Void a payment, reversing all allocations and restoring order balances.
 */
export async function voidPayment(db: DatabaseLike, paymentId: string) {
  // 1. Get all allocations for this payment
  const allocations = await db
    .select()
    .from(schema.paymentAllocations)
    .where(eq(schema.paymentAllocations.paymentId, paymentId));

  // 2. Subtract allocated amounts from order paid amounts
  for (const alloc of allocations) {
    await db
      .update(schema.orders)
      .set({
        amountPaidUsd: sql`MAX(0, ${schema.orders.amountPaidUsd} - ${alloc.amountUsd})`,
      })
      .where(eq(schema.orders.id, alloc.orderId));
  }

  const timestamp = now();

  // 3. Mark the payment as voided
  await db
    .update(schema.payments)
    .set({
      status: 'voided',
      voidedAt: timestamp,
    })
    .where(eq(schema.payments.id, paymentId));

  // 4. Delete payment allocations explicitly
  await db
    .delete(schema.paymentAllocations)
    .where(eq(schema.paymentAllocations.paymentId, paymentId));

  return true;
}

/**
 * Automatically assign unallocated credits (from active client payments) to a newly created order.
 */
export async function applyActiveCreditsToOrder(
  db: DatabaseLike,
  clientId: string,
  orderId: string,
  finalPriceUsd: number
) {
  // 1. Get all active payments for this client chronologically
  const activePayments = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.clientId, clientId),
        eq(schema.payments.status, 'active')
      )
    )
    .orderBy(asc(schema.payments.paymentDate), asc(schema.payments.createdAt));

  let orderRemaining = finalPriceUsd;
  const allocationsCreated = [];

  for (const payment of activePayments) {
    if (orderRemaining <= 0) break;

    // Calculate sum of allocations already made from this payment
    const [allocatedSum] = await db
      .select({
        totalAllocated: sql<number>`COALESCE(sum(${schema.paymentAllocations.amountUsd}), 0)`,
      })
      .from(schema.paymentAllocations)
      .where(eq(schema.paymentAllocations.paymentId, payment.id));

    const totalAllocated = Number(allocatedSum?.totalAllocated || 0);
    const unallocated = payment.amountUsd - totalAllocated;

    if (unallocated > 0.005) {
      const allocate = Math.min(unallocated, orderRemaining);
      const allocationId = generateId();
      const timestamp = now();

      // Create allocation record
      await db.insert(schema.paymentAllocations).values({
        id: allocationId,
        paymentId: payment.id,
        orderId,
        amountUsd: Number(allocate.toFixed(2)),
        createdAt: timestamp,
      });

      // Update order amount paid
      await db
        .update(schema.orders)
        .set({
          amountPaidUsd: sql`${schema.orders.amountPaidUsd} + ${Number(allocate.toFixed(2))}`,
        })
        .where(eq(schema.orders.id, orderId));

      orderRemaining -= allocate;
      allocationsCreated.push({
        paymentId: payment.id,
        amountUsd: Number(allocate.toFixed(2)),
      });
    }
  }

  return allocationsCreated;
}

/**
 * Apply a payment manually to specific orders.
 */
export async function applyManualAllocations(
  db: DatabaseLike,
  clientId: string,
  paymentId: string,
  allocations: { orderId: string; amountUsd: number }[],
  timestamp: number
) {
  const allocationsCreated = [];

  for (const alloc of allocations) {
    // 1. Fetch the order
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.id, alloc.orderId),
          eq(schema.orders.clientId, clientId)
        )
      );

    if (!order) {
      throw new Error(`El pedido no existe o no pertenece al cliente.`);
    }
    if (order.status === 'cancelled') {
      throw new Error(`No se puede asignar un pago a un pedido cancelado: #${order.orderNumber}`);
    }

    const remaining = order.finalPriceUsd - order.amountPaidUsd;
    if (alloc.amountUsd > remaining + 0.01) {
      throw new Error(
        `El monto asignado (${alloc.amountUsd} USD) supera el saldo pendiente (${remaining.toFixed(
          2
        )} USD) del pedido #${order.orderNumber}`
      );
    }

    const allocationId = generateId();

    // Create payment allocation
    await db.insert(schema.paymentAllocations).values({
      id: allocationId,
      paymentId,
      orderId: order.id,
      amountUsd: Number(alloc.amountUsd.toFixed(2)),
      createdAt: timestamp,
    });

    // Update order amount paid
    await db
      .update(schema.orders)
      .set({
        amountPaidUsd: sql`${schema.orders.amountPaidUsd} + ${Number(alloc.amountUsd.toFixed(2))}`,
      })
      .where(eq(schema.orders.id, order.id));

    allocationsCreated.push({
      orderId: order.id,
      amountUsd: Number(alloc.amountUsd.toFixed(2)),
    });
  }

  return allocationsCreated;
}

