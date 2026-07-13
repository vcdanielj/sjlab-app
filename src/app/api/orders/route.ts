// ============================================
// SJ Lab — Orders API
// ============================================


import { eq, and, sql, asc, desc } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { generateId, now } from '@/lib/utils';
import { getSession } from '@/lib/session';
import { applyActiveCreditsToOrder } from '@/lib/fifo';
import { isValidOrderColor } from '@/lib/order-colors';
import { buildOrderProgressSummary, normalizeOrderProsthesisJobs } from '@/lib/order-prosthesis';

// GET /api/orders — List orders with filters (FIFO table + tabs)
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const workflowIds = url.searchParams.get('workflows')?.split(',').filter(Boolean) || [];
    const clientId = url.searchParams.get('clientId') || '';
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'active';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'asc';

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Build conditions
    const conditions = [];

    if (status !== 'all') {
      conditions.push(eq(schema.orders.status, status as 'active' | 'completed' | 'delivered' | 'cancelled'));
    }

    if (clientId) {
      conditions.push(eq(schema.orders.clientId, clientId));
    }

    if (search) {
      conditions.push(
        sql`(${schema.orders.patientName} LIKE ${'%' + search + '%'} OR ${schema.users.name} LIKE ${'%' + search + '%'})`
      );
    }

    // If specific workflows, filter by product's workflow
    if (workflowIds.length > 0) {
      conditions.push(
        sql`${schema.products.workflowId} IN (${sql.join(workflowIds.map(id => sql`${id}`), sql`, `)})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.orders)
      .innerJoin(schema.users, eq(schema.orders.clientId, schema.users.id))
      .innerJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .innerJoin(schema.workflowSteps, eq(schema.orders.currentStepId, schema.workflowSteps.id))
      .where(whereClause);

    const total = countResult[0]?.count ?? 0;

    const orders = await db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        patientName: schema.orders.patientName,
        color: schema.orders.color,
        finalPriceUsd: schema.orders.finalPriceUsd,
        amountPaidUsd: schema.orders.amountPaidUsd,
        status: schema.orders.status,
        createdAt: schema.orders.createdAt,
        currentStepId: schema.orders.currentStepId,
        clientId: schema.orders.clientId,
        clientName: schema.users.name,
        clientClinic: schema.users.clinicName,
        productId: schema.orders.productId,
        productName: schema.products.name,
        workflowId: schema.products.workflowId,
        currentStepName: schema.workflowSteps.name,
        currentStepOrder: schema.workflowSteps.sortOrder,
      })
      .from(schema.orders)
      .innerJoin(schema.users, eq(schema.orders.clientId, schema.users.id))
      .innerJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .innerJoin(schema.workflowSteps, eq(schema.orders.currentStepId, schema.workflowSteps.id))
      .where(whereClause)
      .orderBy(
        (() => {
          if (sortBy === 'orderNumber') {
            return sortOrder === 'desc' ? desc(schema.orders.orderNumber) : asc(schema.orders.orderNumber);
          } else if (sortBy === 'patientName') {
            return sortOrder === 'desc' ? desc(schema.orders.patientName) : asc(schema.orders.patientName);
          } else if (sortBy === 'clientName') {
            return sortOrder === 'desc' ? desc(schema.users.name) : asc(schema.users.name);
          } else if (sortBy === 'productName') {
            return sortOrder === 'desc' ? desc(schema.products.name) : asc(schema.products.name);
          } else if (sortBy === 'currentStep') {
            return sortOrder === 'desc' ? desc(schema.workflowSteps.sortOrder) : asc(schema.workflowSteps.sortOrder);
          } else if (sortBy === 'finalPriceUsd') {
            return sortOrder === 'desc' ? desc(schema.orders.finalPriceUsd) : asc(schema.orders.finalPriceUsd);
          } else if (sortBy === 'balance') {
            const col = sql`${schema.orders.finalPriceUsd} - ${schema.orders.amountPaidUsd}`;
            return sortOrder === 'desc' ? desc(col) : asc(col);
          } else if (sortBy === 'createdAt') {
            return sortOrder === 'desc' ? desc(schema.orders.createdAt) : asc(schema.orders.createdAt);
          } else if (sortBy === 'status') {
            return sortOrder === 'desc' ? desc(schema.orders.status) : asc(schema.orders.status);
          } else {
            return sortOrder === 'desc' ? desc(schema.orders.createdAt) : asc(schema.orders.createdAt);
          }
        })()
      )
      .limit(limit)
      .offset(offset);

    const orderIds = orders.map((order) => order.id);
    const jobRows = orderIds.length === 0
      ? []
      : await db
          .select({
            orderId: schema.orderProsthesisJobs.orderId,
            status: schema.orderProsthesisJobs.status,
            patientName: schema.orderProsthesisJobs.patientName,
            productName: schema.products.name,
            categoryName: schema.categories.name,
          })
          .from(schema.orderProsthesisJobs)
          .innerJoin(schema.products, eq(schema.orderProsthesisJobs.productId, schema.products.id))
          .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
          .where(sql`${schema.orderProsthesisJobs.orderId} IN (${sql.join(orderIds.map((id) => sql`${id}`), sql`, `)})`)
          .orderBy(asc(schema.orderProsthesisJobs.sortOrder));

    const jobsByOrder = new Map<string, typeof jobRows>();
    for (const row of jobRows) {
      const collection = jobsByOrder.get(row.orderId) || [];
      collection.push(row);
      jobsByOrder.set(row.orderId, collection);
    }

    const enrichedOrders = orders.map((order) => {
      const jobs = jobsByOrder.get(order.id) || [{
        orderId: order.id,
        status: order.status === 'completed' || order.status === 'delivered' ? 'completed' as const : 'pending' as const,
        patientName: order.patientName,
        productName: order.productName,
        categoryName: null,
      }];
      const progress = buildOrderProgressSummary(
        jobs.map((job, index) => ({
          id: `${order.id}-${index}`,
          patientName: job.patientName,
          status: job.status,
          productName: job.productName,
          categoryName: job.categoryName,
        }))
      );
      const categoryNames = [...new Set(jobs.map((job) => job.categoryName).filter(Boolean))] as string[];

      return {
        ...order,
        jobsCount: jobs.length,
        completedJobsCount: progress.completed,
        jobsProgressPercent: progress.percent,
        jobsReady: progress.ready,
        productSummary: jobs.length > 1
          ? `${jobs.length} trabajos`
          : jobs[0]?.productName || order.productName,
        categorySummary: categoryNames.join(', '),
      };
    });

    // Get workflows with steps for column structure
    const workflows = await db.query.workflows.findMany({
      where: eq(schema.workflows.isActive, true),
      with: {
        steps: {
          where: eq(schema.workflowSteps.isActive, true),
          orderBy: [asc(schema.workflowSteps.sortOrder)],
        },
      },
    });

    // Get status counts for tabs (no workflow/search filter — global counts)
    const statusCountsRaw = await db
      .select({
        status: schema.orders.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.orders)
      .groupBy(schema.orders.status);

    const statusCounts: Record<string, number> = {};
    let allCount = 0;
    for (const row of statusCountsRaw) {
      statusCounts[row.status] = row.count;
      allCount += row.count;
    }
    statusCounts.all = allCount;

    return Response.json({
      data: {
        orders: enrichedOrders,
        workflows,
        statusCounts,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch {
    return Response.json({ error: 'Error al obtener pedidos' }, { status: 500 });
  }
}


// POST /api/orders — Create a new order
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, productId, items, patientName, color, finalPriceUsd, notes } = body as {
      clientId?: string;
      productId?: string;
      items?: Array<{
        productId?: string;
        patientName?: string;
        exceptionReason?: string;
        notes?: string;
      }>;
      patientName?: string;
      color?: string;
      finalPriceUsd?: number;
      notes?: string;
    };

    if (!clientId) return Response.json({ error: 'El cliente es requerido' }, { status: 400 });
    if (typeof finalPriceUsd !== 'number' || finalPriceUsd < 0) {
      return Response.json({ error: 'El precio debe ser un número positivo' }, { status: 400 });
    }
    if (!isValidOrderColor(color)) {
      return Response.json({ error: 'El color seleccionado no es válido' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const normalizedJobs = normalizeOrderProsthesisJobs(
      items && items.length > 0 ? items : [{ productId, patientName }],
      patientName || ''
    );
    if (normalizedJobs.error) {
      return Response.json({ error: normalizedJobs.error }, { status: 400 });
    }

    const productIds = [...new Set(normalizedJobs.jobs.map((job) => job.productId))];
    const products = await db.query.products.findMany({
      where: sql`${schema.products.id} IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})`,
    });
    const productsById = new Map(products.map((product) => [product.id, product]));
    const missingProduct = productIds.find((id) => !productsById.has(id));
    if (missingProduct) {
      return Response.json({ error: 'Una de las prótesis seleccionadas no existe' }, { status: 404 });
    }

    const firstProduct = productsById.get(normalizedJobs.jobs[0].productId);
    if (!firstProduct) {
      return Response.json({ error: 'El producto principal no fue encontrado' }, { status: 404 });
    }

    const firstStep = await db
      .select()
      .from(schema.workflowSteps)
      .where(and(
        eq(schema.workflowSteps.workflowId, firstProduct.workflowId),
        eq(schema.workflowSteps.isActive, true),
      ))
      .orderBy(asc(schema.workflowSteps.sortOrder))
      .limit(1);

    if (firstStep.length === 0) {
      return Response.json({ error: 'El flujo no tiene pasos activos' }, { status: 400 });
    }

    // Generate order number (auto-increment)
    const [lastOrder] = await db
      .select({ maxNum: sql<number>`COALESCE(MAX(${schema.orders.orderNumber}), 0)` })
      .from(schema.orders);

    const orderId = generateId();
    const timestamp = now();
    const orderNumber = (lastOrder?.maxNum ?? 0) + 1;

    // Run inside database — try transaction first, fallback to sequential
    try {
      await db.transaction(async (tx) => {
        // 1. Create order
        await tx.insert(schema.orders).values({
          id: orderId,
          orderNumber,
          clientId,
          productId: firstProduct.id,
          currentStepId: firstStep[0].id,
          patientName: patientName?.trim() || '',
          color: color || null,
          finalPriceUsd,
          amountPaidUsd: 0,
          status: 'active',
          notes: notes?.trim() || null,
          createdAt: timestamp,
        });

        // 2. Record initial step history
        await tx.insert(schema.orderStepHistory).values({
          id: generateId(),
          orderId,
          fromStepId: null,
          toStepId: firstStep[0].id,
          movedBy: session.id,
          movedAt: timestamp,
        });

        await tx.insert(schema.orderProsthesisJobs).values(
          normalizedJobs.jobs.map((job) => ({
            id: generateId(),
            orderId,
            productId: job.productId,
            patientName: job.patientName,
            isPatientException: job.isPatientException,
            exceptionReason: job.exceptionReason,
            status: 'pending' as const,
            notes: job.notes,
            sortOrder: job.sortOrder,
            createdAt: timestamp,
          }))
        );

        // 3. Automatically consume any active credit (saldo a favor) for this client using FIFO
        await applyActiveCreditsToOrder(tx, clientId, orderId, finalPriceUsd);
      });
    } catch (txError) {
      // Transaction might not be supported — fallback to sequential
      console.error('Transaction failed, falling back to sequential:', txError);
      
      // 1. Create order
      await db.insert(schema.orders).values({
        id: orderId,
        orderNumber,
        clientId,
        productId: firstProduct.id,
        currentStepId: firstStep[0].id,
        patientName: patientName?.trim() || '',
        color: color || null,
        finalPriceUsd,
        amountPaidUsd: 0,
        status: 'active',
        notes: notes?.trim() || null,
        createdAt: timestamp,
      });

      // 2. Record initial step history
      await db.insert(schema.orderStepHistory).values({
        id: generateId(),
        orderId,
        fromStepId: null,
        toStepId: firstStep[0].id,
        movedBy: session.id,
        movedAt: timestamp,
      });

      await db.insert(schema.orderProsthesisJobs).values(
        normalizedJobs.jobs.map((job) => ({
          id: generateId(),
          orderId,
          productId: job.productId,
          patientName: job.patientName,
          isPatientException: job.isPatientException,
          exceptionReason: job.exceptionReason,
          status: 'pending' as const,
          notes: job.notes,
          sortOrder: job.sortOrder,
          createdAt: timestamp,
        }))
      );

      // 3. Apply credits
      await applyActiveCreditsToOrder(db, clientId, orderId, finalPriceUsd);
    }

    return Response.json({
      data: { id: orderId, orderNumber },
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/orders error:', error);
    const message = error instanceof Error ? error.message : 'Error al crear pedido';
    return Response.json({ error: message }, { status: 500 });
  }
}
