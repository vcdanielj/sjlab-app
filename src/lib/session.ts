// ============================================
// SJ Lab — Session / JWT Helpers (Edge-Compatible)
// ============================================
// Lightweight JWT session management using Web Crypto API.
// Used because Auth.js requires Node.js runtime for some features.
// This gives us full Edge compatibility with Cloudflare D1.

import { cookies } from 'next/headers';

const SESSION_COOKIE = 'sjlab-session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id: string;
  userId?: string; // Alias for id (backward compatibility)
  name: string;
  email: string;
  role: 'admin' | 'tech' | 'client' | 'delivery';
  clinicName: string | null;
  mustChangePassword?: boolean;
}

interface JWTPayload {
  sub: string;
  name: string;
  email: string;
  role: 'admin' | 'tech' | 'client' | 'delivery';
  clinicName: string | null;
  mcp?: boolean; // mustChangePassword
  iat: number;
  exp: number;
}

/**
 * Get the secret key for signing JWTs.
 * In production, use AUTH_SECRET env var. Falls back to a dev key.
 */
function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET environment variable is required in production');
    }
    return 'sjlab-dev-secret-change-in-production';
  }
  return secret;
}

/**
 * Create a JWT token from a session user.
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  const payload: JWTPayload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    clinicName: user.clinicName,
    mcp: user.mustChangePassword || false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(`${encodedHeader}.${encodedPayload}`, getSecret());

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode a JWT token.
 */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = await sign(`${encodedHeader}.${encodedPayload}`, getSecret());

    if (signature !== expectedSignature) return null;

    const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload));

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      id: payload.sub,
      userId: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      clinicName: payload.clinicName,
      mustChangePassword: payload.mcp || false,
    };
  } catch {
    return null;
  }
}

/**
 * Get the current session user from cookies.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  if (!sessionCookie?.value) return null;
  return verifySessionToken(sessionCookie.value);
}

/**
 * Set the session cookie.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

/**
 * Clear the session cookie (logout).
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// ---------- Crypto Helpers ----------

async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return atob(base64);
}
