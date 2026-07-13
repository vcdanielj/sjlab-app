// ============================================
// SJ Lab — Password Hashing (Edge-Compatible)
// ============================================
// Uses Web Crypto API (PBKDF2) — works in Cloudflare Workers / Edge Runtime.

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Hash a password using PBKDF2 with a random salt.
 * Returns "salt:hash" as hex strings.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt);
  const hashBuffer = await crypto.subtle.exportKey('raw', key);
  const hashHex = bufferToHex(new Uint8Array(hashBuffer));
  const saltHex = bufferToHex(salt);
  return `${saltHex}:${hashHex}`;
}

/**
 * Verify a password against a stored "salt:hash" string.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, storedHashHex] = stored.split(':');
  if (!saltHex || !storedHashHex) return false;

  const salt = hexToBuffer(saltHex);
  const key = await deriveKey(password, salt);
  const hashBuffer = await crypto.subtle.exportKey('raw', key);
  const computedBytes = new Uint8Array(hashBuffer);
  const storedBytes = hexToBuffer(storedHashHex);

  // Constant-time comparison to prevent timing attacks
  if (computedBytes.length !== storedBytes.length) return false;
  let result = 0;
  for (let i = 0; i < computedBytes.length; i++) {
    result |= computedBytes[i] ^ storedBytes[i];
  }
  return result === 0;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH * 8 },
    true,
    ['encrypt']
  );
}

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
