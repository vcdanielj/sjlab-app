// ============================================
// SJ Lab — Client Statement PDF API
// ============================================


import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { generateStatementPdf } from '@/lib/pdf';
import { now } from '@/lib/utils';
import { sendStatementReminderEmail, getClientFinancials } from '@/lib/email';

// GET /api/clients/[id]/statement — Generate and return PDF statement
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;

    // Portal security: clients can only get their own statement
    if (session.role === 'client' && session.id !== id) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Fetch client
    const client = await db.query.users.findFirst({
      where: and(
        eq(schema.users.id, id),
        eq(schema.users.role, 'client')
      ),
    });

    if (!client) {
      return Response.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Fetch orders for this client (non-cancelled)
    const clientOrders = await db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        patientName: schema.orders.patientName,
        finalPriceUsd: schema.orders.finalPriceUsd,
        createdAt: schema.orders.createdAt,
        productName: schema.products.name,
      })
      .from(schema.orders)
      .leftJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .where(and(
        eq(schema.orders.clientId, id),
        sql`${schema.orders.status} != 'cancelled'`
      ))
      .orderBy(asc(schema.orders.createdAt));

    // Fetch active payments for this client
    const clientPayments = await db
      .select()
      .from(schema.payments)
      .where(
        and(
          eq(schema.payments.clientId, id),
          eq(schema.payments.status, 'active')
        )
      )
      .orderBy(asc(schema.payments.paymentDate));

    // Build a chronological list of movements
    interface Movement {
      date: number;
      concept: string;
      charge: number;
      credit: number;
    }

    const movements: Movement[] = [];

    // Add order charges
    for (const order of clientOrders) {
      const productLabel = order.productName || 'Producto';
      movements.push({
        date: order.createdAt,
        concept: `Pedido #${order.orderNumber} — ${order.patientName} (${productLabel})`,
        charge: order.finalPriceUsd,
        credit: 0,
      });
    }

    // Add payment credits
    for (const payment of clientPayments) {
      const methodLabel = payment.paymentMethod;
      const refLabel = payment.reference ? ` (Ref: ${payment.reference})` : '';
      movements.push({
        date: payment.paymentDate,
        concept: `Pago ${payment.currency} — ${methodLabel}${refLabel}`,
        charge: 0,
        credit: payment.amountUsd,
      });
    }

    // Sort chronologically
    movements.sort((a, b) => a.date - b.date);

    // Calculate net balance (positive = client has credit, negative = client owes)
    const totalCharged = movements.reduce((sum, m) => sum + m.charge, 0);
    const totalCredited = movements.reduce((sum, m) => sum + m.credit, 0);
    const netBalance = totalCredited - totalCharged;

    // Generate PDF
    const pdfBytes = generateStatementPdf({
      client: {
        name: client.name,
        clinicName: client.clinicName,
        email: client.email,
        phone: client.phone,
        taxId: client.taxId,
      },
      movements,
      netBalance,
      generatedAt: now(),
    });

    // Return as downloadable PDF
    const filename = `estado_cuenta_${client.name.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`;

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Error generating statement PDF:', err);
    return Response.json({ error: 'Error al generar el PDF' }, { status: 500 });
  }
}

// POST /api/clients/[id]/statement — Send payment reminder email (admin only, only if debt exists)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const { env, ctx } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Verify client exists and is a client
    const client = await db.query.users.findFirst({
      where: and(
        eq(schema.users.id, id),
        eq(schema.users.role, 'client')
      ),
    });

    if (!client) {
      return Response.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Calculate financials
    const financials = await getClientFinancials(db, id);

    if (financials.balance >= 0) {
      return Response.json({ error: 'El cliente no tiene deudas pendientes' }, { status: 400 });
    }

    // Send statement reminder in background
    ctx.waitUntil(
      sendStatementReminderEmail({
        clientId: id,
        db,
      })
    );

    return Response.json({ success: true, message: 'Correo enviado a cola en segundo plano' });
  } catch (err) {
    console.error('Error sending statement email:', err);
    return Response.json({ error: 'Error al procesar el envío de correo' }, { status: 500 });
  }
}
