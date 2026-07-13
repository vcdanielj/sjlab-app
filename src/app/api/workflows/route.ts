// ============================================
// SJ Lab — Workflows API
// ============================================


import { eq, asc } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { generateId, now } from '@/lib/utils';
import { getSession } from '@/lib/session';

// GET /api/workflows — List all workflows with their steps
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const workflows = await db.query.workflows.findMany({
      with: {
        steps: {
          orderBy: [asc(schema.workflowSteps.sortOrder)],
        },
      },
      orderBy: [asc(schema.workflows.createdAt)],
    });

    return Response.json({ data: workflows });
  } catch {
    return Response.json({ error: 'Error al obtener flujos' }, { status: 500 });
  }
}

// POST /api/workflows — Create a new workflow with steps
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, steps } = body as { name?: string; steps?: string[] };

    if (!name?.trim()) {
      return Response.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return Response.json({ error: 'Debe incluir al menos un paso' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const workflowId = generateId();
    const timestamp = now();

    await db.insert(schema.workflows).values({
      id: workflowId,
      name: name.trim(),
      isActive: true,
      createdAt: timestamp,
    });

    for (let i = 0; i < steps.length; i++) {
      if (!steps[i]?.trim()) continue;
      await db.insert(schema.workflowSteps).values({
        id: generateId(),
        workflowId,
        name: steps[i].trim(),
        sortOrder: i + 1,
        isActive: true,
      });
    }

    // Return the created workflow with steps
    const created = await db.query.workflows.findFirst({
      where: eq(schema.workflows.id, workflowId),
      with: {
        steps: {
          orderBy: [asc(schema.workflowSteps.sortOrder)],
        },
      },
    });

    return Response.json({ data: created }, { status: 201 });
  } catch {
    return Response.json({ error: 'Error al crear flujo' }, { status: 500 });
  }
}
