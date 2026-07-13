// ============================================
// SJ Lab — Billing Settings API
// ============================================
// Endpoint to GET and POST automatic billing frequency settings.

import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';
import { now } from '@/lib/utils';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const setting = await db.query.systemSettings.findFirst({
      where: eq(schema.systemSettings.key, 'billing_frequency'),
    });

    return Response.json({ data: { frequency: setting?.value || 'weekly' } });
  } catch (err) {
    console.error('Error fetching billing settings:', err);
    return Response.json({ error: 'Error al obtener la configuración' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { frequency } = body as { frequency?: string };

    const validFrequencies = ['daily', 'weekly', 'fortnightly'];
    if (!frequency || !validFrequencies.includes(frequency)) {
      return Response.json({ error: 'Frecuencia inválida. Debe ser diario, semanal o quincenal.' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Upsert key 'billing_frequency'
    await db
      .insert(schema.systemSettings)
      .values({
        key: 'billing_frequency',
        value: frequency,
        updatedAt: now(),
      })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: {
          value: frequency,
          updatedAt: now(),
        },
      });

    return Response.json({ success: true, frequency });
  } catch (err) {
    console.error('Error saving billing settings:', err);
    return Response.json({ error: 'Error al guardar la configuración' }, { status: 500 });
  }
}
