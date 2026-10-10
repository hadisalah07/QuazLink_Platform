import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { requireAuth } from '../middleware/auth';
import {
  hashPassword,
  verifyPassword,
  signToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  SESSION_COOKIE_MAX_AGE,
} from '../lib/auth';
import { extractClientIp, resolveGeoLocation } from '../lib/geoip';

const router = Router();

// Basic shape check; real validation lives in the DB unique constraint + bcrypt.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Only ever expose safe fields to the client — never passwordHash.
function safeUser(user: {
  id: string;
  email: string;
  name: string | null;
  role?: string;
  country?: string | null;
  city?: string | null;
  countryCode?: string | null;
}) {
  const isSuperAdmin = user.email.toLowerCase() === 'hadisalah07@gmail.com';
  const role = isSuperAdmin ? 'admin' : (user.role || 'user');
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    country: user.country,
    city: user.city,
    countryCode: user.countryCode,
  };
}

function issueSession(res: Response, userId: string) {
  const token = signToken({ userId });
  res.cookie(SESSION_COOKIE, token, {
    ...sessionCookieOptions(),
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
}

// POST /api/auth/signup — open public SaaS registration
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body ?? {};
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await hashPassword(password);
    const ip = extractClientIp(req);
    const loc = await resolveGeoLocation(ip, req.headers as any);
    const isSuperAdmin = normalizedEmail === 'hadisalah07@gmail.com';

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: typeof name === 'string' && name.trim() ? name.trim() : null,
        passwordHash,
        role: isSuperAdmin ? 'admin' : 'user',
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        country: loc.country,
        city: loc.city,
        countryCode: loc.countryCode,
      },
    });

    issueSession(res, user.id);
    res.status(201).json(safeUser(user));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Same generic message whether the email is unknown, the account has no
    // password set, or the password is wrong — don't leak which.
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Capture login IP and Geo Location
    const ip = extractClientIp(req);
    resolveGeoLocation(ip, req.headers as any).then(async (loc) => {
      try {
        const isSuperAdmin = normalizedEmail === 'hadisalah07@gmail.com';
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            lastLoginIp: ip,
            country: loc.country,
            city: loc.city,
            countryCode: loc.countryCode,
            ...(isSuperAdmin && user.role !== 'admin' ? { role: 'admin' } : {}),
          },
        });
      } catch {}
    }).catch(() => {});

    issueSession(res, user.id);
    res.json(safeUser({ ...user, role: user.role || (normalizedEmail === 'hadisalah07@gmail.com' ? 'admin' : 'user') }));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/logout — clear the cookie with the SAME attributes it was set
// with (minus maxAge), otherwise the browser won't remove it.
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  res.status(204).send();
});

// GET /api/auth/me — behind the guard; returns the current user for nav display.
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(safeUser(user));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
