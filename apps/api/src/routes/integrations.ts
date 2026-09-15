import { Router } from 'express';
import prisma from '../prisma';
import { signApiKey } from '../lib/auth';
import { dispatchJobToLocalRunner } from '../ws/gateway';

const router = Router();

/**
 * Clean and normalize phone numbers into international E.164-compatible format.
 * Examples:
 *  - "01012345678" -> "201012345678" (Egyptian local mobile)
 *  - "+201012345678" -> "201012345678"
 *  - "00966501234567" -> "966501234567"
 */
function normalizePhoneNumber(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  // Remove any non-digit character
  let clean = raw.replace(/\D/g, '');

  // Strip international 00 prefix
  if (clean.startsWith('00')) {
    clean = clean.slice(2);
  }

  // Egyptian mobile numbers: "010...", "011...", "012...", "015..." (11 digits starting with 01)
  if (clean.length === 11 && clean.startsWith('01')) {
    clean = '20' + clean.slice(1);
  }

  // Basic length validation (8 to 16 digits)
  if (clean.length < 8 || clean.length > 16) {
    return null;
  }

  return clean;
}

const DEFAULT_TEMPLATE = `أهلاً بك يا {customerName}، شرفتنا ونورتنا بشرائك من عندنا! ❤️
📄 رقم الفاتورة: #{invoiceNumber}
💰 الإجمالي: {amount} {currency}
شكراً جزيلاً لثقتك بنا ونراك قريباً إن شاء الله! ✨`;

/**
 * GET /api/integrations/config
 * Retrieves the user's permanent API Integration Key and active WhatsApp account status
 */
router.get('/config', async (req, res) => {
  try {
    const userId = req.userId!;
    const apiKey = signApiKey({ userId });

    const activeWhatsApp = await prisma.socialAccount.findFirst({
      where: { userId, platform: 'whatsapp', status: 'active' },
      select: { id: true, platform: true, status: true, lastUsedAt: true },
    });

    const host = req.get('host') || 'api.quazlink.site';
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const endpoint = `${protocol}://${host}/api/integrations/whatsapp/send`;

    res.json({
      apiKey,
      endpoint,
      activeWhatsApp,
      defaultTemplate: DEFAULT_TEMPLATE,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/integrations/whatsapp/send
 * Public Inbound Webhook / Integration endpoint to send automated customer WhatsApp invoice messages
 */
router.post('/whatsapp/send', async (req, res) => {
  try {
    const userId = req.userId!;
    const {
      phone,
      customerName = 'عميلنا العزيز',
      invoiceNumber = `INV-${Date.now().toString().slice(-6)}`,
      amount = '',
      currency = 'ج.م',
      message,
      mediaUrls = [],
      socialAccountId,
    } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Field "phone" is required.' });
    }

    const cleanPhone = normalizePhoneNumber(phone);
    if (!cleanPhone) {
      return res.status(400).json({
        error: `Invalid phone number format ("${phone}"). Please provide a valid 10-15 digit phone number (e.g. "01012345678" or "201012345678").`,
      });
    }

    // Find active WhatsApp account for this user
    let account = null;
    if (socialAccountId) {
      account = await prisma.socialAccount.findFirst({
        where: { id: socialAccountId, userId, platform: 'whatsapp' },
      });
    }

    if (!account) {
      account = await prisma.socialAccount.findFirst({
        where: { userId, platform: 'whatsapp', status: 'active' },
      });
    }

    if (!account) {
      return res.status(400).json({
        error: 'No active WhatsApp account found. Please connect and authenticate WhatsApp in QuazLink Accounts first.',
      });
    }

    // Format message content with dynamic interpolation
    const templateToUse = message && typeof message === 'string' && message.trim().length > 0
      ? message.trim()
      : DEFAULT_TEMPLATE;

    const formattedContent = templateToUse
      .replace(/\{customerName\}/gi, customerName)
      .replace(/\{invoiceNumber\}/gi, String(invoiceNumber))
      .replace(/\{amount\}/gi, String(amount || ''))
      .replace(/\{currency\}/gi, String(currency || ''))
      .replace(/\{phone\}/gi, cleanPhone);

    // Find or create integration campaign
    let campaign = await prisma.campaign.findFirst({
      where: { userId, name: 'WhatsApp Automated Customer Invoicing' },
    });

    if (!campaign) {
      campaign = await prisma.campaign.create({
        data: {
          userId,
          name: 'WhatsApp Automated Customer Invoicing',
          status: 'active',
        },
      });
    }

    // Create Post record
    const post = await prisma.post.create({
      data: {
        campaignId: campaign.id,
        content: formattedContent,
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
        status: 'processing',
      },
    });

    // Create Job record targeted directly to recipient's phone chat URL
    const targetChatUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}`;
    const job = await prisma.job.create({
      data: {
        postId: post.id,
        socialAccountId: account.id,
        targetUrl: targetChatUrl,
        status: 'pending',
      },
    });

    // Instant dispatch to Desktop Runner via WebSocket
    const isDispatched = await dispatchJobToLocalRunner(userId, {
      id: job.id,
      postId: job.postId,
      content: post.content,
      mediaUrls: post.mediaUrls,
      targetUrl: targetChatUrl,
      platform: 'whatsapp',
      socialAccountId: account.id,
    });

    res.status(201).json({
      success: true,
      jobId: job.id,
      recipient: {
        rawPhone: phone,
        cleanPhone,
        customerName,
        invoiceNumber,
        amount,
        currency,
      },
      status: isDispatched ? 'dispatched' : 'pending',
      deliveryMode: isDispatched ? 'Instant Local Runner' : 'Queued (Waiting for Desktop Runner)',
      message: 'WhatsApp customer invoice queued for instant delivery.',
    });
  } catch (error: any) {
    console.error('❌ [Integrations] Error dispatching WhatsApp invoice:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/integrations/whatsapp/send-batch
 * Send manual bulk invoices/messages to multiple customer phone numbers
 */
router.post('/whatsapp/send-batch', async (req, res) => {
  try {
    const userId = req.userId!;
    const { items = [], messageTemplate = '', currency = 'ج.م' } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Array of items/recipients is required.' });
    }

    const account = await prisma.socialAccount.findFirst({
      where: { userId, platform: 'whatsapp', status: 'active' },
    });

    if (!account) {
      return res.status(400).json({
        error: 'No active WhatsApp account found. Please connect WhatsApp in QuazLink Accounts first.',
      });
    }

    let campaign = await prisma.campaign.findFirst({
      where: { userId, name: 'WhatsApp Automated Customer Invoicing' },
    });

    if (!campaign) {
      campaign = await prisma.campaign.create({
        data: {
          userId,
          name: 'WhatsApp Automated Customer Invoicing',
          status: 'active',
        },
      });
    }

    const results = [];
    for (const item of items) {
      const cleanPhone = normalizePhoneNumber(item.phone);
      if (!cleanPhone) {
        results.push({ phone: item.phone, success: false, error: 'Invalid phone format' });
        continue;
      }

      const template = item.message || messageTemplate || DEFAULT_TEMPLATE;
      const formatted = template
        .replace(/\{customerName\}/gi, item.customerName || 'عميلنا العزيز')
        .replace(/\{invoiceNumber\}/gi, String(item.invoiceNumber || `INV-${Date.now().toString().slice(-4)}`))
        .replace(/\{amount\}/gi, String(item.amount || ''))
        .replace(/\{currency\}/gi, String(item.currency || currency))
        .replace(/\{phone\}/gi, cleanPhone);

      const post = await prisma.post.create({
        data: {
          campaignId: campaign.id,
          content: formatted,
          mediaUrls: Array.isArray(item.mediaUrls) ? item.mediaUrls : [],
          status: 'processing',
        },
      });

      const targetChatUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}`;
      const job = await prisma.job.create({
        data: {
          postId: post.id,
          socialAccountId: account.id,
          targetUrl: targetChatUrl,
          status: 'pending',
        },
      });

      const isDispatched = await dispatchJobToLocalRunner(userId, {
        id: job.id,
        postId: job.postId,
        content: post.content,
        mediaUrls: post.mediaUrls,
        targetUrl: targetChatUrl,
        platform: 'whatsapp',
        socialAccountId: account.id,
      });

      results.push({
        phone: item.phone,
        cleanPhone,
        customerName: item.customerName,
        jobId: job.id,
        success: true,
        dispatched: isDispatched,
      });
    }

    res.status(201).json({
      success: true,
      totalCount: items.length,
      dispatchedCount: results.filter(r => r.success).length,
      results,
    });
  } catch (error: any) {
    console.error('❌ [Integrations] Error dispatching batch WhatsApp invoices:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/integrations/history
 * Retrieves recent dispatched WhatsApp invoice/messaging jobs
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.userId!;
    const jobs = await prisma.job.findMany({
      where: {
        post: {
          campaign: {
            userId,
          },
        },
        socialAccount: {
          platform: 'whatsapp',
        },
      },
      include: {
        post: {
          select: { content: true, mediaUrls: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    res.json({
      success: true,
      jobs: jobs.map((j) => {
        // Extract phone number from targetUrl
        const phoneMatch = j.targetUrl?.match(/phone=(\d+)/);
        return {
          id: j.id,
          phone: phoneMatch ? phoneMatch[1] : null,
          targetUrl: j.targetUrl,
          status: j.status,
          createdAt: j.createdAt,
          content: j.post.content,
          mediaUrls: j.post.mediaUrls,
          result: j.result,
        };
      }),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
