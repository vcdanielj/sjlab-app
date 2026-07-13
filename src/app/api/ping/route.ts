// ============================================
// SJ Lab — Ping API (Zero dependencies)
// ============================================


export async function GET() {
  return Response.json({ ping: 'pong', timestamp: Date.now() });
}
