import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { resolveGeoLocation, getCountryFlag } from '../lib/geoip';

const router = Router();

// In-memory rate limiting map for contact form submissions: IP -> timestamp[]
const submitRateLimit = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxSubmissions = 5; // max 5 messages per 15 min per IP

  const timestamps = (submitRateLimit.get(ip) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxSubmissions) {
    return false;
  }
  timestamps.push(now);
  submitRateLimit.set(ip, timestamps);
  return true;
}

/**
 * POST /api/contacts
 * Public contact / support inquiry submission
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const rawIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    if (!checkRateLimit(rawIp)) {
      return res.status(429).json({
        error: 'Too many messages sent. Please wait a few minutes before submitting again.',
      });
    }

    const { name, email, phone, category, subject, message } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name is required (minimum 2 characters).' });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
      return res.status(400).json({ error: 'Subject is required (minimum 3 characters).' });
    }

    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return res.status(400).json({ error: 'Message content is required (minimum 10 characters).' });
    }

    const validCategories = [
      'subscription_renewal',
      'sales_inquiry',
      'pos_support',
      'runner_support',
      'general',
    ];
    const cleanCategory = validCategories.includes(category) ? category : 'general';
    const cleanPhone = phone && typeof phone === 'string' ? phone.trim().slice(0, 30) : null;

    // Resolve Geo location
    const geo = await resolveGeoLocation(rawIp, req.headers as Record<string, string | string[] | undefined>);

    const created = await prisma.contactMessage.create({
      data: {
        name: name.trim().slice(0, 100),
        email: email.trim().toLowerCase().slice(0, 150),
        phone: cleanPhone,
        category: cleanCategory,
        subject: subject.trim().slice(0, 200),
        message: message.trim().slice(0, 5000),
        status: 'pending',
        ipAddress: rawIp.slice(0, 50),
        country: geo.country,
        city: geo.city,
        countryCode: geo.countryCode,
      },
    });

    return res.status(201).json({
      success: true,
      messageId: created.id,
      createdAt: created.createdAt,
    });
  } catch (error: any) {
    console.error('[Contacts API] Error creating contact message:', error);
    return res.status(500).json({ error: 'Failed to submit your message. Please try again later.' });
  }
});

/**
 * GET /api/contacts/admin/list
 * Admin list endpoint with filtering & pagination
 */
router.get('/admin/list', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, category, search, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * take;

    const where: any = {};

    if (status && typeof status === 'string' && status !== 'all') {
      where.status = status;
    }

    if (category && typeof category === 'string' && category !== 'all') {
      where.category = category;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total, pendingCount, inProgressCount, resolvedCount] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.contactMessage.count({ where }),
      prisma.contactMessage.count({ where: { status: 'pending' } }),
      prisma.contactMessage.count({ where: { status: 'in_progress' } }),
      prisma.contactMessage.count({ where: { status: 'resolved' } }),
    ]);

    const formatted = items.map((item) => ({
      ...item,
      flag: getCountryFlag(item.countryCode),
    }));

    return res.json({
      items: formatted,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
      counts: {
        pending: pendingCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        all: pendingCount + inProgressCount + resolvedCount,
      },
    });
  } catch (error: any) {
    console.error('[Contacts API] Error listing admin messages:', error);
    return res.status(500).json({ error: 'Failed to retrieve inquiries.' });
  }
});

/**
 * PATCH /api/contacts/admin/:id
 * Admin update status & notes
 */
router.patch('/admin/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const data: any = {};
    if (status && typeof status === 'string') {
      const allowed = ['pending', 'in_progress', 'contacted', 'resolved', 'spam'];
      if (allowed.includes(status)) {
        data.status = status;
      }
    }
    if (typeof adminNotes === 'string') {
      data.adminNotes = adminNotes;
    }

    const updated = await prisma.contactMessage.update({
      where: { id },
      data,
    });

    return res.json({ success: true, item: updated });
  } catch (error: any) {
    console.error('[Contacts API] Error updating contact message:', error);
    return res.status(500).json({ error: 'Failed to update message.' });
  }
});

/**
 * DELETE /api/contacts/admin/:id
 * Admin delete message
 */
router.delete('/admin/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.contactMessage.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Contacts API] Error deleting contact message:', error);
    return res.status(500).json({ error: 'Failed to delete message.' });
  }
});

export default router;

