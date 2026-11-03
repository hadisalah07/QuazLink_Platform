import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { telegramService } from '../services/telegramService';
import { liveHub } from '../ws/liveHub';
import prisma from '../prisma';

const router = Router();

/**
 * GET /api/telegram/settings
 * Admin get current Telegram Bot settings
 */
router.get('/settings', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const settings = await telegramService.getSettings();

    // Mask bot token for security
    let maskedToken = '';
    if (settings.botToken) {
      if (settings.botToken.length > 10) {
        maskedToken = `${settings.botToken.slice(0, 6)}••••••••${settings.botToken.slice(-4)}`;
      } else {
        maskedToken = '••••••••';
      }
    }

    return res.json({
      success: true,
      settings: {
        id: settings.id,
        botToken: maskedToken,
        isTokenConfigured: Boolean(settings.botToken),
        chatId: settings.chatId || '',
        isEnabled: settings.isEnabled,
        notifyOnNew: settings.notifyOnNew,
        lastTestedAt: settings.lastTestedAt,
        lastTestStatus: settings.lastTestStatus,
        webhookUrl: 'https://api.quazlink.site/api/telegram/webhook',
      },
    });
  } catch (error: any) {
    console.error('[Telegram API] Error getting settings:', error);
    return res.status(500).json({ error: 'Failed to get Telegram settings.' });
  }
});

/**
 * POST /api/telegram/settings
 * Admin update Telegram Bot settings & configure webhook
 */
router.post('/settings', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { botToken, chatId, isEnabled, notifyOnNew, setupWebhook } = req.body;

    const webhookUrl = 'https://api.quazlink.site/api/telegram/webhook';

    const saved = await telegramService.updateSettings({
      botToken: botToken && !botToken.includes('••••') ? botToken : undefined,
      chatId,
      isEnabled,
      notifyOnNew,
      setupWebhook: Boolean(setupWebhook),
      webhookUrl,
    });

    return res.json({
      success: true,
      settings: {
        id: saved.id,
        isTokenConfigured: Boolean(saved.botToken),
        chatId: saved.chatId || '',
        isEnabled: saved.isEnabled,
        notifyOnNew: saved.notifyOnNew,
        lastTestedAt: saved.lastTestedAt,
        lastTestStatus: saved.lastTestStatus,
      },
    });
  } catch (error: any) {
    console.error('[Telegram API] Error saving settings:', error);
    return res.status(500).json({ error: error.message || 'Failed to update Telegram settings.' });
  }
});

/**
 * POST /api/telegram/test
 * Admin send test Telegram notification
 */
router.post('/test', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { botToken, chatId } = req.body;
    const cleanToken = botToken && !botToken.includes('••••') ? botToken : undefined;

    await telegramService.sendTestNotification(cleanToken, chatId);

    return res.json({
      success: true,
      message: 'Test message sent successfully to your Telegram chat!',
    });
  } catch (error: any) {
    console.error('[Telegram API] Test error:', error);
    return res.status(400).json({ error: error.message || 'Failed to send test message.' });
  }
});

/**
 * POST /api/telegram/webhook
 * Public Telegram Webhook Endpoint
 */
router.post('/webhook', async (req: Request, res: Response) => {
  // Always acknowledge immediately with 200 OK so Telegram doesn't retry
  res.status(200).json({ ok: true });

  try {
    const update = req.body;
    if (!update) return;

    await telegramService.processWebhookUpdate(update, async (contactId, replyText, adminName) => {
      // 1. Fetch Contact Message
      const message = await prisma.contactMessage.findUnique({
        where: { id: contactId },
      });

      if (!message) {
        throw new Error(`Contact message #${contactId.slice(0, 8)} not found.`);
      }

      // 2. Update Contact in DB
      const updated = await prisma.contactMessage.update({
        where: { id: contactId },
        data: {
          adminReply: replyText.trim(),
          repliedAt: new Date(),
          repliedBy: adminName,
          status: 'contacted',
          replyStatus: 'sent',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      // 3. Create Notification for Registered Customer
      if (updated.userId) {
        const notif = await prisma.notification.create({
          data: {
            userId: updated.userId,
            type: 'contact_reply',
            title: 'رد رسمي جديد من إدارة QuazLink (عبر تيليجرام)',
            message: `قامت الإدارة بالرد على استفسارك (${message.subject}): "${replyText.trim().slice(0, 110)}..."`,
            link: '/contact',
          },
        });

        // Push real-time notification to user's bell
        liveHub.broadcastNotification({ userId: updated.userId }, notif);
      }

      // 4. Instant WebSocket broadcast to active customer browser and admin dashboard!
      liveHub.broadcastReply(contactId, updated.userId, updated);

      return { contact: updated };
    });
  } catch (err: any) {
    console.error('[Telegram API] Error handling webhook background process:', err.message);
  }
});

export default router;
