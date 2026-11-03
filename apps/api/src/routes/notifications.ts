import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/notifications
 * Retrieve notifications for current user / admin
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isSuperAdmin = user.email?.toLowerCase() === 'hadisalah07@gmail.com';
    const isAdmin = isSuperAdmin || user.role === 'admin';

    const where: any = isAdmin
      ? {
          OR: [
            { userId: user.id },
            { role: 'admin' },
          ],
        }
      : {
          userId: user.id,
        };

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({
        where: {
          ...where,
          isRead: false,
        },
      }),
    ]);

    return res.json({ items, unreadCount });
  } catch (error: any) {
    console.error('[Notifications API] Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
router.patch('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return res.json({ success: true, item: updated });
  } catch (error: any) {
    console.error('[Notifications API] Error marking notification read:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications for current user/role as read
 */
router.post('/mark-all-read', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isSuperAdmin = user.email?.toLowerCase() === 'hadisalah07@gmail.com';
    const isAdmin = isSuperAdmin || user.role === 'admin';

    const where: any = isAdmin
      ? {
          OR: [
            { userId: user.id },
            { role: 'admin' },
          ],
        }
      : {
          userId: user.id,
        };

    await prisma.notification.updateMany({
      where: {
        ...where,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Notifications API] Error marking all notifications read:', error);
    return res.status(500).json({ error: 'Failed to mark notifications as read.' });
  }
});

export default router;

