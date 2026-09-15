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
          await captionBox.click({ force: true }).catch(() => {});
          await this.pasteTextViaClipboard(page, content);
          await page.waitForTimeout(1000);
        }

        // Click media send button
        onProgress('[WhatsAppNode:Direct] Clicking send button...');
        const sendBtnSelectors = [
          'div[aria-label*="Send" i]',
          'button[aria-label*="Send" i]',
          'span[data-icon="wds-ic-send-filled"]',
          'div:has(span[data-icon="wds-ic-send-filled"])',
          'span[data-icon="send"]',
          'div[aria-label*="إرسال" i]',
          'button[aria-label*="إرسال" i]',
        ];

        let sent = false;
        for (const sSel of sendBtnSelectors) {
          const sLoc = page.locator(sSel).first();
          if (await sLoc.isVisible({ timeout: 2000 }).catch(() => false)) {
            await sLoc.click({ force: true }).catch(() => {});
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
      await chatInput.click({ force: true }).catch(() => {});
      await this.pasteTextViaClipboard(page, content);
      await page.waitForTimeout(800);
      await page.keyboard.press('Enter');
    }

    onProgress('[WhatsAppNode:Direct] Waiting for transmission confirmation...');
    // Monitor transmission: wait until any pending clock icon disappears
    for (let i = 0; i < 20; i++) {
      const hasClock = await page
        .locator('span[data-icon="msg-time"], span[data-icon="time"], span[data-icon="pending"]')
        .isVisible()
        .catch(() => false);
      if (!hasClock && i >= 3) break;
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(2000);

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
        await loc.click({ force: true, timeout: 5000 }).catch(async () => {
          await this.dismissBlockingModals(page, onProgress);
          await loc.click({ force: true, timeout: 5000 }).catch(() => {});
        });
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
    await this.dismissBlockingModals(page, onProgress);

    // Look for "Add status" or photo upload input in Status drawer
    onProgress('[WhatsAppNode:Status] Selecting media/content for Status update...');

    if (images && images.length > 0) {
      let mediaAttached = false;

      // 1. First check if file input is already exposed in DOM
      let statusFileInput = page
        .locator('input[type="file"][accept*="image,video"], input[type="file"][accept*="image"], input[type="file"]')
        .first();

      if ((await statusFileInput.count()) > 0) {
        try {
          await statusFileInput.setInputFiles(images);
          mediaAttached = true;
          onProgress('[WhatsAppNode:Status] Media attached via direct DOM file input.');
        } catch {}
      }

      // 2. If not attached, locate and trigger the header "New status" (+) button
      if (!mediaAttached) {
        const addStatusSelectors = [
          'button[aria-label="Add Status" i]',
          'button[aria-label*="Status" i]:has-text("ic-add-circle")',
          'button:has-text("ic-add-circle")',
          'button[aria-label*="Add Status" i]',
          'button[aria-label*="حالة" i]',
          'header button:has(span[data-icon*="plus"])',
          'button:has(span[data-icon="plus-large"])',
          'button:has(span[data-icon="plus"])',
          'button:has(span[data-icon="status-v3-round-plus"])',
          'div[role="button"]:has(span[data-icon*="plus"])',
          'span[data-icon="plus-large"]',
          'span[data-icon="status-v3-round-plus"]',
          'span[data-icon="plus"]',
          'span[data-icon="status-add"]',
          'span[data-icon="camera"]',
          'div[role="button"]:has-text("ic-add")',
          'button[title="New status" i]',
          'button[title="حالة جديدة" i]',
        ];

        let plusClicked = false;
        for (const sel of addStatusSelectors) {
          const btn = page.locator(sel).first();
          if (await btn.isVisible().catch(() => false)) {
            onProgress(`[WhatsAppNode:Status] Clicking Add Status button (${sel})...`);
            // The click might trigger filechooser directly
            const fcPromise = page.waitForEvent('filechooser', { timeout: 2000 }).catch(() => null);
            
            const clickable = btn.locator('xpath=ancestor-or-self::*[self::button or @role="button"][1]');
            const target = (await clickable.count().catch(() => 0)) > 0 ? clickable : btn;
            await target.click({ force: true }).catch(async () => {
              await target.dispatchEvent('click').catch(() => {});
            });

            const fc = await fcPromise;
            if (fc) {
              await fc.setFiles(images);
              mediaAttached = true;
              onProgress('[WhatsAppNode:Status] Media attached via file chooser trigger.');
              break;
            }
            plusClicked = true;
            await page.waitForTimeout(1000);
            break;
          }
        }

        // Fallback DOM evaluation to find and click the status plus button
        if (!plusClicked && !mediaAttached) {
          const clickedDom = await page.evaluate(() => {
            const plusIcons = Array.from(document.querySelectorAll('span[data-icon*="plus"], span[data-icon*="status-add"], span[data-icon*="camera"]'));
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
            plusClicked = true;
            onProgress('[WhatsAppNode:Status] Clicked Status Plus button via DOM inspection.');
            await page.waitForTimeout(1000);
          }
        }
      }

      // 3. In WhatsApp Web, clicking Add Status reveals a dropdown menu:
      // Option 1: "Photos & videos" / "الصور ومقاطع الفيديو"
      // Option 2: "Text" / "نص"
      if (!mediaAttached) {
        const photoOptionSelectors = [
          'button[aria-label="Photos & videos" i]',
          'button:has-text("Photos & videos")',
          'button:has-text("الصور ومقاطع الفيديو")',
          'button:has-text("صور ومقاطع فيديو")',
          'li:has-text("Photos & videos")',
          'li:has-text("صور ومقاطع فيديو")',
          'li:has-text("الصور ومقاطع الفيديو")',
          'span:has-text("Photos & videos")',
          'span:has-text("صور ومقاطع فيديو")',
          'span:has-text("الصور ومقاطع الفيديو")',
          'span[data-icon="status-media"]',
          'span[data-icon="image"]',
          'span[data-icon="attach-image"]',
          'span[data-icon="camera"]',
          'button[aria-label*="Photos" i]',
          'button[aria-label*="صور" i]',
        ];

        for (const pSel of photoOptionSelectors) {
          const pLoc = page.locator(pSel).first();
          if (await pLoc.isVisible().catch(() => false)) {
            onProgress(`[WhatsAppNode:Status] Selecting menu option (${pSel})...`);
            const fcPromise = page.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null);
            
            const clickable = pLoc.locator('xpath=ancestor-or-self::*[self::li or self::button or @role="button"][1]');
            const target = (await clickable.count().catch(() => 0)) > 0 ? clickable : pLoc;
            await target.click({ force: true }).catch(async () => {
              await target.dispatchEvent('click').catch(() => {});
            });

            const fc = await fcPromise;
            if (fc) {
              await fc.setFiles(images);
              mediaAttached = true;
              onProgress('[WhatsAppNode:Status] Media attached via menu file chooser.');
              break;
            }
            await page.waitForTimeout(1000);
            break;
          }
        }
      }

      // 4. Check if file input is now exposed in DOM after clicking menu item
      if (!mediaAttached) {
        statusFileInput = page
          .locator('input[type="file"][accept*="image,video"], input[type="file"][accept*="image"], input[type="file"]')
          .first();
        if ((await statusFileInput.count()) > 0) {
          try {
            await statusFileInput.setInputFiles(images);
            mediaAttached = true;
            onProgress('[WhatsAppNode:Status] Media attached via newly rendered file input.');
          } catch {}
        }
      }

      // 5. CRITICAL: If media could not be attached, THROW ERROR so AI Driver can self-heal!
      if (!mediaAttached) {
        throw new Error(
          'Media file input could not be triggered in WhatsApp Web Status drawer. Escalating to Autonomous AI Driver...'
        );
      }

      onProgress('[WhatsAppNode:Status] Media attached successfully. Waiting for Status preview screen...');
      await page.waitForTimeout(3000);

      // Write caption in Status preview screen
      if (content) {
        onProgress('[WhatsAppNode:Status] Typing Status caption in media preview...');
        const captionSelectors = [
          'div[aria-label="Add a caption" i]',
          'div[aria-label="Add a caption..."]',
          'div[aria-label*="caption" i]',
          'div[aria-label*="شرح" i]',
          'div[aria-placeholder*="caption" i]',
          'div[aria-placeholder*="شرح" i]',
          'footer div[contenteditable="true"]',
          'div[contenteditable="true"][role="textbox"]',
          'div[role="textbox"]',
        ];

        for (const cSel of captionSelectors) {
          const captionBox = page.locator(cSel).first();
          if (await captionBox.isVisible({ timeout: 2000 }).catch(() => false)) {
            await captionBox.click({ force: true }).catch(() => {});
            await this.pasteTextViaClipboard(page, content);
            await page.waitForTimeout(800);
            break;
          }
        }
      }

      // Click Send Status button
      onProgress('[WhatsAppNode:Status] Publishing status...');
      const sendStatusSelectors = [
        'div[aria-label*="Send" i]',
        'button[aria-label*="Send" i]',
        'div[aria-label*="إرسال" i]',
        'button[aria-label*="إرسال" i]',
        'span[data-icon="wds-ic-send-filled"]',
        'div:has(span[data-icon="wds-ic-send-filled"])',
        'div:has-text("wds-ic-send-filled")',
        'span[data-icon="send"]',
        'span[data-icon="status-send"]',
        'button:has(span[data-icon*="send"])',
        'div[role="button"]:has(span[data-icon*="send"])',
      ];

      let sent = false;
      for (const sSel of sendStatusSelectors) {
        const sendBtn = page.locator(sSel).first();
        if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await sendBtn.click({ force: true });
          sent = true;
          break;
        }
      }
      if (!sent) {
        await page.keyboard.press('Enter');
      }
      await this.waitForStatusSendingToFinish(page, onProgress);
    } else if (content) {
      // Text-only WhatsApp Status
      onProgress('[WhatsAppNode:Status] Mode: Text-only Status update...');

      const addStatusSelectors = [
        'button[aria-label="Add Status" i]',
        'button[aria-label*="Status" i]:has-text("ic-add-circle")',
        'button:has-text("ic-add-circle")',
        'button[aria-label*="Add Status" i]',
        'button[aria-label*="حالة" i]',
        'header button:has(span[data-icon*="plus"])',
        'button:has(span[data-icon="plus-large"])',
        'button:has(span[data-icon="plus"])',
        'button:has(span[data-icon="status-v3-round-plus"])',
        'div[role="button"]:has(span[data-icon*="plus"])',
        'span[data-icon="plus-large"]',
        'span[data-icon="status-v3-round-plus"]',
        'span[data-icon="plus"]',
        'span[data-icon="status-add"]',
        'div[role="button"]:has-text("ic-add")',
        'button[title="New status" i]',
        'button[title="حالة جديدة" i]',
      ];

      let plusClicked = false;
      for (const sel of addStatusSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible().catch(() => false)) {
          onProgress(`[WhatsAppNode:Status] Clicking Add Status button (${sel})...`);
          const clickable = btn.locator('xpath=ancestor-or-self::*[self::button or @role="button"][1]');
          const target = (await clickable.count().catch(() => 0)) > 0 ? clickable : btn;
          await target.click({ force: true }).catch(async () => {
            await target.dispatchEvent('click').catch(() => {});
          });
          plusClicked = true;
          await page.waitForTimeout(1200);
          break;
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
          await page.waitForTimeout(1000);
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

    if (action === 'wait') {
      await page.waitForTimeout(3000);
    } else if (action === 'navigate') {
      await page.goto(value || 'https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
    } else if (action === 'click' && selector) {
      // Find the first VISIBLE matching element (not a hidden span or container)
      const allLocators = page.locator(selector);
      const count = await allLocators.count().catch(() => 0);
      let clicked = false;

      for (let i = 0; i < count; i++) {
        const item = allLocators.nth(i);
        if (await item.isVisible({ timeout: 500 }).catch(() => false)) {
          await item.scrollIntoViewIfNeeded().catch(() => {});

          // Smart clickable element detection:
          // If the element is an inner span/svg, prefer clicking its parent button/clickable container!
          const clickableParent = item.locator('xpath=ancestor-or-self::*[self::button or @role="button"][1]');
          const targetToClick = (await clickableParent.count().catch(() => 0)) > 0 ? clickableParent : item;

          await targetToClick.click({ force: true, timeout: 5000 }).catch(async () => {
            await targetToClick.dispatchEvent('click').catch(() => {});
          });
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        // Fallback: click via evaluate or first locator directly. NEVER press Escape!
        try {
          const clickedViaEval = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const target = el.closest('button') || el.closest('div[role="button"]') || el;
            (target as HTMLElement).click();
            return true;
          }, selector).catch(() => false);

          if (!clickedViaEval) {
            const loc = page.locator(selector).first();
            await loc.click({ timeout: 2500, force: true }).catch(async () => {
              await loc.dispatchEvent('click').catch(() => {});
            });
          }
        } catch {}
      }
    } else if (action === 'type' && selector) {
      const loc = page.locator(selector).first();
      await loc.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await loc.click({ force: true }).catch(() => {});
      const textToType = value === '{CONTENT}' ? content : (value || content);
      await this.pasteTextViaClipboard(page, textToType);
    } else if (action === 'upload') {
      if (images && images.length > 0) {
        const fileInput = page.locator(selector || 'input[type="file"]').first();
        if (await fileInput.count() > 0) {
          await fileInput.setInputFiles(images);
          await page.waitForTimeout(2000);
        } else if (selector) {
          const loc = page.locator(selector).first();
          if (await loc.isVisible().catch(() => false)) {
            const [fc] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null),
              loc.click({ force: true }).catch(() => {}),
            ]);
            if (fc) {
              await fc.setFiles(images);
              await page.waitForTimeout(2000);
            }
          }
        }
      }
    } else if (action === 'fail') {
      throw new Error(`AI indicated failure: ${value}`);
    }
  }
}
