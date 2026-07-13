// ============================================
// SJ Lab — Clients API
// ============================================


import { eq, and, like, sql, desc, asc } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { generateId, now } from '@/lib/utils';
import { hashPassword, verifyPassword } from '@/lib/password';
import { getSession } from '@/lib/session';
import { sendOnboardingEmail } from '@/lib/email';

// GET /api/clients — List clients with filters and pagination
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role === 'client') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'all'; // active, inactive, all
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Build conditions
    const conditions = [eq(schema.users.role, 'client')];

    if (status === 'active') {
      conditions.push(eq(schema.users.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(schema.users.isActive, false));
    }

    if (search) {
      conditions.push(
        sql`(${schema.users.name} LIKE ${'%' + search + '%'} OR ${schema.users.clinicName} LIKE ${'%' + search + '%'} OR ${schema.users.email} LIKE ${'%' + search + '%'})`
      );
    }

    const whereClause = and(...conditions);

    // Count total
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(whereClause);

    // Aggregate order stats per client
    const orderStats = db
      .select({
        clientId: schema.orders.clientId,
        orderCount: sql<number>`count(CASE WHEN ${schema.orders.status} != 'cancelled' THEN 1 END)`.as('order_count'),
        totalInvoiced: sql<number>`COALESCE(sum(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.finalPriceUsd} ELSE 0 END), 0)`.as('total_invoiced'),
        lastOrderAt: sql<number | null>`max(${schema.orders.createdAt})`.as('last_order_at'),
      })
      .from(schema.orders)
      .groupBy(schema.orders.clientId)
      .as('order_stats');

    // Aggregate payment stats per client
    const paymentStats = db
      .select({
        clientId: schema.payments.clientId,
        totalPaid: sql<number>`COALESCE(sum(CASE WHEN ${schema.payments.status} = 'active' THEN ${schema.payments.amountUsd} ELSE 0 END), 0)`.as('total_paid'),
      })
      .from(schema.payments)
      .groupBy(schema.payments.clientId)
      .as('payment_stats');

    const sortBy = url.searchParams.get('sortBy') || 'name';
    const sortOrder = url.searchParams.get('sortOrder') || 'asc';

    let orderByExpression;
    if (sortBy === 'name') {
      orderByExpression = sortOrder === 'desc' ? desc(schema.users.name) : asc(schema.users.name);
    } else if (sortBy === 'phone') {
      orderByExpression = sortOrder === 'desc' ? desc(schema.users.phone) : asc(schema.users.phone);
    } else if (sortBy === 'isActive') {
      orderByExpression = sortOrder === 'desc' ? desc(schema.users.isActive) : asc(schema.users.isActive);
    } else if (sortBy === 'orderCount') {
      const col = sql`COALESCE(${orderStats.orderCount}, 0)`;
      orderByExpression = sortOrder === 'desc' ? desc(col) : asc(col);
    } else if (sortBy === 'balance') {
      const col = sql`COALESCE(${paymentStats.totalPaid}, 0) - COALESCE(${orderStats.totalInvoiced}, 0)`;
      orderByExpression = sortOrder === 'desc' ? desc(col) : asc(col);
    } else if (sortBy === 'lastOrderAt') {
      const col = orderStats.lastOrderAt;
      orderByExpression = sortOrder === 'desc' ? desc(col) : asc(col);
    } else {
      orderByExpression = sortOrder === 'desc' ? desc(schema.users.name) : asc(schema.users.name);
    }

    // Get clients joined with stats
    const clients = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        phone: schema.users.phone,
        address: schema.users.address,
        clinicName: schema.users.clinicName,
        taxId: schema.users.taxId,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
        orderCount: sql<number>`COALESCE(${orderStats.orderCount}, 0)`,
        totalInvoiced: sql<number>`COALESCE(${orderStats.totalInvoiced}, 0)`,
        totalPaid: sql<number>`COALESCE(${paymentStats.totalPaid}, 0)`,
        lastOrderAt: orderStats.lastOrderAt,
      })
      .from(schema.users)
      .leftJoin(orderStats, eq(schema.users.id, orderStats.clientId))
      .leftJoin(paymentStats, eq(schema.users.id, paymentStats.clientId))
      .where(whereClause)
      .orderBy(orderByExpression)
      .limit(limit)
      .offset(offset);

    // Add calculated balance
    const enriched = clients.map((c) => ({
      ...c,
      balance: Number(c.totalPaid) - Number(c.totalInvoiced),
    }));

    return Response.json({
      data: enriched,
      meta: {
        total: Number(count),
        page,
        limit,
        totalPages: Math.ceil(Number(count) / limit),
      },
    });
  } catch {
    return Response.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

// POST /api/clients — Create a new client with temporary password
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, phone, address, clinicName, taxId } = body as {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      clinicName?: string;
      taxId?: string;
    };

    if (!name?.trim()) {
      return Response.json({ error: 'El nombre es requerido' }, { status: 400 });
    }
    if (!email?.trim()) {
      return Response.json({ error: 'El email es requerido' }, { status: 400 });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Email inválido' }, { status: 400 });
    }

    const { env, ctx } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Check for duplicate email
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      return Response.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 });
    }

    // Generate temporary password (8 chars, alphanumeric)
    const tempPassword = generateTempPassword();
    let passwordHash: string;
    try {
      passwordHash = await hashPassword(tempPassword);
      // Self-verify: ensure the hash we just created can be verified
      const selfCheck = await verifyPassword(tempPassword, passwordHash);
      if (!selfCheck) {
        console.error('[CREATE CLIENT] CRITICAL: Password self-verification failed!', {
          tempPasswordLength: tempPassword.length,
          hashLength: passwordHash.length,
          hashPrefix: passwordHash.substring(0, 20),
        });
        return Response.json({ error: 'Error interno de seguridad. Intente nuevamente.' }, { status: 500 });
      }
    } catch (hashErr) {
      console.error('[CREATE CLIENT] Password hashing failed:', hashErr);
      return Response.json({ error: 'Error al generar credenciales' }, { status: 500 });
    }

    const id = generateId();
    const timestamp = now();

    await db.insert(schema.users).values({
      id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      clinicName: clinicName?.trim() || null,
      taxId: taxId?.trim() || null,
      role: 'client',
      isActive: true,
      mustChangePassword: true,
      createdAt: timestamp,
    });

    // Send onboarding email in background
    ctx.waitUntil(
      sendOnboardingEmail({
        email: email.toLowerCase().trim(),
        name: name.trim(),
        tempPassword,
      })
    );

    return Response.json({
      data: {
        id,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        tempPassword, // Returned only on creation, never stored in plain text
      },
    }, { status: 201 });
  } catch {
    return Response.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 8; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}
