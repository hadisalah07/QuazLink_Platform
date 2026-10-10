import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found.' });
    }

    const isSuperAdmin =
      user.email.toLowerCase() === 'hadisalah07@gmail.com' || user.role === 'admin';

    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
    }

    (req as any).currentUser = user;
    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
