import { Page } from 'playwright';
import { IPlatformNode, NodeExecutionParams, NodeExecutionResult } from './base-node';
import { MacroCache, MacroAction } from '../macro-cache';

export class FacebookNode implements IPlatformNode {
  readonly platform = 'facebook';
  private macroCache: MacroCache;

  constructor(macroCache: MacroCache) {
    this.macroCache = macroCache;
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
          const dialog = document.querySelector('div[role="dialog"]');
          if (!dialog) return false;
          const buttons = Array.from(dialog.querySelectorAll('div[role="button"], button'));
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
          const step2PostBtn = page
            .locator(
              'div[role="dialog"] div[aria-label="Post"][role="button"], div[role="dialog"] div[aria-label="Publish"][role="button"], div[role="dialog"] div[aria-label="نشر"][role="button"]'
            )
            .last();
          if (await step2PostBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
            await step2PostBtn.click({ force: true });
            onProgress('[FacebookNode] Clicked Step 2 Post button via locator.');
          }
        }

        // Wait to verify publication: check that dialog closes completely
        const dialog = page.locator('div[role="dialog"]').first();
        if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
          onProgress('[FacebookNode] Waiting for post composer dialog to finish publishing...');
          await dialog.waitFor({ state: 'hidden', timeout: 35000 }).catch(() => {});
        }

        onProgress('[FacebookNode] Post submitted successfully.');
        return { success: true };
      } catch (e: any) {
        onProgress(
          `[FacebookNode] Cached macro failed (${e.message}). Falling back to Driver Mode without deleting macro...`
        );
      }
    }

    // 2. Autonomous Driver Mode (AI Steering Fallback)
    if (!requestDriverAction) {
      throw new Error('No working macro found and Driver Mode is unavailable (no requestDriverAction).');
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
          const dialog = document.querySelector('div[role="dialog"]');
          if (!dialog) return false;
          const buttons = Array.from(dialog.querySelectorAll('div[role="button"], button'));
          const btn = buttons.find(
            (b) => {
              const txt = (b as HTMLElement).innerText?.trim();
              const lbl = b.getAttribute('aria-label');
              return txt === 'Next' || lbl === 'Next' || txt === 'التالي' || lbl === 'التالي';
            }
          );
          if (btn && btn.getAttribute('aria-disabled') !== 'true') {
            (btn as HTMLElement).click();
            return true;
          }
          return false;
        });
        if (!clickedViaEval) {
          const loc = page.locator(action.selector).first();
          await loc.waitFor({ state: 'visible', timeout: 8000 });
          await loc.click({ force: true });
        }
      } else {
        const loc = page.locator(action.selector).first();
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        await loc.click({ force: true });
      }
      await page.waitForTimeout(1500);
    } else if (action.action === 'type') {
      const textToType = content || action.value || '';
      if (!textToType.trim()) {
        if (onProgress) onProgress('⚠️ [Type] Post content is empty, skipping typing.');
        return;
      }

      if (onProgress) onProgress(`[Type] Locating and focusing composer textbox (${textToType.length} characters)...`);

      const locator = page
        .locator(
          'div[role="dialog"] div[role="textbox"][contenteditable="true"], div[role="dialog"] [contenteditable="true"]'
        )
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
          const dialog = document.querySelector('div[role="dialog"]');
          const el = dialog?.querySelector(
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

        const dialog = page.locator('div[role="dialog"]').first();
        await dialog.waitFor({ state: 'visible', timeout: 15000 });

        let fileInput = page.locator('div[role="dialog"] input[type="file"]').first();
        const hasFileInput = (await fileInput.count().catch(() => 0)) > 0;

        if (!hasFileInput) {
          const photoBtn = page
            .locator(
              'div[role="dialog"] div[role="button"][aria-label="Photo/video"], div[role="dialog"] div[role="button"][aria-label="صورة/فيديو"], div[role="dialog"] [aria-label*="Photo/video"], div[role="dialog"] [aria-label*="صورة/فيديو"], div[role="dialog"] [aria-label*="Photo"], div[role="dialog"] [aria-label*="صورة"]'
            )
            .first();
          if (await photoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            if (onProgress) onProgress('[Upload] Clicking Photo/video button inside dialog to reveal dropzone...');
            await photoBtn.click({ force: true });
            await page.waitForTimeout(2000);
          }
        }

        // Strictly target the file input INSIDE the modal dialog
        fileInput = page.locator('div[role="dialog"] input[type="file"]').first();
        await fileInput.waitFor({ state: 'attached', timeout: 10000 });
        await fileInput.setInputFiles(images);

        if (onProgress) onProgress(`[Upload] Files attached. Waiting for Facebook photo preview cards to render...`);
        const previewLoc = page
          .locator(
            'div[role="dialog"] [aria-label*="Edit"], div[role="dialog"] [aria-label*="Remove"], div[role="dialog"] [aria-label*="تعديل"], div[role="dialog"] div[role="button"]:has-text("Edit"), div[role="dialog"] div[role="button"]:has-text("تعديل")'
          )
          .first();
        await previewLoc.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
          if (onProgress) onProgress('⚠️ [Upload] Preview cards locator wait timeout; checking image count in dialog...');
        });

        const imageAttached = await page.evaluate(() => {
          const d = document.querySelector('div[role="dialog"]');
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
