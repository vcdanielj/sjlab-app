// ============================================
// SJ Lab — Portal Orders API
// ============================================


import { eq, desc, asc, and, sql } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { buildOrderProgressSummary } from '@/lib/order-prosthesis';

// GET /api/portal/orders — Client's orders with workflow progress
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status') || 'all';

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Build status filter
    let statusCondition;
    if (statusFilter === 'active') {
      statusCondition = eq(schema.orders.status, 'active');
    } else if (statusFilter === 'completed') {
      statusCondition = eq(schema.orders.status, 'completed');
    } else if (statusFilter === 'delivered') {
      statusCondition = eq(schema.orders.status, 'delivered');
    }

    const whereConditions = statusCondition
      ? and(eq(schema.orders.clientId, session.id), statusCondition)
      : eq(schema.orders.clientId, session.id);

    // Get orders
    const orders = await db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        patientName: schema.orders.patientName,
        finalPriceUsd: schema.orders.finalPriceUsd,
        amountPaidUsd: schema.orders.amountPaidUsd,
        status: schema.orders.status,
        currentStepId: schema.orders.currentStepId,
        createdAt: schema.orders.createdAt,
        completedAt: schema.orders.completedAt,
        deliveredAt: schema.orders.deliveredAt,
        productName: schema.products.name,
        workflowId: schema.products.workflowId,
        currentStepName: schema.workflowSteps.name,
      })
      .from(schema.orders)
      .leftJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .leftJoin(schema.workflowSteps, eq(schema.orders.currentStepId, schema.workflowSteps.id))
      .where(whereConditions)
      .orderBy(desc(schema.orders.createdAt))
      .limit(50);

    const orderIds = orders.map((order) => order.id);
    const jobRows = orderIds.length === 0
      ? []
      : await db
          .select({
            orderId: schema.orderProsthesisJobs.orderId,
            patientName: schema.orderProsthesisJobs.patientName,
            status: schema.orderProsthesisJobs.status,
            productName: schema.products.name,
            categoryName: schema.categories.name,
          })
          .from(schema.orderProsthesisJobs)
          .innerJoin(schema.products, eq(schema.orderProsthesisJobs.productId, schema.products.id))
          .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
          .where(sql`${schema.orderProsthesisJobs.orderId} IN (${sql.join(orderIds.map((itemId) => sql`${itemId}`), sql`, `)})`)
          .orderBy(asc(schema.orderProsthesisJobs.sortOrder));

    const jobsByOrder = new Map<string, typeof jobRows>();
    for (const job of jobRows) {
      const collection = jobsByOrder.get(job.orderId) || [];
      collection.push(job);
      jobsByOrder.set(job.orderId, collection);
    }

    // Get workflow steps for progress bars
    // Collect unique workflow IDs
    const workflowIds = [...new Set(
      orders.map((o) => o.workflowId).filter((id): id is string => id !== null)
    )];

    const stepsMap: Record<string, Array<{ id: string; name: string; sortOrder: number }>> = {};

    for (const wfId of workflowIds) {
      const steps = await db
        .select({
          id: schema.workflowSteps.id,
          name: schema.workflowSteps.name,
          sortOrder: schema.workflowSteps.sortOrder,
        })
        .from(schema.workflowSteps)
        .where(and(
          eq(schema.workflowSteps.workflowId, wfId),
          eq(schema.workflowSteps.isActive, true)
        ))
        .orderBy(asc(schema.workflowSteps.sortOrder));

      stepsMap[wfId] = steps;
    }

    // Enrich orders with progress data
    const enrichedOrders = orders.map((order) => {
      const jobs = jobsByOrder.get(order.id) || [{
        orderId: order.id,
        patientName: order.patientName,
        status: order.status === 'completed' || order.status === 'delivered' ? 'completed' as const : 'pending' as const,
        productName: order.productName,
        categoryName: null,
      }];
      const jobsProgress = buildOrderProgressSummary(
        jobs.map((job, index) => ({
          id: `${order.id}-${index}`,
          patientName: job.patientName,
          status: job.status,
          productName: job.productName,
          categoryName: job.categoryName,
        }))
      );
      const steps = order.workflowId ? stepsMap[order.workflowId] || [] : [];
      const currentStepIndex = steps.findIndex((s) => s.id === order.currentStepId);
      const totalSteps = steps.length;
      const categoryNames = [...new Set(jobs.map((job) => job.categoryName).filter(Boolean))] as string[];

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        patientName: order.patientName,
        finalPriceUsd: order.finalPriceUsd,
        amountPaidUsd: order.amountPaidUsd,
        status: order.status,
        currentStepName: order.currentStepName,
        productName: order.productName,
        productSummary: jobs.length > 1 ? `${jobs.length} trabajos` : jobs[0]?.productName || order.productName,
        categorySummary: categoryNames.join(', '),
        createdAt: order.createdAt,
        completedAt: order.completedAt,
        deliveredAt: order.deliveredAt,
        jobsProgress,
        progress: {
          currentIndex: currentStepIndex,
          totalSteps,
          steps: steps.map((s) => ({ id: s.id, name: s.name })),
        },
      };
    });

    return Response.json({ data: enrichedOrders });
  } catch {
    return Response.json({ error: 'Error al obtener pedidos' }, { status: 500 });
  }
}
