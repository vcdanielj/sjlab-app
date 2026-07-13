// ============================================
// SJ Lab — Health Check API (Raw D1 only)
// ============================================


import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET() {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const result = await ctx.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
    
    return Response.json({ 
      status: 'ok', 
      db: !!ctx.env.DB,
      userCount: result,
    });
  } catch (err: unknown) {
    console.error('[HEALTH ERROR]', err instanceof Error ? err.message : err);
    return Response.json({ 
      error: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 });
  }
}
