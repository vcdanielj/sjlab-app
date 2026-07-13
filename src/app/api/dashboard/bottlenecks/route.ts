// ============================================
// SJ Lab — Dashboard Bottlenecks API
// ============================================


import { sql, eq, and, isNotNull } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/dashboard/bottlenecks?workflowId=X
// Returns average time spent per workflow step (in hours)
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const workflowId = url.searchParams.get('workflowId');

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Get all workflows (for the selector) or filter by one
    let workflowFilter;
    if (workflowId) {
      workflowFilter = eq(schema.workflowSteps.workflowId, workflowId);
    }

    // Get all steps grouped by workflow
    const stepsQuery = workflowId
      ? db
          .select({
            stepId: schema.workflowSteps.id,
            stepName: schema.workflowSteps.name,
            sortOrder: schema.workflowSteps.sortOrder,
            workflowName: schema.workflows.name,
          })
          .from(schema.workflowSteps)
          .innerJoin(schema.workflows, eq(schema.workflowSteps.workflowId, schema.workflows.id))
          .where(and(workflowFilter, eq(schema.workflowSteps.isActive, true)))
          .orderBy(schema.workflowSteps.sortOrder)
      : db
          .select({
            stepId: schema.workflowSteps.id,
            stepName: schema.workflowSteps.name,
            sortOrder: schema.workflowSteps.sortOrder,
            workflowName: schema.workflows.name,
          })
          .from(schema.workflowSteps)
          .innerJoin(schema.workflows, eq(schema.workflowSteps.workflowId, schema.workflows.id))
          .where(eq(schema.workflowSteps.isActive, true))
          .orderBy(schema.workflowSteps.sortOrder);

    const steps = await stepsQuery;

    // For each step, calculate average time spent there
    // We look at step history: when an order moved FROM this step, calculate duration
    const data: Array<{ stepName: string; workflowName: string; avgHours: number; orderCount: number }> = [];

    for (const step of steps) {
      // Find all transitions FROM this step where we also know when it arrived
      const transitions = await db
        .select({
          movedAt: schema.orderStepHistory.movedAt,
          fromStepId: schema.orderStepHistory.fromStepId,
          orderId: schema.orderStepHistory.orderId,
        })
        .from(schema.orderStepHistory)
        .where(
          and(
            eq(schema.orderStepHistory.fromStepId, step.stepId),
            isNotNull(schema.orderStepHistory.fromStepId)
          )
        );

      if (transitions.length === 0) {
        data.push({
          stepName: step.stepName,
          workflowName: step.workflowName,
          avgHours: 0,
          orderCount: 0,
        });
        continue;
      }

      // For each transition, find when the order arrived at this step
      let totalHours = 0;
      let validCount = 0;

      for (const trans of transitions) {
        // Find the transition that moved TO this step (arrival)
        const arrival = await db
          .select({ movedAt: schema.orderStepHistory.movedAt })
          .from(schema.orderStepHistory)
          .where(
            and(
              eq(schema.orderStepHistory.orderId, trans.orderId),
              eq(schema.orderStepHistory.toStepId, step.stepId)
            )
          )
          .orderBy(sql`${schema.orderStepHistory.movedAt} DESC`)
          .limit(1);

        if (arrival.length > 0) {
          const hours = (trans.movedAt - arrival[0].movedAt) / 3600;
          if (hours > 0) {
            totalHours += hours;
            validCount++;
          }
        }
      }

      data.push({
        stepName: step.stepName,
        workflowName: step.workflowName,
        avgHours: validCount > 0 ? Number((totalHours / validCount).toFixed(1)) : 0,
        orderCount: validCount,
      });
    }

    // Also get available workflows for the dropdown
    const workflowsList = await db
      .select({ id: schema.workflows.id, name: schema.workflows.name })
      .from(schema.workflows)
      .where(eq(schema.workflows.isActive, true));

    return Response.json({ data, workflows: workflowsList });
  } catch (err) {
    console.error('Error in GET /api/dashboard/bottlenecks:', err);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
