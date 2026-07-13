// ============================================
// SJ Lab — Users API (GET / POST)
// ============================================

import { desc, eq, like, or } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const role = url.searchParams.get('role') || '';

    const conditions = [];
    if (search) {
      conditions.push(or(
        like(schema.users.name, `%${search}%`),
        like(schema.users.email, `%${search}%`)
      ));
    }
    if (role) {
      conditions.push(eq(schema.users.role, role as 'admin' | 'tech' | 'client'));
    }

    let query = db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        phone: schema.users.phone,
        clinicName: schema.users.clinicName,
        role: schema.users.role,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users);

    if (conditions.length === 1) {
      query = query.where(conditions[0]) as typeof query;
    } else if (conditions.length > 1) {
      // drizzle-orm `and` flattens arrays
      const { and } = await import('drizzle-orm');
      query = query.where(and(...conditions)) as typeof query;
    }

    const data = await query.orderBy(desc(schema.users.createdAt));

    return Response.json({ data });
  } catch (error) {
    console.error('GET /api/users error:', error);
    return Response.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const body = await request.json();
    const { name, email, password, role: newRole, phone, clinicName, address } = body;

    if (!name?.trim() || !email?.trim() || !password || !newRole) {
      return Response.json({ error: 'Nombre, email, contraseña y rol son requeridos' }, { status: 400 });
    }

    const validRoles = ['admin', 'tech', 'client', 'delivery'];
    if (!validRoles.includes(newRole)) {
      return Response.json({ error: 'Rol inválido' }, { status: 400 });
    }

    // Check existing email
    const existing = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email.trim().toLowerCase()));
    if (existing.length > 0) {
      return Response.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 });
    }

    // Hash password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.insert(schema.users).values({
      id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      phone: phone?.trim() || null,
      clinicName: clinicName?.trim() || null,
      address: address?.trim() || null,
      role: newRole,
      isActive: true,
      mustChangePassword: true,
      createdAt: now,
    });

    return Response.json({ data: { id } }, { status: 201 });
  } catch (error) {
    console.error('POST /api/users error:', error);
    return Response.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}
