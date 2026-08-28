import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';

// Password + session-token helpers for real auth.
// Kept OUT of crypto.ts on purpose: crypto.ts is REVERSIBLE AES (for FB
// sessions/catalog keys). Passwords must be one-way hashed (bcrypt), and
// session tokens are signed (JWT) — never encrypted-and-decrypted.

const SALT_ROUNDS = 10;
const TOKEN_TTL = '7d';

export interface TokenPayload {
  userId: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET is missing or too short. Refusing to sign/verify with an insecure fallback — set it in the API .env.');
  }
  return secret;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_TTL });
}

// Returns the decoded payload, or null if the token is missing/invalid/expired.
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret());
    if (typeof decoded === 'object' && decoded && typeof (decoded as any).userId === 'string') {
      return { userId: (decoded as any).userId };
    }
    return null;
  } catch {
    return null;
  }
}

// --- Session cookie contract (shared by login/signup/logout + middleware) ---
// Keep set + clear attributes identical, or the browser won't overwrite/remove
// the cookie. Dev (http, cross-port on localhost): no Secure, no Domain.
// Prod: Secure + Domain=.quazlink.com so app.* and api.* subdomains share it.
export const SESSION_COOKIE = 'session';

const isProd = process.env.NODE_ENV === 'production';

// Attributes used to BOTH set and clear the cookie (maxAge is added only when
// setting). httpOnly keeps it out of reach of JS/XSS; sameSite 'lax' is fine
// because web + api live on the same registrable domain.
export function sessionCookieOptions(): CookieOptions {
  const cookieDomain = process.env.COOKIE_DOMAIN || '.quazlink.site';
  return {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    secure: isProd,
    ...(isProd ? { domain: cookieDomain } : {}),
  };
}

// 7 days, matching the JWT TTL.
export const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

