// ============================================
// SJ Lab — Login API
// ============================================


import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { verifyPassword } from '@/lib/password';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import type { SessionUser } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return Response.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      return Response.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    if (!user.isActive) {
      return Response.json({ error: 'Tu cuenta está desactivada. Contacta al laboratorio.' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return Response.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as 'admin' | 'tech' | 'client',
      clinicName: user.clinicName,
      mustChangePassword: user.mustChangePassword,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);

    const redirectTo = user.role === 'client' ? '/portal' : '/dashboard';

    return Response.json({
      data: {
        user: sessionUser,
        redirectTo,
      },
    });
  } catch (err: unknown) {
    console.error('[LOGIN ERROR]', err instanceof Error ? err.message : err, err instanceof Error ? err.stack : '');
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
