import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import { getRatesForDate, formatDateCaracas, RATES_KV_BINDING } from '@/lib/rates';
import { getSession } from '@/lib/session';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const dateQuery = url.searchParams.get('date'); // Expect YYYY-MM-DD
    
    const dateStr = dateQuery || formatDateCaracas(new Date());

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    // Bind RATES_KV if it exists on env
    const kv = (env as { RATES_KV?: RATES_KV_BINDING }).RATES_KV;

    const rates = await getRatesForDate(db, kv, dateStr);

    return Response.json({ data: rates });
  } catch (err) {
    console.error('Error in GET /api/rates:', err);
    return Response.json({ error: 'Error al obtener tasas de cambio' }, { status: 500 });
  }
}
