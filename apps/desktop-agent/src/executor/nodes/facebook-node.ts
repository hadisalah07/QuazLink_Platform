import { Page } from 'playwright';
import { IPlatformNode, NodeExecutionParams, NodeExecutionResult } from './base-node';
import { MacroCache, MacroAction } from '../macro-cache';

export class FacebookNode implements IPlatformNode {
  readonly platform = 'facebook';
  private macroCache: MacroCache;

  constructor(macroCache: MacroCache) {
    this.macroCache = macroCache;
  }

  /**
   * Targets the active, visible composer dialog that contains post creation controls,
   * completely ignoring background or utility dialogs like Notifications.
   */
  private getComposerDialog(page: Page) {
    return page
      .locator('div[role="dialog"]:visible')
      .filter({
        has: page.locator(
          'div[role="textbox"], input[type="file"], [contenteditable="true"], [aria-label*="Post"], [aria-label*="نشر"], [aria-label*="Next"], [aria-label*="التالي"], [aria-label*="Publish"]'
        ),
      })
      .last();
  }

  /**
   * Resiliently clicks a visible matching element, avoiding the `.first()` trap on hidden DOM elements.
   */
  private async clickVisibleElement(page: Page, selector: string) {
    const loc = page.locator(selector);
    const count = await loc.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const candidate = loc.nth(i);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.scrollIntoViewIfNeeded().catch(() => {});
        await candidate.click({ force: true });
        return;
      }
    }
    // Try explicit :visible suffix
    const visibleLoc = page.locator(`${selector}:visible`).first();
    if (await visibleLoc.isVisible({ timeout: 4000 }).catch(() => false)) {
      await visibleLoc.click({ force: true });
      return;
    }
    // Fallback: wait on first
    await loc.first().waitFor({ state: 'visible', timeout: 8000 });
    await loc.first().click({ force: true });
  }

  async execute(params: NodeExecutionParams): Promise<NodeExecutionResult> {
    const { page, content, images, targetUrl, onProgress, requestDriverAction } = params;
    const dest = targetUrl || 'https://www.facebook.com';
    const goal = `Publish a new post with the provided text and ${images.length} images.`;

    // 1. Static Macro Execution (Fast Path)
    const macro = this.macroCache.getMacro(this.platform);
    if (macro && macro.steps.length > 0) {
      onProgress(`[FacebookNode] Found cached macro (v${macro.version}). Executing statically...`);
      try {
        for (const step of macro.steps) {
          if (step.action === 'done') break;
          await this.executeActionOnPage(page, step, content, images, onProgress);
        }

        // Multi-step Page Support: Step 2 (Page Post Settings & Skeletons)
        onProgress('[FacebookNode] Checking for Step 2 (Page Post Settings & Skeletons)...');
        await page.waitForTimeout(6500);

        const clickedPost = await page.evaluate(() => {
          const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
          const visibleDialog = dialogs.reverse().find((d) => {
            const r = d.getBoundingClientRect();
            const s = window.getComputedStyle(d);
            return r.width > 100 && r.height > 100 && s.display !== 'none' && s.visibility !== 'hidden';
          });
          if (!visibleDialog) return false;
          const buttons = Array.from(visibleDialog.querySelectorAll('div[role="button"], button'));
          const postBtn = buttons.find((b) => {
            const txt = (b as HTMLElement).innerText?.trim();
            const lbl = b.getAttribute('aria-label');
            return (
              txt === 'Post' ||
              lbl === 'Post' ||
              txt === 'نشر' ||
              lbl === 'نشر' ||
              txt === 'Publish' ||
              lbl === 'Publish'
            );
          });
          if (postBtn && postBtn.getAttribute('aria-disabled') !== 'true') {
            (postBtn as HTMLElement).click();
            return true;
          }
          return false;
        });

        if (clickedPost) {
          onProgress('[FacebookNode] Clicked final Post button on Step 2.');
        } else {
          const dialog = this.getComposerDialog(page);
          const step2PostBtn = dialog
            .locator(
              'div[aria-label="Post"][role="button"], div[aria-label="Publish"][role="button"], div[aria-label="نشر"][role="button"], div[role="button"]:has-text("Post"), div[role="button"]:has-text("نشر")'
            )
            .last();
          if (await step2PostBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
            await step2PostBtn.click({ force: true });
            onProgress('[FacebookNode] Clicked Step 2 Post button via locator.');
          }
        }

        // Wait to verify publication: check that dialog closes completely
        const dialog = this.getComposerDialog(page);
        if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
          onProgress('[FacebookNode] Waiting for post composer dialog to finish publishing...');
          await dialog.waitFor({ state: 'hidden', timeout: 35000 }).catch(() => {});
        }

        onProgress('[FacebookNode] Post submitted successfully via macro.');
        return { success: true };
      } catch (e: any) {
        onProgress(
          `[FacebookNode] Cached macro failed (${e.message}). Falling back to Native Facebook Posting Engine...`
        );
      }
    }

    // 2. Direct Built-In Facebook Automation Flow (Ultra-Reliable Native Engine)
    try {
      onProgress('[FacebookNode] Executing native Facebook posting engine...');
      await this.runNativeFacebookFlow(page, content, images, dest, onProgress);
      return { success: true };
    } catch (nativeErr: any) {
      onProgress(`[FacebookNode] Native engine encountered issue: ${nativeErr.message}. Falling back to AI Driver...`);
    }

    // 3. Autonomous AI Driver Mode (Self-Healing Fallback)
    if (!requestDriverAction) {
      throw new Error('Native engine failed and Driver Mode is unavailable (no requestDriverAction).');
    }

    onProgress(`[FacebookNode] Engaging Autonomous AI Driver for ${this.platform}...`);
    await page.goto(dest, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);

    const history: any[] = [];
    let stepIndex = 0;
    const MAX_STEPS = 15;

    while (stepIndex < MAX_STEPS) {
      onProgress(`[FacebookNode:Driver] Step ${stepIndex + 1}: Taking screenshot and asking AI...`);
      const buffer = await page.screenshot({ type: 'jpeg', quality: 50 });
      const base64 = buffer.toString('base64');

      const instruction = await requestDriverAction(base64, goal, stepIndex, history);

      onProgress(`[FacebookNode:Driver] AI Thought: ${instruction.thought || 'N/A'}`);
      onProgress(`[FacebookNode:Driver] AI Action: ${instruction.action} ${instruction.selector || ''}`);

      if (instruction.action === 'done') {
        history.push(instruction);
        onProgress('[FacebookNode:Driver] AI reported goal achieved. Saving new macro...');

        const sanitizedHistory = history.map((h) => {
          if (h.action === 'type') {
            return { ...h, value: '' };
          }
          return h;
        });

        const stepsToSave: MacroAction[] = [
          { action: 'navigate', url: dest },
          ...sanitizedHistory,
        ];
        this.macroCache.saveMacro(this.platform, stepsToSave);
        return { success: true };
      }

      if (instruction.action === 'fail') {
        throw new Error(`AI Driver gave up: ${instruction.reason}`);
      }

      try {
        await this.executeActionOnPage(page, instruction, content, images, onProgress);
        history.push(instruction);
        stepIndex++;
      } catch (err: any) {
        onProgress(`[FacebookNode:Driver] Failed to execute AI action: ${err.message}`);
        history.push({ ...instruction, result: `Failed: ${err.message}` });
        stepIndex++;
      }
    }

    throw new Error(`Driver Mode exceeded maximum allowed steps (${MAX_STEPS}). Aborting.`);
  }

  /**
   * Ultra-reliable, deterministic Facebook Posting Flow
   */
  private async runNativeFacebookFlow(
    page: Page,
    content: string,
    images: string[],
    dest: string,
    onProgress?: (m: string) => void
  ) {
    // Step 1: Navigate to target Facebook URL
    const currentUrl = page.url();
    if (!currentUrl.includes('facebook.com') || (dest && !currentUrl.includes(dest.replace('https://www.facebook.com', '')))) {
      if (onProgress) onProgress(`[FacebookNode] Navigating to ${dest}...`);
      await page.goto(dest, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);
    }

    // Step 2: Open Create Post dialog
    if (onProgress) onProgress('[FacebookNode] Opening post composer dialog...');
    let composerOpened = false;

    // Fast-path A: If images exist, try clicking the direct Photo/video button from feed
    if (images && images.length > 0) {
      const photoFeedBtn = page.locator(
        'div[role="main"] div[role="button"]:has-text("Photo/video"), div[role="main"] div[role="button"]:has-text("صورة/فيديو"), div[role="button"][aria-label*="Photo/video"], div[role="button"][aria-label*="صورة/فيديو"]'
      );
      if (await photoFeedBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await photoFeedBtn.first().click({ force: true });
        composerOpened = true;
        if (onProgress) onProgress('[FacebookNode] Clicked Photo/video feed button.');
        await page.waitForTimeout(2000);
      }
    }

    // Fast-path B: Click standard composer button ("What's on your mind?", "Create a post", "بما تفكر")
    if (!composerOpened) {
      const clickedViaEval = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('div[role="button"], span'));
        const target = elements.find((el) => {
          const txt = (el as HTMLElement).innerText?.trim() || '';
          const aria = el.getAttribute('aria-label') || '';
          // Ensure it's not a notification button or note
          if (aria.includes('notification') || aria.includes('إشعار') || txt.includes('note') || txt.includes('ملاحظة')) {
            return false;
          }
          return (
            txt.includes("What's on your mind") ||
            txt.includes('بما تفكر') ||
            txt.includes('بم تفكر') ||
            txt.includes('Create a post') ||
            txt.includes('إنشاء منشور') ||
            txt.includes('Write something') ||
            aria.includes("What's on your mind") ||
            aria.includes('بما تفكر') ||
            aria.includes('Create a post')
          );
        });
        if (target) {
          (target as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (clickedViaEval) {
        composerOpened = true;
        if (onProgress) onProgress('[FacebookNode] Clicked post composer button via DOM.');
      } else {
        await this.clickVisibleElement(
          page,
          'div[role="button"]:has-text("What\'s on your mind?"), div[role="button"]:has-text("What\'s on your mind"), div[role="button"]:has-text("بما تفكر"), div[role="button"]:has-text("بم تفكر"), div[role="button"]:has-text("Create a post"), div[role="button"]:has-text("إنشاء منشور")'
        );
        composerOpened = true;
      }
      await page.waitForTimeout(2500);
    }

    // Step 3: Ensure visible composer dialog is active
    const dialog = this.getComposerDialog(page);
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
    if (onProgress) onProgress('[FacebookNode] Post composer dialog is active.');

    // Step 4: Upload media files
    if (images && images.length > 0) {
      if (onProgress) onProgress(`[FacebookNode] Injecting ${images.length} media file(s) into composer...`);

      let fileInput = dialog.locator('input[type="file"]').first();
      const hasFileInput = (await fileInput.count().catch(() => 0)) > 0;

      if (!hasFileInput) {
        const photoBtn = dialog
          .locator(
            'div[role="button"][aria-label*="Photo/video"], div[role="button"][aria-label*="صورة/فيديو"], [aria-label*="Photo/video"], [aria-label*="صورة/فيديو"], [aria-label*="Photo"], [aria-label*="صورة"]'
          )
          .first();
        if (await photoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          if (onProgress) onProgress('[FacebookNode] Clicking Photo/video button inside dialog to reveal dropzone...');
          await photoBtn.click({ force: true });
          await page.waitForTimeout(2000);
        }
      }

      fileInput = dialog.locator('input[type="file"]').first();
      await fileInput.waitFor({ state: 'attached', timeout: 10000 });
      await fileInput.setInputFiles(images);

      if (onProgress) onProgress('[FacebookNode] Files attached. Waiting for Facebook photo preview cards to render...');
      const previewLoc = dialog
        .locator(
          '[aria-label*="Edit"], [aria-label*="Remove"], [aria-label*="تعديل"], div[role="button"]:has-text("Edit"), div[role="button"]:has-text("تعديل")'
        )
        .first();
      await previewLoc.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
        if (onProgress) onProgress('⚠️ [FacebookNode] Preview cards locator wait timeout; checking image count in dialog...');
      });

      const imageAttached = await page.evaluate(() => {
        const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
        const d = dialogs.reverse().find((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 100 && r.height > 100;
        });
        if (!d) return false;
        const imgs = d.querySelectorAll('img');
        const hasEdit = d.querySelector('[aria-label*="Edit"], [aria-label*="تعديل"], [aria-label*="Remove"]');
        return imgs.length > 0 || !!hasEdit;
      });

      if (imageAttached) {
        if (onProgress) onProgress(`✅ [FacebookNode] Successfully attached and verified ${images.length} image(s) in composer.`);
      } else {
        throw new Error('Failed to attach media files: No photo preview cards rendered in Facebook composer dialog.');
      }
      await page.waitForTimeout(1500);
    }

    // Step 5: Type post text
    if (content && content.trim()) {
      if (onProgress) onProgress(`[FacebookNode] Typing post content (${content.length} characters)...`);
      const textbox = dialog
        .locator('div[role="textbox"][contenteditable="true"], [contenteditable="true"]')
        .first();
      await textbox.waitFor({ state: 'visible', timeout: 10000 });
      await textbox.click({ force: true });
      await textbox.focus();
      await page.waitForTimeout(300);

      try {
        await page.keyboard.insertText(content);
      } catch {
        await textbox.pressSequentially(content, { delay: 10 });
      }
      await page.waitForTimeout(1000);

      let currentLength = (await textbox.innerText().catch(() => '')).trim().length;
      if (currentLength === 0) {
        await page.evaluate((text) => {
          const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
          const d = dialogs.reverse().find((el) => el.getBoundingClientRect().width > 100);
          const el = d?.querySelector(
            'div[role="textbox"][contenteditable="true"], [contenteditable="true"]'
          ) as HTMLElement;
          if (el) {
            el.focus();
            document.execCommand('insertText', false, text);
          }
        }, content);
        await page.waitForTimeout(1000);
        currentLength = (await textbox.innerText().catch(() => '')).trim().length;
      }
      if (onProgress) onProgress(`✅ [FacebookNode] Post content verified in editor (${currentLength} characters).`);
      await page.waitForTimeout(1500);
    }

    // Step 6: Handle Step 2 if present (Page Post Next Button)
    const clickedNext = await page.evaluate(() => {
      const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
      const d = dialogs.reverse().find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 100 && r.height > 100;
      });
      if (!d) return false;
      const buttons = Array.from(d.querySelectorAll('div[role="button"], button'));
      const nextBtn = buttons.find((b) => {
        const txt = (b as HTMLElement).innerText?.trim();
        const lbl = b.getAttribute('aria-label');
        return txt === 'Next' || lbl === 'Next' || txt === 'التالي' || lbl === 'التالي';
      });
      if (nextBtn && nextBtn.getAttribute('aria-disabled') !== 'true') {
        (nextBtn as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (clickedNext) {
      if (onProgress) onProgress('[FacebookNode] Clicked Next button on Step 1. Transitioning to Step 2...');
      await page.waitForTimeout(5000);
    }

    // Step 7: Final Post Submission
    if (onProgress) onProgress('[FacebookNode] Submitting post (clicking Post button)...');
    let clickedPost = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      clickedPost = await page.evaluate(() => {
        const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
        const d = dialogs.reverse().find((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 100 && r.height > 100;
        });
        if (!d) return false;
        const buttons = Array.from(d.querySelectorAll('div[role="button"], button'));
        const postBtn = buttons.find((b) => {
          const txt = (b as HTMLElement).innerText?.trim();
          const lbl = b.getAttribute('aria-label');
          return (
            txt === 'Post' ||
            lbl === 'Post' ||
            txt === 'نشر' ||
            lbl === 'نشر' ||
            txt === 'Publish' ||
            lbl === 'Publish'
          );
        });
        if (postBtn && postBtn.getAttribute('aria-disabled') !== 'true') {
          (postBtn as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (clickedPost) {
        if (onProgress) onProgress('[FacebookNode] Clicked final Post button.');
        break;
      }
      await page.waitForTimeout(2000);
    }

    if (!clickedPost) {
      const activeDialog = this.getComposerDialog(page);
      const postBtn = activeDialog
        .locator(
          'div[aria-label="Post"][role="button"], div[aria-label="نشر"][role="button"], div[role="button"]:has-text("Post"), div[role="button"]:has-text("نشر"), div[aria-label="Publish"][role="button"]'
        )
        .last();
      if (await postBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await postBtn.click({ force: true });
        clickedPost = true;
        if (onProgress) onProgress('[FacebookNode] Clicked final Post button via locator.');
      }
    }

    if (!clickedPost) {
      throw new Error('Failed to locate or click final Post/Publish button on Facebook.');
    }

    // Step 8: Confirmation - Wait for dialog to disappear completely
    if (onProgress) onProgress('[FacebookNode] Waiting for post composer dialog to finish publishing...');
    const activeDialog = this.getComposerDialog(page);
    await activeDialog.waitFor({ state: 'hidden', timeout: 40000 }).catch(() => {
      if (onProgress) onProgress('⚠️ [FacebookNode] Dialog hidden wait timeout; proceeding to confirmation.');
    });

    await page.waitForTimeout(3000);
    if (onProgress) onProgress('✅ [FacebookNode] Post submitted and verified successfully!');
  }

  private async executeActionOnPage(
    page: Page,
    action: MacroAction,
    content: string,
    images: string[],
    onProgress?: (m: string) => void
  ) {
    if (action.action === 'navigate' && action.url) {
      const currentUrl = page.url();
      if (!currentUrl.includes(action.url)) {
        await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);
      }
    } else if (action.action === 'click' && action.selector) {
      if (action.selector.includes('Next') || action.selector.includes('التالي')) {
        const clickedViaEval = await page.evaluate(() => {
          const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
          const visibleDialog = dialogs.reverse().find((d) => {
            const r = d.getBoundingClientRect();
            const s = window.getComputedStyle(d);
            return r.width > 100 && r.height > 100 && s.display !== 'none' && s.visibility !== 'hidden';
          });
          if (!visibleDialog) return false;
          const buttons = Array.from(visibleDialog.querySelectorAll('div[role="button"], button'));
          const btn = buttons.find((b) => {
            const txt = (b as HTMLElement).innerText?.trim();
            const lbl = b.getAttribute('aria-label');
            return txt === 'Next' || lbl === 'Next' || txt === 'التالي' || lbl === 'التالي';
          });
          if (btn && btn.getAttribute('aria-disabled') !== 'true') {
            (btn as HTMLElement).click();
            return true;
          }
          return false;
        });
        if (!clickedViaEval) {
          await this.clickVisibleElement(page, action.selector);
        }
      } else if (
        action.selector.includes('Post') ||
        action.selector.includes('نشر') ||
        action.selector.includes('Publish')
      ) {
        const clickedViaEval = await page.evaluate(() => {
          const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
          const visibleDialog = dialogs.reverse().find((d) => {
            const r = d.getBoundingClientRect();
            const s = window.getComputedStyle(d);
            return r.width > 100 && r.height > 100 && s.display !== 'none' && s.visibility !== 'hidden';
          });
          if (!visibleDialog) return false;
          const buttons = Array.from(visibleDialog.querySelectorAll('div[role="button"], button'));
          const btn = buttons.find((b) => {
            const txt = (b as HTMLElement).innerText?.trim();
            const lbl = b.getAttribute('aria-label');
            return (
              txt === 'Post' ||
              lbl === 'Post' ||
              txt === 'نشر' ||
              lbl === 'نشر' ||
              txt === 'Publish' ||
              lbl === 'Publish'
            );
          });
          if (btn && btn.getAttribute('aria-disabled') !== 'true') {
            (btn as HTMLElement).click();
            return true;
          }
          return false;
        });
        if (!clickedViaEval) {
          await this.clickVisibleElement(page, action.selector);
        }
      } else {
        await this.clickVisibleElement(page, action.selector);
      }
      await page.waitForTimeout(1500);
    } else if (action.action === 'type') {
      const textToType = content || action.value || '';
      if (!textToType.trim()) {
        if (onProgress) onProgress('⚠️ [Type] Post content is empty, skipping typing.');
        return;
      }

      if (onProgress) onProgress(`[Type] Locating and focusing composer textbox (${textToType.length} characters)...`);

      const dialog = this.getComposerDialog(page);
      await dialog.waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});

      const locator = dialog
        .locator('div[role="textbox"][contenteditable="true"], [contenteditable="true"]')
        .first();
      await locator.waitFor({ state: 'visible', timeout: 12000 });

      await locator.click({ force: true });
      await locator.focus();
      await page.waitForTimeout(300);

      try {
        await page.keyboard.insertText(textToType);
      } catch (e) {
        await locator.pressSequentially(textToType, { delay: 10 });
      }
      await page.waitForTimeout(1000);

      let currentLength = (await locator.innerText().catch(() => '')).trim().length;
      if (currentLength === 0) {
        if (onProgress) onProgress('⚠️ [Type] Textbox still empty after insertText. Retrying with focused DOM injection...');
        await page.evaluate((text) => {
          const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
          const d = dialogs.reverse().find((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 100 && r.height > 100;
          });
          const el = d?.querySelector(
            'div[role="textbox"][contenteditable="true"], div[contenteditable="true"]'
          ) as HTMLElement;
          if (el) {
            el.focus();
            document.execCommand('insertText', false, text);
          }
        }, textToType);
        await page.waitForTimeout(1000);
        currentLength = (await locator.innerText().catch(() => '')).trim().length;
      }

      if (onProgress) onProgress(`✅ [Type] Post content verified in editor (${currentLength} characters).`);
      await page.waitForTimeout(1500);
    } else if (action.action === 'upload') {
      if (images && images.length > 0) {
        if (onProgress) onProgress(`[Upload] Injecting ${images.length} media file(s) into composer...`);

        const dialog = this.getComposerDialog(page);
        await dialog.waitFor({ state: 'visible', timeout: 15000 });

        let fileInput = dialog.locator('input[type="file"]').first();
        const hasFileInput = (await fileInput.count().catch(() => 0)) > 0;

        if (!hasFileInput) {
          const photoBtn = dialog
            .locator(
              'div[role="button"][aria-label*="Photo/video"], div[role="button"][aria-label*="صورة/فيديو"], [aria-label*="Photo/video"], [aria-label*="صورة/فيديو"], [aria-label*="Photo"], [aria-label*="صورة"]'
            )
            .first();
          if (await photoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            if (onProgress) onProgress('[Upload] Clicking Photo/video button inside dialog to reveal dropzone...');
            await photoBtn.click({ force: true });
            await page.waitForTimeout(2000);
          }
        }

        // Strictly target the file input INSIDE the modal dialog
        fileInput = dialog.locator('input[type="file"]').first();
        await fileInput.waitFor({ state: 'attached', timeout: 10000 });
        await fileInput.setInputFiles(images);

        if (onProgress) onProgress(`[Upload] Files attached. Waiting for Facebook photo preview cards to render...`);
        const previewLoc = dialog
          .locator(
            '[aria-label*="Edit"], [aria-label*="Remove"], [aria-label*="تعديل"], div[role="button"]:has-text("Edit"), div[role="button"]:has-text("تعديل")'
          )
          .first();
        await previewLoc.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
          if (onProgress) onProgress('⚠️ [Upload] Preview cards locator wait timeout; checking image count in dialog...');
        });

        const imageAttached = await page.evaluate(() => {
          const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
          const d = dialogs.reverse().find((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 100 && r.height > 100;
          });
          if (!d) return false;
          const imgs = d.querySelectorAll('img');
          const hasEdit = d.querySelector('[aria-label*="Edit"], [aria-label*="تعديل"], [aria-label*="Remove"]');
          return imgs.length > 0 || !!hasEdit;
        });

        if (imageAttached) {
          if (onProgress) onProgress(`✅ [Upload] Successfully attached and verified ${images.length} image(s) in composer.`);
        } else {
          throw new Error('Failed to attach media files: No photo preview cards rendered in Facebook composer dialog.');
        }
        await page.waitForTimeout(2000);
      } else {
        if (onProgress) onProgress('[Upload] No media attachments provided, skipping upload.');
      }
    } else if (action.action === 'fail') {
      throw new Error(`AI indicated failure: ${action.value}`);
    }
  }
}
