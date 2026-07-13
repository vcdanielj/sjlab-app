// ============================================
// SJ Lab — Logout API
// ============================================


import { clearSessionCookie } from '@/lib/session';

export async function POST() {
  await clearSessionCookie();
  return Response.json({ data: { success: true } });
}
