// ============================================
// SJ Lab — Client Detail API
// ============================================


import { eq, and, desc, sql } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/clients/[id] — Client detail with financial summary, orders, and payments
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Get user
    const user = await db.query.users.findFirst({
      where: and(eq(schema.users.id, id), eq(schema.users.role, 'client')),
    });

    if (!user) {
      return Response.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Financial summary
    const [financial] = await db
      .select({
        totalInvoiced: sql<number>`COALESCE(sum(${schema.orders.finalPriceUsd}), 0)`,
        orderCount: sql<number>`count(*)`,
      })
      .from(schema.orders)
      .where(and(
        eq(schema.orders.clientId, id),
        sql`${schema.orders.status} != 'cancelled'`
      ));

    const [payments] = await db
      .select({
        totalPaid: sql<number>`COALESCE(sum(${schema.payments.amountUsd}), 0)`,
        paymentCount: sql<number>`count(*)`,
      })
      .from(schema.payments)
      .where(and(
        eq(schema.payments.clientId, id),
        eq(schema.payments.status, 'active')
      ));

    // Recent orders (last 20)
    const orders = await db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        patientName: schema.orders.patientName,
        finalPriceUsd: schema.orders.finalPriceUsd,
        status: schema.orders.status,
        createdAt: schema.orders.createdAt,
        productName: schema.products.name,
        currentStepName: schema.workflowSteps.name,
      })
      .from(schema.orders)
      .leftJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .leftJoin(schema.workflowSteps, eq(schema.orders.currentStepId, schema.workflowSteps.id))
      .where(eq(schema.orders.clientId, id))
      .orderBy(desc(schema.orders.createdAt))
      .limit(20);

    // Recent payments (last 20)
    const paymentsList = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.clientId, id))
      .orderBy(desc(schema.payments.paymentDate))
      .limit(20);

    const totalInvoiced = Number(financial.totalInvoiced);
    const totalPaid = Number(payments.totalPaid);

    return Response.json({
      data: {
        client: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
          clinicName: user.clinicName,
          taxId: user.taxId,
          isActive: user.isActive,
          mustChangePassword: user.mustChangePassword,
          autoBillingEnabled: user.autoBillingEnabled,
          createdAt: user.createdAt,
        },
        financial: {
          totalInvoiced,
          totalPaid,
          balance: totalPaid - totalInvoiced,
          orderCount: Number(financial.orderCount),
          paymentCount: Number(payments.paymentCount),
        },
        orders,
        payments: paymentsList,
      },
    });
  } catch {
    return Response.json({ error: 'Error al obtener cliente' }, { status: 500 });
  }
}

// PUT /api/clients/[id] — Edit client data
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, address, clinicName, taxId, autoBillingEnabled } = body as {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      clinicName?: string;
      taxId?: string;
      autoBillingEnabled?: boolean;
    };

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const existing = await db.query.users.findFirst({
      where: and(eq(schema.users.id, id), eq(schema.users.role, 'client')),
    });

    if (!existing) {
      return Response.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const updates: Partial<typeof schema.users.$inferInsert> = {};
    if (name?.trim()) updates.name = name.trim();
    
    if (email !== undefined) {
      const emailClean = email.toLowerCase().trim();
      if (!emailClean) {
        return Response.json({ error: 'El email no puede estar vacío' }, { status: 400 });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
        return Response.json({ error: 'Email inválido' }, { status: 400 });
      }
      if (emailClean !== existing.email) {
        const duplicate = await db.query.users.findFirst({
          where: eq(schema.users.email, emailClean),
        });
        if (duplicate) {
          return Response.json({ error: 'Ya existe otro usuario registrado con este email' }, { status: 409 });
        }
        updates.email = emailClean;
      }
    }

    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (address !== undefined) updates.address = address?.trim() || null;
    if (clinicName !== undefined) updates.clinicName = clinicName?.trim() || null;
    if (taxId !== undefined) updates.taxId = taxId?.trim() || null;
    if (autoBillingEnabled !== undefined) updates.autoBillingEnabled = autoBillingEnabled;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No hay cambios' }, { status: 400 });
    }

    await db.update(schema.users).set(updates).where(eq(schema.users.id, id));

    return Response.json({ data: { id, ...updates } });
  } catch {
    return Response.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

// DELETE /api/clients/[id] — Delete only if the client has no related records
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const existing = await db.query.users.findFirst({
      where: and(eq(schema.users.id, id), eq(schema.users.role, 'client')),
    });

    if (!existing) {
      return Response.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const [ordersResult, paymentsResult, expensesResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.orders)
        .where(eq(schema.orders.clientId, id)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.payments)
        .where(eq(schema.payments.clientId, id)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.expenses)
        .where(eq(schema.expenses.createdBy, id)),
    ]);

    const relatedOrders = Number(ordersResult[0]?.count ?? 0);
    const relatedPayments = Number(paymentsResult[0]?.count ?? 0);
    const relatedExpenses = Number(expensesResult[0]?.count ?? 0);

    if (relatedOrders > 0 || relatedPayments > 0 || relatedExpenses > 0) {
      return Response.json(
        {
          error: 'No se puede eliminar el cliente porque tiene información relacionada.',
          details: {
            orders: relatedOrders,
            payments: relatedPayments,
            expenses: relatedExpenses,
          },
        },
        { status: 409 }
      );
    }

    await db.delete(schema.users).where(eq(schema.users.id, id));

    return Response.json({ data: { id, deleted: true } });
  } catch {
    return Response.json({ error: 'Error al eliminar cliente' }, { status: 500 });
  }
}

