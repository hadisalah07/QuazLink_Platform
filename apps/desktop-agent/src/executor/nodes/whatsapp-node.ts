import { Page, Locator } from 'playwright';
import { IPlatformNode, NodeExecutionParams, NodeExecutionResult } from './base-node';
import { MacroCache, MacroAction } from '../macro-cache';
import { WhatsapplessStore, extractPhoneNumber, normalizePhoneNumber } from '../whatsappless-store';

export class WhatsAppNode implements IPlatformNode {
  readonly platform = 'whatsapp';
  private macroCache: MacroCache;
  private whatsapplessStore: WhatsapplessStore;

  constructor(macroCache: MacroCache, whatsapplessStore?: WhatsapplessStore) {
    this.macroCache = macroCache;
    this.whatsapplessStore = whatsapplessStore || new WhatsapplessStore();
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
    if (!page.url().includes('whatsapp.com')) {
      await page.goto(dest, { waitUntil: 'domcontentloaded', timeout: 45000 });
    }
    await this.waitForWhatsAppReady(page, onProgress);
    await page.waitForTimeout(2500);

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

      // If AI indicates waiting or page is still loading, wait without failing!
      if (
        instruction.action === 'wait' ||
        (instruction.action === 'fail' && instruction.thought && /wait|load|loading|spinner|progress/i.test(instruction.thought))
      ) {
        onProgress('[WhatsAppNode:Driver] Page is still loading or buffering. Waiting 4s...');
        await page.waitForTimeout(4000);
        history.push({ step: stepIndex, action: 'wait', thought: instruction.thought });
        stepIndex++;
        continue;
      }

      // Loop detection safeguard: prevent endless repetition of identical failing clicks
      const actionKey = `${instruction.action}:${instruction.selector || ''}`;
      const repeatCount = history.filter((h) => `${h.action}:${h.selector || ''}` === actionKey).length;
      if (repeatCount >= 2 && instruction.action === 'click') {
        onProgress('[WhatsAppNode:Driver] Repeating selector detected! Applying smart self-healing recovery...');
        await page.evaluate(() => {
          // If trying to open status menu, try direct click on Add Status or My status row
          const addBtn = document.querySelector('button[aria-label="Add Status"], button:has-text("ic-add-circle")') ||
                         document.querySelector('button[aria-label*="Status" i]') ||
                         Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Click to add status'));
          if (addBtn) (addBtn as HTMLElement).click();

          // If menu is open, try direct click on Photos & videos
          const photoBtn = Array.from(document.querySelectorAll('button, li')).find(el => (el.textContent || '').includes('Photos & videos') || (el.textContent || '').includes('الصور ومقاطع الفيديو'));
          if (photoBtn) (photoBtn as HTMLElement).click();
        }).catch(() => {});
        await page.waitForTimeout(2000);
      }

      await this.executeActionOnPage(page, instruction, content, images, onProgress);
      history.push({ step: stepIndex, action: instruction.action, selector: instruction.selector, thought: instruction.thought });
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
    return extractPhoneNumber(dest);
  }

  /**
   * Send Direct Message to Phone Number via WhatsApp Web
   */
  private async sendDirectMessage(
    page: Page,
    rawPhoneNumber: string,
    content: string,
    images: string[],
    onProgress: (msg: string) => void
  ): Promise<NodeExecutionResult> {
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

    // 0. Fast-path check: Is this number cached in whatsappless list?
    if (this.whatsapplessStore.isWhatsappless(phoneNumber)) {
      const entry = this.whatsapplessStore.get(phoneNumber);
      const expiryDate = entry ? new Date(entry.expiresAt).toLocaleDateString() : '30 days';
      const skipMsg = `[WHATSAPPLESS] Skipped: Phone number +${phoneNumber} is cached in whatsappless list (no WhatsApp account). Saved time by avoiding navigation. Expiry date: ${expiryDate}.`;
      onProgress(`⚡ ${skipMsg}`);
      throw new Error(skipMsg);
    }

    const targetUrl = `https://web.whatsapp.com/send?phone=${phoneNumber}`;
    onProgress(`[WhatsAppNode:Direct] Navigating to ${targetUrl}...`);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    onProgress('[WhatsAppNode:Direct] Waiting for WhatsApp Web chat interface to load...');

    await page.waitForTimeout(3000);

    // Check if session is logged in (not on QR screen)
    const isReady = await this.waitForWhatsAppReady(page, onProgress);
    if (!isReady) {
      throw new Error('WhatsApp Web session is not authenticated. Please scan QR code in Accounts settings.');
    }

    // Helper to check for WhatsApp's "Number isn't on WhatsApp" modal popup
    const checkNotOnWhatsAppDialog = async (): Promise<{ detected: boolean; message: string }> => {
      const modalInfo = await page.evaluate(() => {
        const dialogs = Array.from(
          document.querySelectorAll('div[role="dialog"], div[data-animate-modal-popup="true"], div[data-testid*="popup"], div[data-testid="confirm-popup"]')
        );
        const elementsToCheck = dialogs.length > 0 ? dialogs : [document.body];

        for (const el of elementsToCheck) {
          const text = (el.textContent || '').trim();
          const lower = text.toLowerCase();
          if (
            lower.includes("isn't on whatsapp") ||
            lower.includes("not on whatsapp") ||
            lower.includes("is not on whatsapp") ||
            lower.includes("phone number shared via url is invalid") ||
            lower.includes("invalid phone number") ||
            text.includes("غير مسجل في واتساب") ||
            text.includes("ليس لديه حساب على واتساب") ||
            text.includes("ليس مسجلاً في واتساب") ||
            text.includes("رقم الهاتف الذي تمت مشاركته عبر") ||
            text.includes("غير صحيح")
          ) {
            return { detected: true, message: text };
          }
        }
        return { detected: false, message: '' };
      }).catch(() => ({ detected: false, message: '' }));

      if (modalInfo.detected) {
        // Dismiss the modal by clicking OK / موافق so WhatsApp Web stays clean
        const okSelectors = [
          'div[role="dialog"] button',
          'div[data-animate-modal-popup="true"] button',
          'button:has-text("OK")',
          'div[role="button"]:has-text("OK")',
          'button:has-text("موافق")',
          'div[role="button"]:has-text("موافق")',
        ];

        for (const sel of okSelectors) {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await this.humanMoveAndClick(page, btn);
            await page.waitForTimeout(800);
            break;
          }
        }

        return { detected: true, message: modalInfo.message };
      }

      return { detected: false, message: '' };
    };

    // Check 1: Right after navigation & ready
    let notOnWa = await checkNotOnWhatsAppDialog();
    if (notOnWa.detected) {
      const entry = this.whatsapplessStore.addWhatsappless(phoneNumber, notOnWa.message);
      const expiryDate = new Date(entry.expiresAt).toLocaleDateString();
      const err = `[WHATSAPPLESS] Phone number +${phoneNumber} is not on WhatsApp. Added to whatsappless list (Valid for 1 month until ${expiryDate}).`;
      onProgress(`🚫 ${err}`);
      throw new Error(err);
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
      // Check again for "Number isn't on WhatsApp" modal in case it appeared with delay
      notOnWa = await checkNotOnWhatsAppDialog();
      if (notOnWa.detected) {
        const entry = this.whatsapplessStore.addWhatsappless(phoneNumber, notOnWa.message);
        const expiryDate = new Date(entry.expiresAt).toLocaleDateString();
        const err = `[WHATSAPPLESS] Phone number +${phoneNumber} is not on WhatsApp. Added to whatsappless list (Valid for 1 month until ${expiryDate}).`;
        onProgress(`🚫 ${err}`);
        throw new Error(err);
      }

      // Sometimes WhatsApp takes a few seconds to finish decrypting history
      await page.waitForTimeout(4000);
      chatInput = page.locator('footer div[contenteditable="true"]').first();
      await chatInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    }

    if (!chatInput || !(await chatInput.isVisible().catch(() => false))) {
      // Final modal check before throwing generic timeout
      notOnWa = await checkNotOnWhatsAppDialog();
      if (notOnWa.detected) {
        const entry = this.whatsapplessStore.addWhatsappless(phoneNumber, notOnWa.message);
        const expiryDate = new Date(entry.expiresAt).toLocaleDateString();
        const err = `[WHATSAPPLESS] Phone number +${phoneNumber} is not on WhatsApp. Added to whatsappless list (Valid for 1 month until ${expiryDate}).`;
        onProgress(`🚫 ${err}`);
        throw new Error(err);
      }
      throw new Error(`Failed to locate WhatsApp chat input for +${phoneNumber}.`);
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
          await this.humanMoveAndClick(page, btn);
          await this.humanDelay(600, 1200);
          break;
        }
      }

      // Target the file input directly
      const fileInput = page.locator('input[type="file"][accept*="image"], input[type="file"]').first();
      if ((await fileInput.count().catch(() => 0)) > 0) {
        await fileInput.setInputFiles(images);
        onProgress('[WhatsAppNode:Direct] Media file selected. Waiting for preview dialog...');
        await this.humanDelay(2500, 4000);

        // In media preview, locate the caption field
        onProgress('[WhatsAppNode:Direct] Writing caption in media preview...');
        const captionSelectors = [
          'div[aria-label="Add a caption" i]',
          'div[aria-label="Add a caption..."]',
          'div[aria-label*="caption" i]',
          'div[aria-label*="شرح" i]',
          'div[aria-placeholder*="caption" i]',
          'div[contenteditable="true"][data-tab="10"]',
          'div[contenteditable="true"]',
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
          await this.humanMoveAndClick(page, captionBox);
          await this.pasteTextViaClipboard(page, content);
          await this.humanDelay(1200, 2200);
        }

        // Click media send button
        onProgress('[WhatsAppNode:Direct] Reviewing and clicking send button...');
        await this.humanDelay(1000, 2000);
        const sendBtnSelectors = [
          'span[data-icon="wds-ic-send-filled"]',
          'div:has(span[data-icon="wds-ic-send-filled"])',
          'div[aria-label*="Send" i]',
          'button[aria-label*="Send" i]',
          'span[data-icon="send"]',
          'div[aria-label*="إرسال" i]',
          'button[aria-label*="إرسال" i]',
        ];

        let sent = false;
        for (const sSel of sendBtnSelectors) {
          const sLoc = page.locator(sSel).first();
          if (await sLoc.isVisible({ timeout: 2000 }).catch(() => false)) {
            const clickable = sLoc.locator('xpath=ancestor-or-self::*[self::button or @role="button"][1]');
            const target = (await clickable.count().catch(() => 0)) > 0 ? clickable : sLoc;
            sent = await this.humanMoveAndClick(page, target);
            if (sent) break;
          }
        }

        if (!sent) {
          await this.humanDelay(400, 800);
          await page.keyboard.press('Enter');
        }
      }
    } else {
      // Text-only direct message
      onProgress('[WhatsAppNode:Direct] Writing text message via clipboard injection...');
      await this.humanMoveAndClick(page, chatInput);
      await this.pasteTextViaClipboard(page, content);
      await this.humanDelay(800, 1500);
      await page.keyboard.press('Enter');
    }

    onProgress('[WhatsAppNode:Direct] Verifying message transmission (Waiting for Checkmark ✔️)...');

    const MAX_CONFIRM_SECONDS = 25;
    let transmissionConfirmed = false;
    let failureReason: string | null = null;

    for (let i = 0; i < MAX_CONFIRM_SECONDS; i++) {
      const status = await page
        .evaluate(() => {
          // Find all outgoing message bubbles in the active conversation
          const outMsgs = document.querySelectorAll(
            'div.message-out, div[class*="message-out"], div[data-id*="true_"]'
          );
          if (!outMsgs || outMsgs.length === 0) return { found: false };

          const lastMsg = outMsgs[outMsgs.length - 1];

          // 1. Check for red alert / error icon (message failed to transmit)
          const errorEl = lastMsg.querySelector(
            'span[data-icon="alert-warning"], span[data-icon="msg-error"], button[aria-label*="retry" i], span[data-icon="retry"]'
          );
          const hasError = !!errorEl;

          // 2. Check for checkmark (single check msg-check, double check msg-dblcheck, or read msg-dblcheck-ack)
          const checkEl = lastMsg.querySelector(
            'span[data-icon="msg-check"], span[data-icon="check"], span[data-icon="msg-dblcheck"], span[data-icon="dblcheck"], span[data-icon="msg-dblcheck-ack"]'
          );
          const hasCheck = !!checkEl;

          // 3. Check for clock / time / pending icon
          const clockEl = lastMsg.querySelector(
            'span[data-icon="msg-time"], span[data-icon="time"], span[data-icon="pending"]'
          );
          const hasClock = !!clockEl;

          return { found: true, hasError, hasCheck, hasClock };
        })
        .catch(() => ({ found: false, hasError: false, hasCheck: false, hasClock: false }));

      // If last message has a confirmed checkmark and no error: transmission is 100% verified!
      if (status.found && status.hasCheck && !status.hasError) {
        transmissionConfirmed = true;
        break;
      }

      // If explicit red error icon is present
      if (status.found && status.hasError) {
        failureReason = 'WhatsApp server rejected message delivery (❗ Red alert icon detected).';
        break;
      }

      // Fallback: check via global Playwright locators if DOM evaluation didn't match specific classes
      if (!status.found) {
        const hasCheck = await page
          .locator(
            'div.message-out span[data-icon="msg-check"], div.message-out span[data-icon="msg-dblcheck"], span[data-icon="msg-check"], span[data-icon="msg-dblcheck"]'
          )
          .last()
          .isVisible({ timeout: 400 })
          .catch(() => false);
        const hasError = await page
          .locator('div.message-out span[data-icon="alert-warning"], span[data-icon="alert-warning"]')
          .last()
          .isVisible({ timeout: 400 })
          .catch(() => false);

        if (hasCheck && !hasError) {
          transmissionConfirmed = true;
          break;
        }
        if (hasError) {
          failureReason = 'WhatsApp server rejected message delivery (❗ Red alert icon detected).';
          break;
        }
      }

      if (i > 0 && i % 5 === 0) {
        onProgress(`[WhatsAppNode:Direct] Awaiting transmission confirmation (${i}s elapsed, status: pending 🕒)...`);
      }

      await page.waitForTimeout(1000);
    }

    // Capture visual proof screenshot
    await page.waitForTimeout(1000);
    const proofBuffer = await page.screenshot({ type: 'jpeg', quality: 65 });

    if (!transmissionConfirmed) {
      const errDetail =
        failureReason ||
        `Message remained queued locally (🕒 clock icon) after ${MAX_CONFIRM_SECONDS}s without leaving the device. Please verify your mobile phone is powered on, connected to internet, and WhatsApp is opened to sync.`;
      onProgress(`❌ [WhatsAppNode:Direct] Delivery check failed: ${errDetail}`);
      throw new Error(errDetail);
    }

    onProgress(`[WhatsAppNode:Direct] Message sent successfully (Checkmark ✔️ confirmed) to ${phoneNumber}!`);

    return {
      success: true,
      screenshotBase64: proofBuffer.toString('base64'),
      resultMessage: `Message sent and confirmed delivered (✔️) to WhatsApp recipient ${phoneNumber}.`,
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
    // Dismiss any blocking dialogs (like "What's new on WhatsApp Web")
    await this.dismissBlockingModals(page, onProgress);

    // Look for Status tab button in header/sidebar
    const statusTabSelectors = [
      'button[aria-label="Status" i]',
      'button[aria-label="الحالة" i]',
      'button:has-text("wds-ic-status-filled")',
      'span[data-icon="status-v3"]',
      'span[data-icon="status-refreshed"]',
      'button[title="Status" i]',
      'div[aria-label="Status" i]',
    ];

    let statusTabFound = false;
    for (const sel of statusTabSelectors) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
        statusTabFound = await this.humanMoveAndClick(page, loc);
        if (statusTabFound) break;
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

    await this.humanDelay(1800, 3000);
    await this.dismissBlockingModals(page, onProgress);

    // Look for "Add status" or photo upload input in Status drawer
    onProgress('[WhatsAppNode:Status] Waiting for Status pane to render...');
    await this.humanDelay(1200, 2200);

    if (images && images.length > 0) {
      let mediaAttached = false;

      // 1. Locate and trigger the Add Status (⊕) button in the Status pane
      const addStatusSelectors = [
        'button[aria-label="Add status" i]',
        'button[aria-label="إضافة حالة" i]',
        'header button:has(span[data-icon*="plus"])',
        'button:has(span[data-icon="plus"])',
        'button:has(span[data-icon="plus-large"])',
        'button:has(span[data-icon="status-v3-round-plus"])',
        'div[role="button"]:has(span[data-icon*="plus"])',
        'button[aria-label*="Status" i]:has(span[data-icon*="plus"])',
        'button[aria-label*="حالة" i]:has(span[data-icon*="plus"])',
        'span[data-icon="plus"]',
        'span[data-icon="plus-large"]',
        'span[data-icon="status-v3-round-plus"]',
        'button[aria-label="Add Status" i]',
        'button:has-text("ic-add-circle")',
      ];

      let addBtn = null;
      for (const sel of addStatusSelectors) {
        const loc = page.locator(sel).first();
        if (await loc.isVisible().catch(() => false)) {
          addBtn = loc;
          break;
        }
      }

      if (!addBtn) {
        // Wait up to 6s for the Add Status button to render in the DOM
        const primaryLoc = page.locator(addStatusSelectors[0]);
        await primaryLoc.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
        if (await primaryLoc.isVisible().catch(() => false)) {
          addBtn = primaryLoc;
        }
      }

      if (addBtn) {
        onProgress('[WhatsAppNode:Status] Clicking Add Status button (⊕)...');
        await this.humanMoveAndClick(page, addBtn);
        await this.humanDelay(800, 1500);
      }

      // 2. Prepare file chooser listener concurrently
      const fcPromise = page.waitForEvent('filechooser', { timeout: 7000 }).catch(() => null);

      // Locate the popup menu item: "Photos & videos" / "الصور ومقاطع الفيديو"
      const photoOptionSelectors = [
        'button[role="menuitem"][aria-label*="Photos" i]',
        'button[role="menuitem"]:has-text("Photos & videos")',
        'button[role="menuitem"]:has-text("الصور ومقاطع الفيديو")',
        'button[role="menuitem"]:has-text("صور ومقاطع فيديو")',
        'li:has-text("Photos & videos")',
        'li:has-text("الصور ومقاطع الفيديو")',
        'button[aria-label="Photos & videos" i]',
        'button:has-text("Photos & videos")',
        'button:has-text("الصور ومقاطع الفيديو")',
        'div[role="button"]:has-text("Photos & videos")',
        'div[role="button"]:has-text("الصور ومقاطع الفيديو")',
        'span:has-text("Photos & videos")',
        'span:has-text("الصور ومقاطع الفيديو")',
      ];

      let photoBtn = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        for (const pSel of photoOptionSelectors) {
          const pLoc = page.locator(pSel).first();
          if (await pLoc.isVisible().catch(() => false)) {
            photoBtn = pLoc;
            break;
          }
        }
        if (photoBtn) break;
        await this.humanDelay(300, 600);
      }

      // 3. Trigger FileChooser from "Photos & videos" option
      if (photoBtn) {
        onProgress('[WhatsAppNode:Status] Selecting Photos & videos menu option...');
        await this.humanMoveAndClick(page, photoBtn);
        const fc = await fcPromise;
        if (fc) {
          await fc.setFiles(images);
          mediaAttached = true;
          onProgress(`[WhatsAppNode:Status] ${images.length} media file(s) attached via file chooser.`);
        }
      }

      // 4. Fallback: Check if file input is exposed directly in DOM
      if (!mediaAttached) {
        const statusFileInput = page
          .locator('input[type="file"][accept*="image,video"], input[type="file"][accept*="image"], input[type="file"]')
          .first();
        if ((await statusFileInput.count().catch(() => 0)) > 0) {
          try {
            await statusFileInput.setInputFiles(images);
            mediaAttached = true;
            onProgress('[WhatsAppNode:Status] Media attached via direct DOM file input.');
          } catch {}
        }
      }

      // 5. Fallback 2: Check "Click to add status update" row
      if (!mediaAttached) {
        const myStatusRow = page
          .locator('button:has-text("Click to add status update"), button:has-text("انقر لإضافة تحديث حالة")')
          .first();
        if (await myStatusRow.isVisible().catch(() => false)) {
          const rowFcPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
          await this.humanMoveAndClick(page, myStatusRow);
          const fc = await rowFcPromise;
          if (fc) {
            await fc.setFiles(images);
            mediaAttached = true;
            onProgress('[WhatsAppNode:Status] Media attached via My Status row click.');
          }
        }
      }

      // 6. If media could not be attached, escalate to AI Driver
      if (!mediaAttached) {
        throw new Error(
          'Media file input could not be triggered in WhatsApp Web Status drawer. Escalating to Autonomous AI Driver...'
        );
      }

      onProgress('[WhatsAppNode:Status] Media attached successfully. Allowing human review time for preview...');
      await this.humanDelay(2000, 3500);

      // Write caption in Status preview screen
      if (content) {
        onProgress('[WhatsAppNode:Status] Typing Status caption in media preview...');
        const captionSelectors = [
          'div[aria-label="Add a caption" i]',
          'div[aria-placeholder="Add a caption" i]',
          'div[aria-label="Add a caption..."]',
          'div[aria-label*="caption" i]',
          'div[aria-label*="شرح" i]',
          'div[aria-placeholder*="caption" i]',
          'div[aria-placeholder*="شرح" i]',
          'div[contenteditable="true"][role="textbox"]',
          'div[contenteditable="true"]',
          'div[role="textbox"]',
        ];

        for (const cSel of captionSelectors) {
          const captionBox = page.locator(cSel).first();
          if (await captionBox.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.humanMoveAndClick(page, captionBox);
            await this.pasteTextViaClipboard(page, content);
            break;
          }
        }
      }

      // Human review before sending status: 1500ms - 2800ms
      onProgress('[WhatsAppNode:Status] Reviewing status preview before transmission...');
      await this.humanDelay(1500, 2800);

      // Click Send Status button
      onProgress('[WhatsAppNode:Status] Publishing status...');
      const sendStatusSelectors = [
        'span[data-icon="wds-ic-send-filled"]',
        'div[role="button"]:has(span[data-icon="wds-ic-send-filled"])',
        'button:has(span[data-icon="wds-ic-send-filled"])',
        'div[aria-label*="Send" i]',
        'button[aria-label*="Send" i]',
        'div[aria-label*="إرسال" i]',
        'button[aria-label*="إرسال" i]',
        'span[data-icon="send"]',
        'span[data-icon="status-send"]',
        'button:has(span[data-icon*="send"])',
        'div[role="button"]:has(span[data-icon*="send"])',
      ];

      let sent = false;
      for (const sSel of sendStatusSelectors) {
        const sendBtn = page.locator(sSel).first();
        if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          const clickableSend = sendBtn.locator('xpath=ancestor-or-self::*[self::button or @role="button"][1]');
          const targetSend = (await clickableSend.count().catch(() => 0)) > 0 ? clickableSend : sendBtn;
          sent = await this.humanMoveAndClick(page, targetSend);
          if (sent) break;
        }
      }
      if (!sent) {
        await this.humanDelay(400, 800);
        await page.keyboard.press('Enter');
      }
      await this.waitForStatusSendingToFinish(page, onProgress);
    } else if (content) {
      // Text-only WhatsApp Status
      onProgress('[WhatsAppNode:Status] Mode: Text-only Status update...');

      const addStatusSelectors = [
        'button[aria-label="Add status" i]',
        'button[aria-label="إضافة حالة" i]',
        'button:has(span[data-icon="plus"])',
        'div[role="button"]:has(span[data-icon*="plus"])',
        'header button:has(span[data-icon*="plus"])',
        'button:has(span[data-icon="plus-large"])',
        'button:has(span[data-icon="status-v3-round-plus"])',
        'button[aria-label*="Status" i]:has-text("ic-add-circle")',
        'button:has-text("ic-add-circle")',
        'button[aria-label*="حالة" i]',
        'span[data-icon="plus"]',
        'span[data-icon="plus-large"]',
        'span[data-icon="status-v3-round-plus"]',
      ];

      let plusClicked = false;
      for (const sel of addStatusSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible().catch(() => false)) {
          onProgress(`[WhatsAppNode:Status] Clicking Add Status button (${sel})...`);
          const clickable = btn.locator('xpath=ancestor-or-self::*[self::button or @role="button"][1]');
          const target = (await clickable.count().catch(() => 0)) > 0 ? clickable : btn;
          plusClicked = await this.humanMoveAndClick(page, target);
          if (plusClicked) break;
        }
      }

      if (!plusClicked) {
        // Fallback DOM evaluation to find and click the status plus button
        const clickedDom = await page.evaluate(() => {
          const plusIcons = Array.from(document.querySelectorAll('span[data-icon*="plus"], span[data-icon*="status-add"]'));
          for (const icon of plusIcons) {
            const btn = icon.closest('button') || icon.closest('div[role="button"]') || icon;
            if (btn && (btn as HTMLElement).offsetParent !== null) {
              (btn as HTMLElement).click();
              return true;
            }
          }
          return false;
        }).catch(() => false);

        if (clickedDom) {
          onProgress('[WhatsAppNode:Status] Clicked Status Plus button via DOM inspection.');
          await this.humanDelay(800, 1500);
        }
      }

      // Look for "Text" / "نص" option
      const textOptionSelectors = [
        'button[aria-label="Text" i]',
        'button:has-text("Text")',
        'button:has-text("نص")',
        'li:has-text("Text")',
        'li:has-text("نص")',
        'div[role="button"]:has-text("Text")',
        'div[role="button"]:has-text("نص")',
        'span:has-text("Text")',
        'span:has-text("نص")',
        'span[data-icon="pencil"]',
        'span[data-icon="status-text"]',
        'button[aria-label*="Text" i]',
        'button[aria-label*="نص" i]',
      ];

      for (const tSel of textOptionSelectors) {
        const tLoc = page.locator(tSel).first();
        if (await tLoc.isVisible().catch(() => false)) {
          onProgress(`[WhatsAppNode:Status] Clicking text status option (${tSel})...`);
          const clickable = tLoc.locator('xpath=ancestor-or-self::*[self::li or self::button or @role="button"][1]');
          const target = (await clickable.count().catch(() => 0)) > 0 ? clickable : tLoc;
          await target.click({ force: true }).catch(async () => {
            await target.dispatchEvent('click').catch(() => {});
          });
          await page.waitForTimeout(1500);
          break;
        }
      }

      const textEditorSelectors = [
        'div[aria-label="Type a status"]',
        'div[aria-label="اكتب حالة"]',
        'div[aria-placeholder="Type a status"]',
        'div[aria-placeholder="اكتب حالة"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        'div[role="textbox"]',
      ];

      let textEditor = null;
      for (const edSel of textEditorSelectors) {
        const ed = page.locator(edSel).first();
        if (await ed.isVisible({ timeout: 3500 }).catch(() => false)) {
          textEditor = ed;
          break;
        }
      }

      if (!textEditor) {
        throw new Error('Could not open WhatsApp text status editor. Escalating to AI Driver...');
      }

      onProgress('[WhatsAppNode:Status] Writing text status content...');
      await textEditor.click({ force: true });
      await this.pasteTextViaClipboard(page, content);
      await page.waitForTimeout(1000);

      const sendBtnSelectors = [
        'span[data-icon="send"]',
        'button[aria-label="Send"]',
        'div[aria-label="Send"]',
        'button[aria-label="إرسال"]',
        'div[aria-label="إرسال"]',
        'span[data-icon="status-send"]',
      ];

      let sent = false;
      for (const sSel of sendBtnSelectors) {
        const btn = page.locator(sSel).first();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await btn.click({ force: true });
          sent = true;
          break;
        }
      }
      if (!sent) {
        await page.keyboard.press('Enter');
      }

      await this.waitForStatusSendingToFinish(page, onProgress);
    } else {
      throw new Error('Cannot publish empty WhatsApp Status: no images or content provided.');
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
   * Helper: Monitors status transmission until "Sending..." indicator disappears and status is confirmed live
   */
  private async waitForStatusSendingToFinish(page: Page, onProgress: (msg: string) => void): Promise<void> {
    onProgress('[WhatsAppNode:Status] Monitoring status transmission and waiting for full upload...');
    const MAX_WAIT_SECONDS = 60; // Allow up to 60 seconds for multiple media files
    const startTime = Date.now();

    // Give WhatsApp a brief moment to transition from preview modal to sending state in left pane
    await page.waitForTimeout(2000);

    for (let i = 0; i < MAX_WAIT_SECONDS; i++) {
      const state = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';

        // 1. Is preview modal still open?
        const isPreviewOpen = !!document.querySelector(
          'div[aria-label="Add a caption" i], div[aria-label*="caption" i], div[aria-label*="Send" i], span[data-icon="wds-ic-send-filled"]'
        );

        // 2. Is "Sending..." indicator present?
        const isSending = /Sending\.\.\.|جاري الإرسال/i.test(bodyText);

        // 3. Is clock/time icon present on "My status"?
        const clockIcon = !!document.querySelector(
          'span[data-icon="status-time"], span[data-icon="time"], span[data-icon="pending"], span[data-icon="msg-time"]'
        );

        // 4. Look for "My status" item specifically to check its subtext
        const myStatusEl = Array.from(document.querySelectorAll('button, div[role="button"]')).find((el) => {
          const t = (el.textContent || '').trim();
          return t.includes('My status') || t.includes('حالتي');
        });
        const myStatusText = myStatusEl ? (myStatusEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
        const myStatusSending = /Sending\.\.\.|جاري الإرسال/i.test(myStatusText);

        return {
          isPreviewOpen,
          isSending: isSending || myStatusSending,
          clockIcon,
          myStatusText: myStatusText.substring(0, 60),
        };
      }).catch(() => ({ isPreviewOpen: false, isSending: false, clockIcon: false, myStatusText: '' }));

      // If still sending or preview is still open
      if (state.isSending || state.isPreviewOpen || state.clockIcon) {
        if (i % 3 === 0) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          onProgress(
            `[WhatsAppNode:Status] Media uploading in progress (${elapsed}s elapsed, status: "${state.myStatusText || 'Sending...'}")...`
          );
        }
        await page.waitForTimeout(1000);
        continue;
      }

      // If preview closed and "Sending..." is no longer in text:
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      onProgress(
        `[WhatsAppNode:Status] Transmission confirmed complete in ${elapsed}s! (Status: "${state.myStatusText || 'Live'}").`
      );
      // Wait extra 3 seconds grace period to ensure persistence and database flush
      await page.waitForTimeout(3000);
      return;
    }

    onProgress('[WhatsAppNode:Status] Max wait reached (60s). Finalizing task...');
  }

  /**
   * Helper: Dismisses any overlay modals, welcome popups, or notification requests
   */
  private async dismissBlockingModals(page: Page, onProgress?: (msg: string) => void): Promise<void> {
    try {
      const modalButtons = [
        'div[role="dialog"] button:has-text("Continue")',
        'div[role="dialog"] button:has-text("متابعة")',
        'div[role="dialog"] div[role="button"]:has-text("Continue")',
        'div[role="dialog"] div[role="button"]:has-text("متابعة")',
        'button:has-text("Continue")',
        'button:has-text("متابعة")',
        'div[role="dialog"] button:has-text("Get started")',
        'div[role="dialog"] button:has-text("ابدأ")',
        'div[role="dialog"] button:has-text("OK")',
        'div[role="dialog"] button:has-text("حسناً")',
        'div[role="dialog"] button:has-text("Not now")',
        'div[role="dialog"] button:has-text("ليس الآن")',
        'div[role="dialog"] button[aria-label="Close"]',
        'div[role="dialog"] button[aria-label="إغلاق"]',
        'div[role="dialog"] span[data-icon="x"]',
        'div[role="dialog"] span[data-icon="close"]',
      ];

      for (const sel of modalButtons) {
        const loc = page.locator(sel).first();
        if (await loc.isVisible({ timeout: 500 }).catch(() => false)) {
          if (onProgress) onProgress(`[WhatsAppNode] Auto-dismissing blocking modal via ${sel}...`);
          await loc.click({ force: true }).catch(() => {});
          await page.waitForTimeout(800);
          return;
        }
      }

      // Check if ANY modal dialog is present and try pressing Escape
      const hasDialog = await page.evaluate(() => {
        const d = document.querySelector('div[role="dialog"][aria-modal="true"], div[data-animate-modal-popup="true"]');
        return !!d;
      }).catch(() => false);

      if (hasDialog) {
        if (onProgress) onProgress('[WhatsAppNode] Modal overlay detected. Dismissing with Escape...');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);
      }
    } catch {}
  }

  /**
   * Helper: Waits for WhatsApp Web to be authenticated and ready
   */
  private async waitForWhatsAppReady(page: Page, onProgress: (msg: string) => void): Promise<boolean> {
    const MAX_WAIT = 25;
    for (let i = 0; i < MAX_WAIT; i++) {
      await this.dismissBlockingModals(page, onProgress);

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
   * Randomized human delay with natural Gaussian/jitter distribution
   */
  private async humanDelay(minMs: number = 700, maxMs: number = 1800): Promise<void> {
    const delta = maxMs - minMs;
    const ms = Math.floor(minMs + Math.random() * (delta > 0 ? delta : 500));
    await new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Zero-Ban Human-Like Mouse Trajectory & Click
   * Moves mouse realistically across intermediate points, hovers, pauses, clicks with physical down/up duration, and pauses after click.
   */
  private async humanMoveAndClick(
    page: Page,
    target: Locator | string,
    options: { timeout?: number; clickDelay?: number } = {}
  ): Promise<boolean> {
    try {
      const loc = typeof target === 'string' ? page.locator(target).first() : target;
      await loc.waitFor({ state: 'visible', timeout: options.timeout || 6000 }).catch(() => {});
      if (!(await loc.isVisible().catch(() => false))) return false;

      await loc.scrollIntoViewIfNeeded().catch(() => {});
      const box = await loc.boundingBox().catch(() => null);

      if (box && box.width > 0 && box.height > 0) {
        // Human offset: between 25% and 75% of element box (never exact mathematical center)
        const offsetX = box.x + box.width * (0.25 + Math.random() * 0.5);
        const offsetY = box.y + box.height * (0.25 + Math.random() * 0.5);

        // Human curve movement: 4 to 8 intermediate micro-steps
        const moveSteps = Math.floor(Math.random() * 5) + 4;
        await page.mouse.move(offsetX, offsetY, { steps: moveSteps }).catch(() => {});

        // Natural micro-hover (120 - 280ms)
        await this.humanDelay(120, 280);

        // Genuine physical down/up click with random human press duration
        const downUpDelay = options.clickDelay || (Math.floor(Math.random() * 80) + 70);
        await page.mouse.down().catch(() => {});
        await this.humanDelay(downUpDelay, downUpDelay + 40);
        await page.mouse.up().catch(() => {});
      } else {
        // Fallback if bounding box isn't directly exposed
        await loc.click({ force: true, delay: Math.floor(Math.random() * 70) + 60 }).catch(() => {});
      }

      // Natural post-click reaction pause (450ms - 900ms)
      await this.humanDelay(450, 900);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Zero-Ban Human-Like Clipboard Injection with Review Pauses
   */
  private async pasteTextViaClipboard(page: Page, text: string): Promise<void> {
    // Natural human preparation pause before pasting
    await this.humanDelay(350, 700);

    await page.evaluate((val) => {
      return navigator.clipboard.writeText(val).catch(() => {});
    }, text);

    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+V`);

    // Natural human reading/verification pause after pasting text
    await this.humanDelay(800, 1600);
  }

  /**
   * Static Macro & AI Driver Action Execution helper
   */
  private async executeActionOnPage(
    page: Page,
    actionObj: MacroAction,
    content: string,
    images: string[],
    onProgress: (msg: string) => void
  ): Promise<void> {
    const { action, selector, value } = actionObj;

    if (action === 'wait') {
      await this.humanDelay(2500, 4000);
    } else if (action === 'navigate') {
      await page.goto(value || 'https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
      await this.humanDelay(1500, 2500);
    } else if (action === 'click' && selector) {
      // Find the first VISIBLE matching element (not a hidden span or container)
      const allLocators = page.locator(selector);
      const count = await allLocators.count().catch(() => 0);
      let clicked = false;

      // Smart filechooser interceptor: if this click might trigger file selection, listen for it!
      const isMediaTrigger = images && images.length > 0 && /photo|media|video|صور|إضافة|plus|attach|file/i.test(selector);
      let fcPromise: Promise<any> | null = null;
      if (isMediaTrigger) {
        fcPromise = page.waitForEvent('filechooser', { timeout: 4500 }).catch(() => null);
      }

      for (let i = 0; i < count; i++) {
        const item = allLocators.nth(i);
        if (await item.isVisible({ timeout: 600 }).catch(() => false)) {
          await item.scrollIntoViewIfNeeded().catch(() => {});

          // Smart clickable element detection:
          // If the element is an inner span/svg, prefer clicking its parent button/clickable container!
          const clickableParent = item.locator('xpath=ancestor-or-self::*[self::button or @role="button"][1]');
          const targetToClick = (await clickableParent.count().catch(() => 0)) > 0 ? clickableParent : item;

          clicked = await this.humanMoveAndClick(page, targetToClick);
          break;
        }
      }

      if (!clicked) {
        // Fallback: click via first visible locator directly
        const loc = page.locator(selector).first();
        clicked = await this.humanMoveAndClick(page, loc);
      }

      // If file chooser was triggered during click, set files immediately!
      if (fcPromise) {
        const fc = await fcPromise;
        if (fc && images && images.length > 0) {
          onProgress(`[WhatsAppNode:Driver] File chooser intercepted! Attaching ${images.length} media file(s)...`);
          await fc.setFiles(images);
          await this.humanDelay(2000, 3500);
        }
      }
    } else if (action === 'type' && selector) {
      const loc = page.locator(selector).first();
      await this.humanMoveAndClick(page, loc);
      const textToType = value === '{CONTENT}' ? content : (value || content);
      await this.pasteTextViaClipboard(page, textToType);
    } else if (action === 'upload') {
      if (images && images.length > 0) {
        const fileInput = page.locator(selector || 'input[type="file"]').first();
        if ((await fileInput.count().catch(() => 0)) > 0) {
          await fileInput.setInputFiles(images);
          await this.humanDelay(2000, 3500);
        } else if (selector) {
          const loc = page.locator(selector).first();
          if (await loc.isVisible().catch(() => false)) {
            const [fc] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null),
              this.humanMoveAndClick(page, loc),
            ]);
            if (fc) {
              await fc.setFiles(images);
              await this.humanDelay(2000, 3500);
            }
          }
        }
      }
    } else if (action === 'fail') {
      throw new Error(`AI indicated failure: ${value}`);
    }
  }
}
