import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { generateId, now } from '@/lib/utils';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const conditions = [];
    if (status !== 'all') {
      conditions.push(eq(schema.deliveries.status, status as 'pending' | 'proposed' | 'accepted' | 'completed' | 'cancelled'));
    }
    
    // If user is delivery, they see all pending, but only their own proposed, accepted, completed, cancelled
    if (session.role === 'delivery') {
      if (status === 'pending') {
        // They can see all pending
      } else {
        conditions.push(eq(schema.deliveries.deliveryUserId, session.id));
      }
    }

    // Combine conditions with AND
    const { and } = await import('drizzle-orm');
    const result = await db.query.deliveries.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(schema.deliveries.createdAt)],
      with: {
        order: {
          columns: { orderNumber: true, patientName: true }
        },
        client: {
          columns: { name: true, clinicName: true, phone: true }
        },
        deliveryUser: {
          columns: { name: true }
        }
      }
    });


    return Response.json({ data: result });
  } catch (error) {
    console.error('GET /api/deliveries error:', error);
    return Response.json({ error: 'Error al obtener deliveries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'tech' && session.role !== 'client' && session.role !== 'delivery')) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, clientId, serviceType, address, coordinates, contactInfo, itemsDescription, notes, deliveryUserId, amountUsd } = body;

    if (!clientId || !serviceType || !address || !contactInfo || !itemsDescription) {
      return Response.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const id = generateId();
    
    const isDirectAssignment = deliveryUserId && amountUsd !== undefined;
    
    await db.insert(schema.deliveries).values({
      id,
      orderId: orderId || null,
      clientId,
      deliveryUserId: deliveryUserId || null,
      serviceType,
      address,
      coordinates: coordinates || null,
      contactInfo,
      itemsDescription,
      status: isDirectAssignment ? 'accepted' : 'pending',
      proposedAmountUsd: isDirectAssignment ? amountUsd : null,
      finalAmountUsd: isDirectAssignment ? amountUsd : null,
      notes: notes || null,
      createdBy: session.id,
      createdAt: now(),
    });

    return Response.json({ data: { id } }, { status: 201 });
  } catch (error) {
    console.error('POST /api/deliveries error:', error);
    return Response.json({ error: 'Error al crear solicitud de delivery' }, { status: 500 });
  }
}