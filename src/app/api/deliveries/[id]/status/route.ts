import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { generateId, now } from '@/lib/utils';
import { eq } from 'drizzle-orm';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const validStatuses = ['pending', 'proposed', 'accepted', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: 'Estado inválido' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const delivery = await db.query.deliveries.findFirst({
      where: eq(schema.deliveries.id, id),
    });

    if (!delivery) {
      return Response.json({ error: 'Delivery no encontrado' }, { status: 404 });
    }

    // Logic for accepting a proposal
    if (status === 'accepted') {
      if (session.role !== 'admin' && session.role !== 'tech') {
        return Response.json({ error: 'No autorizado para aceptar propuestas' }, { status: 403 });
      }
      
      await db.update(schema.deliveries)
        .set({ status: 'accepted', finalAmountUsd: delivery.proposedAmountUsd })
        .where(eq(schema.deliveries.id, id));
        
    } else if (status === 'cancelled') {
      if (session.role !== 'admin' && session.role !== 'tech' && session.role !== 'delivery') {
        return Response.json({ error: 'No autorizado' }, { status: 403 });
      }
      
      await db.update(schema.deliveries)
        .set({ status: 'cancelled', cancelledAt: now() })
        .where(eq(schema.deliveries.id, id));
        
    } else if (status === 'completed') {
      if (session.role !== 'delivery' && session.role !== 'admin') {
        return Response.json({ error: 'No autorizado' }, { status: 403 });
      }

      await db.update(schema.deliveries)
        .set({ status: 'completed', completedAt: now() })
        .where(eq(schema.deliveries.id, id));

      // Create a delivery_payment and an expense for the laboratory automatically
      if (delivery.finalAmountUsd && delivery.finalAmountUsd > 0) {
        const paymentId = generateId();
        
        // Find a default category for delivery expenses
        let category = await db.query.expenseCategories.findFirst({
          where: eq(schema.expenseCategories.name, 'Servicios de Delivery')
        });

        if (!category) {
          const catId = generateId();
          await db.insert(schema.expenseCategories).values({
            id: catId,
            name: 'Servicios de Delivery',
            color: '#3B82F6',
            isActive: true,
          });
          category = { id: catId } as any;
        }

        const expenseId = generateId();
        
        // 1. Register the expense
        await db.insert(schema.expenses).values({
          id: expenseId,
          categoryId: category!.id,
          category: 'servicios', // Enum requirement
          amountUsd: delivery.finalAmountUsd,
          expenseDate: now(),
          description: `Pago por servicio de delivery ${id} - ${delivery.serviceType}`,
          notes: `Generado automáticamente desde el servicio de delivery.`,
          createdBy: session.id,
          createdAt: now(),
        });

        // 2. Register the delivery payment
        await db.insert(schema.deliveryPayments).values({
          id: paymentId,
          deliveryUserId: delivery.deliveryUserId!,
          expenseId: expenseId,
          amountUsd: delivery.finalAmountUsd,
          paymentDate: now(),
          reference: `DELIVERY-${id}`,
          createdBy: session.id,
          createdAt: now(),
        });
      }

    } else {
      // General update
      await db.update(schema.deliveries)
        .set({ status: status as any })
        .where(eq(schema.deliveries.id, id));
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/deliveries/[id]/status error:', error);
    return Response.json({ error: 'Error al actualizar estado' }, { status: 500 });
  }
}
