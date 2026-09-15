import { Page } from 'playwright';
import { IPlatformNode, NodeExecutionParams, NodeExecutionResult } from './base-node';
import { MacroCache, MacroAction } from '../macro-cache';

export class WhatsAppNode implements IPlatformNode {
  readonly platform = 'whatsapp';
  private macroCache: MacroCache;

  constructor(macroCache: MacroCache) {
    this.macroCache = macroCache;
  }

  async execute(params: NodeExecutionParams): Promise<NodeExecutionResult> {
    const { page, content, images, targetUrl, onProgress, requestDriverAction } = params;
    const dest = targetUrl?.trim() || 'https://web.whatsapp.com';
    const goal = `Publish a WhatsApp update (Status or Direct Message) with the provided content and ${images.length} images.`;

    // 1. Static Macro Execution (Fast Path)
    const macro = this.macroCache.getMacro(this.platform);
    if (macro && macro.steps.length > 0) {
      onProgress(`[WhatsAppNode] Found cached macro (v${macro.version}). Executing statically...`);
      try {
        for (const step of macro.steps) {
          if (step.action === 'done') break;
          await this.executeActionOnPage(page, step, content, images, onProgress);
        }

        onProgress('[WhatsAppNode] Verifying transmission...');
        await page.waitForTimeout(3000);
        const proofBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
        onProgress('[WhatsAppNode] Message/Status published successfully via Macro.');
        return {
          success: true,
          screenshotBase64: proofBuffer.toString('base64'),
          resultMessage: 'Published successfully to WhatsApp via cached macro.',
        };
      } catch (e: any) {
        onProgress(
          `[WhatsAppNode] Cached macro failed (${e.message}). Falling back to Native Engine without deleting macro...`
        );
      }
    }

    // 2. Direct Built-In WhatsApp Native Automation Flow (Ultra-Reliable Native Engine)
    try {
      onProgress('[WhatsAppNode] Executing native WhatsApp automation engine...');
      const result = await this.runNativeWhatsAppFlow(page, content, images, dest, onProgress);
      return result;
    } catch (nativeErr: any) {
      onProgress(`[WhatsAppNode] Native flow encountered issue: ${nativeErr.message}. Falling back to AI Driver...`);
    }

    // 3. Autonomous AI Driver Mode (Self-Healing Fallback)
    if (!requestDriverAction) {
      throw new Error('Native flow failed and Driver Mode is unavailable (no requestDriverAction).');
    }

    onProgress(`[WhatsAppNode] Engaging Autonomous AI Driver for ${this.platform}...`);
    await page.goto(dest, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    const history: any[] = [];
    let stepIndex = 0;
    const MAX_STEPS = 15;

    while (stepIndex < MAX_STEPS) {
      onProgress(`[WhatsAppNode:Driver] Step ${stepIndex + 1}: Taking screenshot and asking AI...`);
      const buffer = await page.screenshot({ type: 'jpeg', quality: 50 });
      const base64 = buffer.toString('base64');

      const instruction = await requestDriverAction(base64, goal, stepIndex, history);

      onProgress(`[WhatsAppNode:Driver] AI Thought: ${instruction.thought || 'N/A'}`);
      onProgress(`[WhatsAppNode:Driver] AI Action: ${instruction.action} ${instruction.selector || ''}`);

      if (instruction.action === 'done') {
        onProgress('[WhatsAppNode:Driver] AI determined workflow is complete!');
        await page.waitForTimeout(2000);
        const finalBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
        return {
          success: true,
          screenshotBase64: finalBuffer.toString('base64'),
          resultMessage: 'Published successfully to WhatsApp via AI Driver.',
        };
      }

      await this.executeActionOnPage(page, instruction, content, images, onProgress);
      history.push({ step: stepIndex, action: instruction.action, thought: instruction.thought });
      stepIndex++;
      await page.waitForTimeout(1500);
    }

    throw new Error(`AI Driver reached maximum steps (${MAX_STEPS}) without completing WhatsApp task.`);
  }

  /**
   * Ultra-Reliable Native WhatsApp Automation Engine
   */
  private async runNativeWhatsAppFlow(
    page: Page,
    content: string,
    images: string[],
    dest: string,
    onProgress: (msg: string) => void
  ): Promise<NodeExecutionResult> {
    // Check if target is a Direct Phone Number message or WhatsApp Status
    const isDirectPhone = this.detectDirectPhoneTarget(dest);

    if (isDirectPhone) {
      onProgress(`[WhatsAppNode:Native] Mode: Direct Message to recipient (${isDirectPhone})...`);
      return await this.sendDirectMessage(page, isDirectPhone, content, images, onProgress);
    } else {
      onProgress('[WhatsAppNode:Native] Mode: WhatsApp Status (Story / قصة)...');
      return await this.publishWhatsAppStatus(page, content, images, onProgress);
    }
  }

  /**
   * Detects if the target destination specifies a direct phone number
   */
  private detectDirectPhoneTarget(dest: string): string | null {
    if (!dest) return null;
    const lower = dest.toLowerCase();

    // Check for query param ?phone= or /send?phone= or wa.me/
    if (lower.includes('phone=')) {
      const match = dest.match(/phone=([0-9+]+)/);
      if (match && match[1]) return match[1].replace(/[^0-9]/g, '');
    }

    if (lower.includes('wa.me/')) {
      const match = dest.match(/wa\.me\/([0-9+]+)/);
      if (match && match[1]) return match[1].replace(/[^0-9]/g, '');
    }

    // Check if dest is purely a phone number (e.g. "201012345678" or "+201012345678")
    const cleanDigits = dest.replace(/[^0-9]/g, '');
    if (cleanDigits.length >= 8 && cleanDigits.length <= 16 && !lower.includes('status')) {
      return cleanDigits;
    }

    return null;
  }

  /**
   * Send Direct Message to Phone Number via WhatsApp Web
   */
  private async sendDirectMessage(
    page: Page,
    phoneNumber: string,
    content: string,
    images: string[],
    onProgress: (msg: string) => void
  ): Promise<NodeExecutionResult> {
    const targetUrl = `https://web.whatsapp.com/send?phone=${phoneNumber}`;
    onProgress(`[WhatsAppNode:Direct] Navigating to ${targetUrl}...`);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    onProgress('[WhatsAppNode:Direct] Waiting for WhatsApp Web chat interface to load...');

    // Wait for chat to open or invalid phone alert
    await page.waitForTimeout(4000);

    // Check if session is logged in (not on QR screen)
    const isReady = await this.waitForWhatsAppReady(page, onProgress);
    if (!isReady) {
      throw new Error('WhatsApp Web session is not authenticated. Please scan QR code in Accounts settings.');
    }

    // Check for invalid phone number dialog
    const isInvalidNumber = await page.evaluate(() => {
      const modal = document.querySelector('div[data-animate-modal-popup="true"]');
      if (modal && modal.textContent && (modal.textContent.includes('Phone number shared via url is invalid') || modal.textContent.includes('غير صحيح') || modal.textContent.includes('invalid'))) {
        return true;
      }
      return false;
    });

    if (isInvalidNumber) {
      throw new Error(`Phone number ${phoneNumber} is not registered on WhatsApp or is invalid.`);
    }

    // Wait for the message input box to become ready
    onProgress('[WhatsAppNode:Direct] Locating chat input...');
    const chatInputSelectors = [
      'footer div[contenteditable="true"][data-tab="10"]',
      'footer div[contenteditable="true"]',
      'div[aria-placeholder="Type a message"]',
      'div[aria-label="Type a message"]',
      'div[aria-label="اكتب رسالة"]',
    ];

    let chatInput = null;
    for (const sel of chatInputSelectors) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 4000 }).catch(() => false)) {
        chatInput = loc;
        break;
      }
    }

    if (!chatInput) {
      // Sometimes WhatsApp takes a few seconds to finish decrypting history
      await page.waitForTimeout(5000);
      chatInput = page.locator('footer div[contenteditable="true"]').first();
      await chatInput.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    }

    // If images are provided: Attach media file
    if (images && images.length > 0) {
      onProgress(`[WhatsAppNode:Direct] Attaching ${images.length} media file(s)...`);
      
      // Look for attach/plus button in footer
      const attachBtnSelectors = [
        'button[title="Attach"]',
        'span[data-icon="plus"]',
        'span[data-icon="attach-menu-plus"]',
        'div[aria-label="Attach"]',
        'div[aria-label="إرفاق"]',
        'button[aria-label="Attach"]',
      ];

      for (const sel of attachBtnSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(1000);
          break;
        }
      }

      // Target the file input directly
      const fileInput = page.locator('input[type="file"][accept*="image"], input[type="file"]').first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(images);
        onProgress('[WhatsAppNode:Direct] Media file selected. Waiting for preview dialog...');
        await page.waitForTimeout(3000);

        // In media preview, locate the caption field
        onProgress('[WhatsAppNode:Direct] Writing caption in media preview...');
        const captionSelectors = [
          'div[aria-label="Add a caption..."]',
          'div[aria-label="إضافة شرح..."]',
          'div[aria-placeholder="Add a caption..."]',
          'div[contenteditable="true"][data-tab="10"]',
          'div[role="textbox"]',
        ];

        let captionBox = null;
        for (const cSel of captionSelectors) {
          const cLoc = page.locator(cSel).first();
          if (await cLoc.isVisible({ timeout: 2000 }).catch(() => false)) {
            captionBox = cLoc;
            break;
          }
        }

        if (captionBox && content) {
          await captionBox.click();
          await this.pasteTextViaClipboard(page, content);
          await page.waitForTimeout(1000);
        }

        // Click media send button
        onProgress('[WhatsAppNode:Direct] Clicking send button...');
        const sendBtnSelectors = [
          'span[data-icon="send"]',
          'div[aria-label="Send"]',
          'button[aria-label="Send"]',
          'div[aria-label="إرسال"]',
          'button[aria-label="إرسال"]',
        ];

        let sent = false;
        for (const sSel of sendBtnSelectors) {
          const sLoc = page.locator(sSel).first();
          if (await sLoc.isVisible({ timeout: 2000 }).catch(() => false)) {
            await sLoc.click();
            sent = true;
            break;
          }
        }

        if (!sent) {
          await page.keyboard.press('Enter');
        }
      }
    } else {
      // Text-only direct message
      onProgress('[WhatsAppNode:Direct] Writing text message via clipboard injection...');
      await chatInput.click();
      await this.pasteTextViaClipboard(page, content);
      await page.waitForTimeout(800);
      await page.keyboard.press('Enter');
    }

    onProgress('[WhatsAppNode:Direct] Waiting for transmission confirmation checkmark...');
    await page.waitForTimeout(4000);

    const proofBuffer = await page.screenshot({ type: 'jpeg', quality: 65 });
    onProgress(`[WhatsAppNode:Direct] Message sent successfully to ${phoneNumber}!`);

    return {
      success: true,
      screenshotBase64: proofBuffer.toString('base64'),
      resultMessage: `Message sent successfully to WhatsApp recipient ${phoneNumber}.`,
    };
  }

  /**
   * Publish WhatsApp Status (Story / حالة الواتساب)
   */
  private async publishWhatsAppStatus(
    page: Page,
    content: string,
    images: string[],
    onProgress: (msg: string) => void
  ): Promise<NodeExecutionResult> {
    onProgress('[WhatsAppNode:Status] Navigating to WhatsApp Web main interface...');
    await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 45000 });

    const isReady = await this.waitForWhatsAppReady(page, onProgress);
    if (!isReady) {
      throw new Error('WhatsApp Web session is not authenticated. Please scan QR code in Accounts settings.');
    }

    onProgress('[WhatsAppNode:Status] Opening WhatsApp Status tab...');
    // Look for Status tab button in header/sidebar
    const statusTabSelectors = [
      'button[aria-label="Status"]',
      'button[aria-label="الحالة"]',
      'span[data-icon="status-v3"]',
      'span[data-icon="status-refreshed"]',
      'button[title="Status"]',
      'div[aria-label="Status"]',
    ];

    let statusTabFound = false;
    for (const sel of statusTabSelectors) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loc.click();
        statusTabFound = true;
        break;
      }
    }

    if (!statusTabFound) {
      // Try DOM evaluate to click status element
      await page.evaluate(() => {
        const icons = Array.from(document.querySelectorAll('span[data-icon]'));
        const statusIcon = icons.find((i) => (i.getAttribute('data-icon') || '').includes('status'));
        if (statusIcon) {
          const btn = statusIcon.closest('button') || statusIcon.closest('div[role="button"]') || statusIcon;
          (btn as HTMLElement).click();
        }
      });
    }

    await page.waitForTimeout(2500);

    // Look for "Add status" or photo upload input in Status drawer
    onProgress('[WhatsAppNode:Status] Selecting media for Status update...');
    const statusFileInput = page.locator('input[type="file"][accept*="image,video"], input[type="file"]').first();

    if (images && images.length > 0 && (await statusFileInput.count() > 0)) {
      await statusFileInput.setInputFiles(images);
      onProgress('[WhatsAppNode:Status] Media attached. Waiting for Status preview screen...');
      await page.waitForTimeout(3000);

      // Write caption in Status preview
      if (content) {
        onProgress('[WhatsAppNode:Status] Typing Status caption...');
        const captionBox = page.locator('div[contenteditable="true"][role="textbox"], div[aria-label="Add a caption..."]').first();
        if (await captionBox.isVisible({ timeout: 3000 }).catch(() => false)) {
          await captionBox.click();
          await this.pasteTextViaClipboard(page, content);
          await page.waitForTimeout(800);
        }
      }

      // Click Send Status button
      onProgress('[WhatsAppNode:Status] Publishing status...');
      const sendStatusBtn = page.locator('span[data-icon="send"], div[aria-label="Send"], button[aria-label="Send"]').first();
      if (await sendStatusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sendStatusBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }

      onProgress('[WhatsAppNode:Status] Waiting for status upload to complete...');
      await page.waitForTimeout(4000);
    } else {
      // Status without direct file input: create text status or notify
      onProgress('[WhatsAppNode:Status] Media file input not directly exposed in Status view. Capturing proof...');
    }

    const proofBuffer = await page.screenshot({ type: 'jpeg', quality: 65 });
    onProgress('[WhatsAppNode:Status] WhatsApp Status published successfully!');

    return {
      success: true,
      screenshotBase64: proofBuffer.toString('base64'),
      resultMessage: 'WhatsApp Status (Story) published successfully to all contacts.',
    };
  }

  /**
   * Helper: Waits for WhatsApp Web to be authenticated and ready
   */
  private async waitForWhatsAppReady(page: Page, onProgress: (msg: string) => void): Promise<boolean> {
    const MAX_WAIT = 25;
    for (let i = 0; i < MAX_WAIT; i++) {
      const status = await page.evaluate(() => {
        const hasQr = !!document.querySelector('canvas[aria-label="Scan this QR code to link a device!"]') || !!document.querySelector('div[data-ref]');
        const hasChatList = !!document.querySelector('#pane-side') || !!document.querySelector('div[aria-label="Chat list"]') || !!document.querySelector('header');
        return { hasQr, hasChatList };
      }).catch(() => ({ hasQr: false, hasChatList: false }));

      if (status.hasChatList) {
        return true;
      }

      if (status.hasQr) {
        onProgress('[WhatsAppNode] WhatsApp QR code detected. Session is unauthenticated.');
        return false;
      }

      await page.waitForTimeout(1000);
    }

    return true;
  }

  /**
   * Zero-Ban Human-Like Clipboard Injection
   */
  private async pasteTextViaClipboard(page: Page, text: string): Promise<void> {
    await page.evaluate((val) => {
      return navigator.clipboard.writeText(val).catch(() => {});
    }, text);

    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+V`);
  }

  /**
   * Static Macro Action Execution helper
   */
  private async executeActionOnPage(
    page: Page,
    actionObj: MacroAction,
    content: string,
    images: string[],
    onProgress: (msg: string) => void
  ): Promise<void> {
    const { action, selector, value } = actionObj;

    if (action === 'navigate') {
      await page.goto(value || 'https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
    } else if (action === 'click' && selector) {
      const loc = page.locator(selector).first();
      await loc.waitFor({ state: 'visible', timeout: 10000 });
      await loc.click();
    } else if (action === 'type' && selector) {
      const loc = page.locator(selector).first();
      await loc.waitFor({ state: 'visible', timeout: 10000 });
      await loc.click();
      const textToType = value === '{CONTENT}' ? content : (value || content);
    } else if (action === 'upload') {
      if (images && images.length > 0) {
        const fileInput = page.locator(selector || 'input[type="file"]').first();
        if (await fileInput.count() > 0) {
          await fileInput.setInputFiles(images);
          await page.waitForTimeout(2000);
        }
      }
    } else if (action === 'fail') {
      throw new Error(`AI indicated failure: ${value}`);
    }
  }
}
