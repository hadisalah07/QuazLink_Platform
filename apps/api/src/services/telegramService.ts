import prisma from '../prisma';

export interface TelegramSettingsData {
  botToken?: string;
  chatId?: string;
  isEnabled: boolean;
  notifyOnNew: boolean;
  webhookSecret?: string;
}

class TelegramService {
  /**
   * Fetch current Telegram integration settings
   */
  async getSettings() {
    let settings = await prisma.adminTelegramSetting.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.adminTelegramSetting.create({
        data: {
          id: 'default',
          isEnabled: false,
          notifyOnNew: true,
        },
      });
    }

    return settings;
  }

  /**
   * Save settings and optionally register webhook with Telegram
   */
  async updateSettings(data: {
    botToken?: string;
    chatId?: string;
    isEnabled?: boolean;
    notifyOnNew?: boolean;
    setupWebhook?: boolean;
    webhookUrl?: string;
  }) {
    const updateData: any = {};
    if (data.botToken !== undefined) updateData.botToken = data.botToken.trim();
    if (data.chatId !== undefined) updateData.chatId = data.chatId.trim();
    if (data.isEnabled !== undefined) updateData.isEnabled = Boolean(data.isEnabled);
    if (data.notifyOnNew !== undefined) updateData.notifyOnNew = Boolean(data.notifyOnNew);

    const saved = await prisma.adminTelegramSetting.upsert({
      where: { id: 'default' },
      update: updateData,
      create: {
        id: 'default',
        ...updateData,
      },
    });

    // Automatically set webhook if requested or enabled with valid token
    if (data.setupWebhook && saved.botToken && data.webhookUrl) {
      await this.setWebhook(saved.botToken, data.webhookUrl);
    }

    return saved;
  }

  /**
   * Configure Telegram Webhook
   */
  async setWebhook(botToken: string, webhookUrl: string) {
    try {
      const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message'],
          drop_pending_updates: false,
        }),
      });
      const data: any = await res.json();
      console.log('[Telegram Service] setWebhook response:', data);
      return data;
    } catch (err: any) {
      console.error('[Telegram Service] setWebhook failed:', err.message);
      throw err;
    }
  }

  /**
   * Send test message to verify token and chat ID
   */
  async sendTestNotification(customToken?: string, customChatId?: string) {
    const settings = await this.getSettings();
    const token = customToken || settings.botToken;
    const chatId = customChatId || settings.chatId;

    if (!token || !chatId) {
      throw new Error('Telegram Bot Token and Chat ID are required to send a test message.');
    }

    const text = 
      `🚀 <b>QuazLink Platform — Telegram Bot Integration Active!</b>\n\n` +
      `✅ تم اختبار الاتصال بنجاح.\n` +
      `ستصلك هنا كافة استفسارات وتذاكر العملاء فور وصولها، ويمكنك الرد عليها مباشرة عبر التيليجرام بنظام الـ Reply.\n\n` +
      `🕒 <i>${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</i>`;

    const result = await this.sendMessage(token, chatId, text);

    await prisma.adminTelegramSetting.update({
      where: { id: 'default' },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: 'success',
      },
    }).catch(() => {});

    return result;
  }

  /**
   * Core Telegram sendMessage helper
   */
  async sendMessage(botToken: string, chatId: string, htmlText: string, replyToMessageId?: number) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload: any = {
      chat_id: chatId,
      text: htmlText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (replyToMessageId) {
      payload.reply_to_message_id = replyToMessageId;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data: any = await res.json();
    if (!data.ok) {
      throw new Error(data.description || 'Failed to send message via Telegram Bot.');
    }
    return data.result;
  }

  /**
   * Notify Admin on Telegram when a new contact inquiry arrives
   */
  async notifyNewContact(contact: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    category: string;
    subject: string;
    message: string;
    country?: string | null;
    city?: string | null;
  }) {
    try {
      const settings = await this.getSettings();
      if (!settings.isEnabled || !settings.notifyOnNew || !settings.botToken || !settings.chatId) {
        return null;
      }

      const categoryLabels: Record<string, string> = {
        subscription_renewal: '💳 تجديد اشتراك (Renewal)',
        sales_inquiry: '💼 استفسار مبيعات وتعاقد',
        pos_support: '🏪 نظام الكاشير وطابعات الفواتير',
        runner_support: '🤖 تطبيق الرانر وأتمتة النشر',
        general: '📩 استفسار عام',
      };
      const catLabel = categoryLabels[contact.category] || contact.category;
      const shortId = contact.id.slice(0, 8);

      const html = 
        `🔔 <b>استفسار جديد على منصة QuazLink!</b>\n` +
        `🔖 <b>رقم التذكرة:</b> <code>#${shortId}</code>\n` +
        `👤 <b>العميل:</b> ${this.escapeHtml(contact.name)}\n` +
        `📧 <b>البريد:</b> ${this.escapeHtml(contact.email)}\n` +
        `📱 <b>الهاتف:</b> ${contact.phone ? this.escapeHtml(contact.phone) : '<i>غير مسجل</i>'}\n` +
        `🌍 <b>الموقع:</b> ${[contact.city, contact.country].filter(Boolean).join(', ') || 'مصر'}\n` +
        `📂 <b>القسم:</b> ${catLabel}\n` +
        `📝 <b>الموضوع:</b> <b>${this.escapeHtml(contact.subject)}</b>\n\n` +
        `💬 <b>نص الرسالة:</b>\n` +
        `<blockquote>${this.escapeHtml(contact.message)}</blockquote>\n\n` +
        `──────────────\n` +
        `💡 <b>طريقة الرد المباشر على العميل:</b>\n` +
        `1️⃣ اضغط <b>Reply</b> على هذه الرسالة واكتب ردك مباشرة.\n` +
        `2️⃣ أو أرسل الأمر:\n` +
        `<code>/reply ${shortId} نص الرد هنا</code>`;

      const sentMsg = await this.sendMessage(settings.botToken, settings.chatId, html);

      if (sentMsg?.message_id) {
        // Save mapping for Reply-to-message
        await prisma.telegramMessageMapping.create({
          data: {
            telegramMsgId: sentMsg.message_id,
            contactMessageId: contact.id,
          },
        }).catch(() => {});

        await prisma.contactMessage.update({
          where: { id: contact.id },
          data: { telegramMessageId: sentMsg.message_id },
        }).catch(() => {});
      }

      return sentMsg;
    } catch (err: any) {
      console.error('[Telegram Service] Failed to forward inquiry:', err.message);
      return null;
    }
  }

  /**
   * Process incoming Telegram webhook updates (Replies from Admin)
   */
  async processWebhookUpdate(update: any, onReplyCallback: (contactId: string, replyText: string, adminName: string) => Promise<any>) {
    try {
      const message = update?.message;
      if (!message || !message.text) {
        return { handled: false, reason: 'No message text' };
      }

      const text = message.text.trim();
      const chatId = String(message.chat.id);
      const adminName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Admin';

      // 1. Handle /start command
      if (text.startsWith('/start')) {
        const settings = await this.getSettings();
        if (settings.botToken) {
          const welcome = 
            `👋 <b>مرحباً بك في بوت إدارة منصة QuazLink</b>\n\n` +
            `🔑 <b>Chat ID الخاص بك:</b> <code>${chatId}</code>\n` +
            `انسخ هذا الرقم وضعه في إعدادات المنصة (Settings -> Telegram Integration) لاستقبال استفسارات العملاء والرد عليها مباشرة.\n\n` +
            `⚡ الأوامر المتاحة:\n` +
            `• <code>/reply &lt;ticket_id&gt; &lt;text&gt;</code> للرد على تذكرة محددة.\n` +
            `• أو الرد السريع عبر ميزة Reply لأي إشعار وارد.`;
          await this.sendMessage(settings.botToken, chatId, welcome);
        }
        return { handled: true, action: 'start' };
      }

      // 2. Identify Contact Message ID to reply to
      let targetContactId: string | null = null;
      let replyContent: string = '';

      // Check Case A: User swiped "Reply" to a previous bot message
      if (message.reply_to_message?.message_id) {
        const replyToId = message.reply_to_message.message_id;
        const mapping = await prisma.telegramMessageMapping.findUnique({
          where: { telegramMsgId: replyToId },
        });

        if (mapping) {
          targetContactId = mapping.contactMessageId;
          replyContent = text;
        } else {
          // Fallback: extract ticket ID from quoted text (#a1b2c3d4)
          const quotedText = message.reply_to_message.text || '';
          const match = quotedText.match(/#([a-f0-9]{8})/i);
          if (match && match[1]) {
            const shortId = match[1];
            const found = await prisma.contactMessage.findFirst({
              where: { id: { startsWith: shortId } },
              select: { id: true },
            });
            if (found) {
              targetContactId = found.id;
              replyContent = text;
            }
          }
        }
      }

      // Check Case B: Command `/reply <shortId> <message>`
      if (!targetContactId && text.startsWith('/reply')) {
        const parts = text.split(/\s+/);
        if (parts.length >= 3) {
          const shortId = parts[1].replace('#', '');
          replyContent = parts.slice(2).join(' ').trim();
          const found = await prisma.contactMessage.findFirst({
            where: { id: { startsWith: shortId } },
            select: { id: true },
          });
          if (found) {
            targetContactId = found.id;
          }
        }
      }

      if (!targetContactId || !replyContent) {
        return { handled: false, reason: 'Not a recognized reply format' };
      }

      // Execute Reply Callback (database update, notification, websocket broadcast)
      const replyResult = await onReplyCallback(targetContactId, replyContent, `Telegram (${adminName})`);

      // Confirm back to Telegram Admin
      const settings = await this.getSettings();
      if (settings.botToken) {
        const confirmText = 
          `✅ <b>تم إرسال الرد بنجاح إلى العميل!</b>\n` +
          `🔖 <b>التذكرة:</b> <code>#${targetContactId.slice(0, 8)}</code>\n` +
          `👤 <b>العميل:</b> ${this.escapeHtml(replyResult?.contact?.name || 'العميل')}\n` +
          `💬 <b>ردك:</b> "${this.escapeHtml(replyContent)}"\n\n` +
          `⚡ ظهر الرد فورياً على شاشة العميل في المنصة، وجارٍ التحقق من الاستلام.`;

        await this.sendMessage(settings.botToken, chatId, confirmText, message.message_id);
      }

      return { handled: true, contactId: targetContactId, replyContent };
    } catch (err: any) {
      console.error('[Telegram Service] Error processing webhook:', err.message);
      return { handled: false, error: err.message };
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const telegramService = new TelegramService();
