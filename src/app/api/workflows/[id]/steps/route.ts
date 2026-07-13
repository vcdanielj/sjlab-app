// ============================================
// SJ Lab — Workflow Steps API
// ============================================


import { eq, asc, max } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { generateId } from '@/lib/utils';
import { getSession } from '@/lib/session';

// GET /api/workflows/[id]/steps — List steps for a workflow
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: workflowId } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const steps = await db
      .select()
      .from(schema.workflowSteps)
      .where(eq(schema.workflowSteps.workflowId, workflowId))
      .orderBy(asc(schema.workflowSteps.sortOrder));

    return Response.json({ data: steps });
  } catch {
    return Response.json({ error: 'Error al listar pasos' }, { status: 500 });
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: workflowId } = await params;
    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name?.trim()) {
      return Response.json({ error: 'El nombre del paso es requerido' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Verify workflow exists
    const workflow = await db.query.workflows.findFirst({
      where: eq(schema.workflows.id, workflowId),
    });

    if (!workflow) {
      return Response.json({ error: 'Flujo no encontrado' }, { status: 404 });
    }

    // Get the next sort order
    const [maxOrder] = await db
      .select({ maxSort: max(schema.workflowSteps.sortOrder) })
      .from(schema.workflowSteps)
      .where(eq(schema.workflowSteps.workflowId, workflowId));

    const nextOrder = (maxOrder?.maxSort ?? 0) + 1;

    const stepId = generateId();
    await db.insert(schema.workflowSteps).values({
      id: stepId,
      workflowId,
      name: name.trim(),
      sortOrder: nextOrder,
      isActive: true,
    });

    const step = await db.query.workflowSteps.findFirst({
      where: eq(schema.workflowSteps.id, stepId),
    });

    return Response.json({ data: step }, { status: 201 });
  } catch {
    return Response.json({ error: 'Error al agregar paso' }, { status: 500 });
  }
}

// PATCH /api/workflows/[id]/steps — Reorder steps (batch update sort_order)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: workflowId } = await params;
    const body = await request.json();
    const { stepIds } = body as { stepIds?: string[] };

    if (!stepIds || !Array.isArray(stepIds) || stepIds.length === 0) {
      return Response.json({ error: 'stepIds es requerido (array de IDs en el nuevo orden)' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Batch update sort_order
    for (let i = 0; i < stepIds.length; i++) {
      await db
        .update(schema.workflowSteps)
        .set({ sortOrder: i + 1 })
        .where(eq(schema.workflowSteps.id, stepIds[i]));
    }

    // Return updated steps
    const steps = await db
      .select()
      .from(schema.workflowSteps)
      .where(eq(schema.workflowSteps.workflowId, workflowId))
      .orderBy(asc(schema.workflowSteps.sortOrder));

    return Response.json({ data: steps });
  } catch {
    return Response.json({ error: 'Error al reordenar pasos' }, { status: 500 });
  }
}
