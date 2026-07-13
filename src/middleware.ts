// ============================================
// SJ Lab — Route Protection Middleware (Edge)
// ============================================
// Uses middleware.ts (not proxy.ts) for Cloudflare Edge compatibility.
// Next.js 16 proxy.ts forces Node.js runtime which is incompatible
// with Cloudflare Workers. middleware.ts uses Edge runtime.

import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/session';

const PUBLIC_PATHS = ['/', '/api/auth/login', '/api/health', '/api/ping'];

const ROLE_ACCESS: Record<string, string[]> = {
  // admin can access everything
  admin: ['/dashboard', '/orders', '/clients', '/finances', '/expenses', '/delivery', '/settings', '/api'],
  // tech can access operations modules and dashboard
  tech: ['/dashboard', '/orders', '/clients', '/delivery', '/api'],
  // client can only access portal
  client: ['/portal', '/api/auth', '/api/portal', '/api/clients'],
  // delivery users only access their delivery panel and related APIs
  delivery: ['/delivery', '/api'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Get session token from cookie
  const sessionCookie = request.cookies.get('sjlab-session');
  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const user = await verifySessionToken(sessionCookie.value);
  if (!user) {
    // Invalid or expired token — redirect to login
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('sjlab-session');
    return response;
  }

  // Check role-based access
  const allowedPaths = ROLE_ACCESS[user.role] || [];
  const hasAccess = allowedPaths.some((p) => pathname.startsWith(p));

  if (!hasAccess) {
    // Redirect to their default page
    const defaultPath =
      user.role === 'client' ? '/portal' :
      user.role === 'delivery' ? '/delivery' :
      '/dashboard';
    return NextResponse.redirect(new URL(defaultPath, request.url));
  }

  // If user is logged in and trying to access login page, redirect
  if (pathname === '/') {
    const defaultPath =
      user.role === 'client' ? '/portal' :
      user.role === 'delivery' ? '/delivery' :
      '/dashboard';
    return NextResponse.redirect(new URL(defaultPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
