import { Request, Response, NextFunction } from 'express';
import { verifyToken, SESSION_COOKIE } from '../lib/auth';

// Make req.userId available (and typed) on every guarded route.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Extract the session JWT from either the httpOnly cookie (web dashboard) or an
// `Authorization: Bearer <jwt>` header (the future Desktop Agent). One verify
// path serves both clients.
function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return null;
}

// The real security boundary: every /api/* route behind this must present a
// valid, unexpired token. On success req.userId is set; otherwise 401.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.userId = payload.userId;
  next();
}
