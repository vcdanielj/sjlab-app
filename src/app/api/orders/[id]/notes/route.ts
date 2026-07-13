// ============================================
// SJ Lab — Order Notes API
// ============================================


import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { generateId, now } from '@/lib/utils';
import { getSession } from '@/lib/session';

// POST /api/orders/[id]/notes — Add a note to an order
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { content } = body as { content?: string };

    if (!content?.trim()) {
      return Response.json({ error: 'El contenido es requerido' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
    });

    if (!order) {
      return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const noteId = generateId();
    const timestamp = now();

    await db.insert(schema.orderNotes).values({
      id: noteId,
      orderId: id,
      userId: session.id,
      content: content.trim(),
      createdAt: timestamp,
    });

    return Response.json({
      data: {
        id: noteId,
        content: content.trim(),
        createdAt: timestamp,
        userName: session.name,
      },
    }, { status: 201 });
  } catch {
    return Response.json({ error: 'Error al agregar nota' }, { status: 500 });
  }
}
