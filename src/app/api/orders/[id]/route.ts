// ============================================
// SJ Lab — Order Detail API
// ============================================


import { eq, desc, asc, sql, and } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { buildOrderProgressSummary } from '@/lib/order-prosthesis';
import { isValidOrderColor } from '@/lib/order-colors';

// GET /api/orders/[id] — Order detail with step history and notes
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

    // Get order with relations
    const order = await db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        patientName: schema.orders.patientName,
        color: schema.orders.color,
        finalPriceUsd: schema.orders.finalPriceUsd,
        amountPaidUsd: schema.orders.amountPaidUsd,
        status: schema.orders.status,
        notes: schema.orders.notes,
        createdAt: schema.orders.createdAt,
        completedAt: schema.orders.completedAt,
        deliveredAt: schema.orders.deliveredAt,
        currentStepId: schema.orders.currentStepId,
        clientId: schema.orders.clientId,
        clientName: schema.users.name,
        clientClinic: schema.users.clinicName,
        clientPhone: schema.users.phone,
        productId: schema.orders.productId,
        productName: schema.products.name,
        workflowId: schema.products.workflowId,
        currentStepName: schema.workflowSteps.name,
      })
      .from(schema.orders)
      .innerJoin(schema.users, eq(schema.orders.clientId, schema.users.id))
      .innerJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .innerJoin(schema.workflowSteps, eq(schema.orders.currentStepId, schema.workflowSteps.id))
      .where(eq(schema.orders.id, id))
      .limit(1);

    if (order.length === 0) {
      return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    // Step history
    const historyRows = await db
      .select()
      .from(schema.orderStepHistory)
      .where(eq(schema.orderStepHistory.orderId, id))
      .orderBy(asc(schema.orderStepHistory.movedAt));

    // Enrich history with step and user names
    const allStepIds = new Set<string>();
    const allUserIds = new Set<string>();
    for (const h of historyRows) {
      if (h.fromStepId) allStepIds.add(h.fromStepId);
      allStepIds.add(h.toStepId);
      allUserIds.add(h.movedBy);
    }

    // Build lookup maps
    const stepsLookup: Record<string, string> = {};
    if (allStepIds.size > 0) {
      const steps = await db.select({ id: schema.workflowSteps.id, name: schema.workflowSteps.name })
        .from(schema.workflowSteps);
      for (const s of steps) stepsLookup[s.id] = s.name;
    }
    const usersLookup: Record<string, string> = {};
    if (allUserIds.size > 0) {
      const users = await db.select({ id: schema.users.id, name: schema.users.name })
        .from(schema.users);
      for (const u of users) usersLookup[u.id] = u.name;
    }

    const stepHistory = historyRows.map((h) => ({
      id: h.id,
      fromStepName: h.fromStepId ? stepsLookup[h.fromStepId] || null : null,
      toStepName: stepsLookup[h.toStepId] || '',
      movedByName: usersLookup[h.movedBy] || '',
      movedAt: h.movedAt,
    }));

    // Notes with user names
    const noteRows = await db
      .select()
      .from(schema.orderNotes)
      .where(eq(schema.orderNotes.orderId, id))
      .orderBy(desc(schema.orderNotes.createdAt));

    const notes = noteRows.map((n) => ({
      id: n.id,
      content: n.content,
      createdAt: n.createdAt,
      userName: usersLookup[n.userId] || '',
    }));

    const prosthesisJobsRows = await db
      .select({
        id: schema.orderProsthesisJobs.id,
        patientName: schema.orderProsthesisJobs.patientName,
        isPatientException: schema.orderProsthesisJobs.isPatientException,
        exceptionReason: schema.orderProsthesisJobs.exceptionReason,
        status: schema.orderProsthesisJobs.status,
        notes: schema.orderProsthesisJobs.notes,
        sortOrder: schema.orderProsthesisJobs.sortOrder,
        completedAt: schema.orderProsthesisJobs.completedAt,
        productId: schema.orderProsthesisJobs.productId,
        productName: schema.products.name,
        categoryId: schema.categories.id,
        categoryName: schema.categories.name,
      })
      .from(schema.orderProsthesisJobs)
      .innerJoin(schema.products, eq(schema.orderProsthesisJobs.productId, schema.products.id))
      .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
      .where(eq(schema.orderProsthesisJobs.orderId, id))
      .orderBy(asc(schema.orderProsthesisJobs.sortOrder));

    const prosthesisJobs = prosthesisJobsRows.length > 0
      ? prosthesisJobsRows
      : [{
          id: `legacy-${order[0].id}`,
          patientName: order[0].patientName,
          isPatientException: false,
          exceptionReason: null,
          status: (order[0].status === 'completed' || order[0].status === 'delivered' ? 'completed' : 'pending') as 'pending' | 'completed',
          notes: null,
          sortOrder: 0,
          completedAt: order[0].completedAt,
          productId: order[0].productId,
          productName: order[0].productName,
          categoryId: null,
          categoryName: null,
        }];

    const progress = buildOrderProgressSummary(
      prosthesisJobs.map((job) => ({
        id: job.id,
        patientName: job.patientName,
        status: job.status,
        productName: job.productName,
        categoryName: job.categoryName,
      }))
    );

    // Workflow steps for context
    const workflowSteps = await db
      .select()
      .from(schema.workflowSteps)
      .where(eq(schema.workflowSteps.workflowId, order[0].workflowId))
      .orderBy(asc(schema.workflowSteps.sortOrder));

    return Response.json({
      data: {
        order: order[0],
        stepHistory,
        notes,
        prosthesisJobs,
        progress,
        workflowSteps,
      },
    });
  } catch {
    return Response.json({ error: 'Error al obtener pedido' }, { status: 500 });
  }
}

// DELETE /api/orders/[id] — Delete an order if it has no applied payments
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'tech')) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
    });

    if (!order) {
      return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const [allocationsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.paymentAllocations)
      .where(eq(schema.paymentAllocations.orderId, id));

    const allocationsCount = Number(allocationsResult?.count ?? 0);

    if (allocationsCount > 0) {
      return Response.json(
        {
          error: 'No se puede eliminar el pedido porque tiene pagos aplicados.',
          details: { paymentAllocations: allocationsCount },
        },
        { status: 409 }
      );
    }

    await db.delete(schema.orders).where(eq(schema.orders.id, id));

    return Response.json({ data: { id, deleted: true } });
  } catch {
    return Response.json({ error: 'Error al eliminar pedido' }, { status: 500 });
  }
}

// PATCH /api/orders/[id] — Update basic fields of an order
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'tech')) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { clientId, patientName, color, finalPriceUsd } = body as {
      clientId?: string;
      patientName?: string;
      color?: string | null;
      finalPriceUsd?: number;
    };

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
    });
    if (!order) {
      return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const updateData: Partial<typeof schema.orders.$inferInsert> = {};

    if (clientId !== undefined) {
      const client = await db.query.users.findFirst({
        where: eq(schema.users.id, clientId),
      });
      if (!client) {
        return Response.json({ error: 'El cliente no existe' }, { status: 404 });
      }
      updateData.clientId = clientId;
    }

    if (patientName !== undefined) {
      if (!patientName.trim()) {
        return Response.json({ error: 'El nombre del paciente no puede estar vacío' }, { status: 400 });
      }
      updateData.patientName = patientName.trim();
    }

    if (color !== undefined) {
      if (color !== null && color !== '' && !isValidOrderColor(color)) {
        return Response.json({ error: 'El color seleccionado no es válido' }, { status: 400 });
      }
      updateData.color = color || null;
    }

    if (finalPriceUsd !== undefined) {
      if (typeof finalPriceUsd !== 'number' || finalPriceUsd < 0) {
        return Response.json({ error: 'El precio debe ser un número positivo' }, { status: 400 });
      }
      updateData.finalPriceUsd = finalPriceUsd;
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: 'No hay campos para actualizar' }, { status: 400 });
    }

    // Perform database updates — try transaction first, fallback to sequential for Cloudflare D1
    try {
      await db.transaction(async (tx) => {
        await tx.update(schema.orders).set(updateData).where(eq(schema.orders.id, id));

        // If patientName was updated, update all jobs in this order that aren't patient exceptions
        if (patientName !== undefined) {
          await tx
            .update(schema.orderProsthesisJobs)
            .set({ patientName: patientName.trim() })
            .where(
              and(
                eq(schema.orderProsthesisJobs.orderId, id),
                eq(schema.orderProsthesisJobs.isPatientException, false)
              )
            );
        }
      });
    } catch (txError) {
      console.error('Update order transaction failed, falling back to sequential:', txError);
      await db.update(schema.orders).set(updateData).where(eq(schema.orders.id, id));

      if (patientName !== undefined) {
        await db
          .update(schema.orderProsthesisJobs)
          .set({ patientName: patientName.trim() })
          .where(
            and(
              eq(schema.orderProsthesisJobs.orderId, id),
              eq(schema.orderProsthesisJobs.isPatientException, false)
            )
          );
      }
    }

    return Response.json({ data: { id, updated: true } });
  } catch (err) {
    console.error('Error updating order:', err);
    return Response.json({ error: 'Error al actualizar pedido' }, { status: 500 });
  }
}
