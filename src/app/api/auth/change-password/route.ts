// ============================================
// SJ Lab — Change Password API
// ============================================


import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession, createSessionToken, setSessionCookie } from '@/lib/session';
import { verifyPassword, hashPassword } from '@/lib/password';

// POST /api/auth/change-password
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return Response.json(
        { error: 'La contraseña actual y la nueva son requeridas' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return Response.json(
        { error: 'La nueva contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return Response.json(
        { error: 'La nueva contraseña debe ser diferente a la actual' },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Get user with current hash
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, session.id),
    });

    if (!user) {
      return Response.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return Response.json({ error: 'La contraseña actual es incorrecta' }, { status: 401 });
    }

    // Hash new password and update
    const newHash = await hashPassword(newPassword);

    await db
      .update(schema.users)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
      })
      .where(eq(schema.users.id, session.id));

    // Refresh session token (mustChangePassword is now false)
    const updatedSession = {
      ...session,
      mustChangePassword: false,
    };
    const newToken = await createSessionToken(updatedSession);
    await setSessionCookie(newToken);

    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: 'Error al cambiar la contraseña' }, { status: 500 });
  }
}
