// ============================================
// SJ Lab — Client Status API
// ============================================


import { eq, and } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// PATCH /api/clients/[id]/status — Toggle client active/inactive
export async function PATCH(
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
    const { isActive } = body as { isActive?: boolean };

    if (typeof isActive !== 'boolean') {
      return Response.json({ error: 'isActive es requerido (boolean)' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const existing = await db.query.users.findFirst({
      where: and(eq(schema.users.id, id), eq(schema.users.role, 'client')),
    });

    if (!existing) {
      return Response.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    await db
      .update(schema.users)
      .set({ isActive })
      .where(eq(schema.users.id, id));

    return Response.json({
      data: { id, isActive },
    });
  } catch {
    return Response.json({ error: 'Error al cambiar estado' }, { status: 500 });
  }
}
