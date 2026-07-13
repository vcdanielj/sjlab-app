// ============================================
// SJ Lab — User Detail API (PUT)
// ============================================

import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { hashPassword } from '@/lib/password';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const body = await request.json();
    const { name, email, role, phone, address, clinicName, isActive, password } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email.trim().toLowerCase();
    if (role !== undefined) {
      const validRoles = ['admin', 'tech', 'client', 'delivery'];
      if (!validRoles.includes(role)) {
        return Response.json({ error: 'Rol inválido' }, { status: 400 });
      }
      updates.role = role;
    }
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (address !== undefined) updates.address = address?.trim() || null;
    if (clinicName !== undefined) updates.clinicName = clinicName?.trim() || null;
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) {
      updates.passwordHash = await hashPassword(password);
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'Sin campos para actualizar' }, { status: 400 });
    }

    await db.update(schema.users).set(updates).where(eq(schema.users.id, id));
    return Response.json({ data: { id } });
  } catch (error) {
    console.error('PUT /api/users/[id] error:', error);
    return Response.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}
