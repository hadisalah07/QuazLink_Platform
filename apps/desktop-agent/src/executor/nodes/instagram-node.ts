import { Page } from 'playwright';
import { IPlatformNode, NodeExecutionParams, NodeExecutionResult } from './base-node';
import { MacroCache, MacroAction } from '../macro-cache';

export class InstagramNode implements IPlatformNode {
  readonly platform = 'instagram';
  private macroCache: MacroCache;

  constructor(macroCache: MacroCache) {
    this.macroCache = macroCache;
  }

  async execute(params: NodeExecutionParams): Promise<NodeExecutionResult> {
    const { page, content, images, targetUrl, onProgress, requestDriverAction } = params;
    const dest = (targetUrl && !targetUrl.includes('facebook.com')) ? targetUrl : 'https://www.instagram.com';
    const goal = `Publish a new post on Instagram with the provided caption and ${images.length} images.`;

    if (!images || images.length === 0) {
      throw new Error('Instagram requires at least one media image to publish a post.');
    }

    // 1. Static Macro Execution (Fast Path)
    const macro = this.macroCache.getMacro(this.platform);
    if (macro && macro.steps.length > 0) {
      onProgress(`[InstagramNode] Found cached macro (v${macro.version}). Executing statically...`);
      try {
        for (const step of macro.steps) {
          if (step.action === 'done') break;
          await this.executeActionOnPage(page, step, content, images, onProgress);
        }

        // Wait to verify publication on Instagram
        onProgress('[InstagramNode] Waiting for Instagram publication confirmation...');
        await this.waitForPostConfirmation(page, onProgress);

        onProgress('[InstagramNode] Post published successfully to Instagram.');
        return { success: true };
      } catch (e: any) {
        onProgress(
          `[InstagramNode] Cached macro failed (${e.message}). Falling back to Autonomous Driver Mode without deleting macro...`
        );
      }
    }

    // 2. Direct Built-In Instagram Automation Flow (Ultra-Reliable Native Engine)
    try {
      onProgress('[InstagramNode] Executing native Instagram posting engine...');
      await this.runNativeInstagramFlow(page, content, images, dest, onProgress);
      return { success: true };
    } catch (nativeErr: any) {
      onProgress(`[InstagramNode] Native flow encountered issue: ${nativeErr.message}. Falling back to AI Driver...`);
    }

    // 3. Autonomous AI Driver Mode (Self-Healing Fallback)
    if (!requestDriverAction) {
      throw new Error('Native flow failed and Driver Mode is unavailable (no requestDriverAction).');
    }

    onProgress(`[InstagramNode] Engaging Autonomous AI Driver for ${this.platform}...`);
    await page.goto(dest, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);

    const history: any[] = [];
    let stepIndex = 0;
    const MAX_STEPS = 15;

    while (stepIndex < MAX_STEPS) {
      onProgress(`[InstagramNode:Driver] Step ${stepIndex + 1}: Taking screenshot and asking AI...`);
      const buffer = await page.screenshot({ type: 'jpeg', quality: 50 });
      const base64 = buffer.toString('base64');

      const instruction = await requestDriverAction(base64, goal, stepIndex, history);

      onProgress(`[InstagramNode:Driver] AI Thought: ${instruction.thought || 'N/A'}`);
      onProgress(`[InstagramNode:Driver] AI Action: ${instruction.action} ${instruction.selector || ''}`);

      if (instruction.action === 'done') {
        history.push(instruction);
        onProgress('[InstagramNode:Driver] AI reported goal achieved. Saving new macro...');

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
        onProgress(`[InstagramNode:Driver] Failed to execute AI action: ${err.message}`);
        history.push({ ...instruction, result: `Failed: ${err.message}` });
        stepIndex++;
      }
    }

    throw new Error(`Driver Mode exceeded maximum allowed steps (${MAX_STEPS}). Aborting.`);
  }

  /**
   * Native, battle-tested Instagram Web posting engine
   */
  private async runNativeInstagramFlow(
    page: Page,
    content: string,
    images: string[],
    dest: string,
    onProgress: (m: string) => void
  ) {
    onProgress(`[InstagramNode] Navigating to ${dest}...`);
    await page.goto(dest, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    // Check if session is valid or if redirected to login
    if (page.url().includes('/accounts/login') || page.url().includes('/login')) {
      throw new Error('Instagram session expired or not authenticated. Please reconnect your Instagram account.');
    }

    // Step 1: Open Create Modal from sidebar
    onProgress('[InstagramNode] Locating "Create" button on Instagram navigation...');
    const createTrigger = page
      .locator(
        'svg[aria-label="New post"], svg[aria-label="منشور جديد"], [aria-label="New post"], [aria-label="منشور جديد"], [aria-label="Create"], [aria-label="إنشاء"], a:has-text("Create"), span:has-text("Create"), a:has-text("إنشاء"), span:has-text("إنشاء")'
      )
      .first();

    await createTrigger.waitFor({ state: 'visible', timeout: 15000 });
    await createTrigger.click({ force: true });
    await page.waitForTimeout(1500);

    // Step 1.5: Instagram Web opens a popover submenu (Post, Live video, Ad). Click "Post"
    onProgress('[InstagramNode] Selecting "Post" from create menu...');
    try {
      await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('a, div[role="button"], button, span'));
        const postEl = all.find((el) => {
          const txt = (el as HTMLElement).innerText?.trim();
          return (txt === 'Post' || txt === 'منشور') && el.children.length === 0;
        });
        if (postEl) {
          const clickable = postEl.closest('a, div[role="button"], button') || postEl;
          (clickable as HTMLElement).click();
        }
      });
    } catch {
      // Fallback to locator click
      const postOption = page
        .locator('a:has-text("Post"), div[role="button"]:has-text("Post"), a:has-text("منشور"), div[role="button"]:has-text("منشور")')
        .first();
      if (await postOption.isVisible().catch(() => false)) {
        await postOption.click({ force: true });
      }
    }
    await page.waitForTimeout(2000);

    // Step 2: Ensure Dialog is Open
    const dialog = page.locator('div[role="dialog"]').first();
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
    onProgress('[InstagramNode] Create post dialog is active.');

    // Step 3: Inject Images into Instagram Dialog file input
    onProgress(`[InstagramNode] Injecting ${images.length} media file(s) into Instagram...`);
    const fileInput = page.locator('div[role="dialog"] input[type="file"], input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 10000 });
    await fileInput.setInputFiles(images);
    await page.waitForTimeout(3000);

    // Step 4: First "Next" (Crop Screen -> Filter Screen)
    onProgress('[InstagramNode] Navigating past Crop screen (Next)...');
    const nextBtn = page
      .locator(
        'div[role="dialog"] div[role="button"]:has-text("Next"), div[role="dialog"] button:has-text("Next"), div[role="dialog"] div[role="button"]:has-text("التالي"), div[role="dialog"] button:has-text("التالي")'
      )
      .first();

    await nextBtn.waitFor({ state: 'visible', timeout: 12000 });
    await nextBtn.click({ force: true });
    await page.waitForTimeout(2500);

    // Step 5: Second "Next" (Filter Screen -> Caption Screen)
    if (await nextBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      onProgress('[InstagramNode] Navigating past Filter screen (Next)...');
      await nextBtn.click({ force: true });
      await page.waitForTimeout(2500);
    }

    // Step 6: Caption Input
    if (content && content.trim()) {
      onProgress(`[InstagramNode] Entering post caption (${content.length} characters)...`);
      const captionBox = page
        .locator(
          'div[role="dialog"] div[aria-label="Add a caption..."], div[role="dialog"] div[aria-label="Write a caption..."], div[role="dialog"] [aria-label*="caption"], div[role="dialog"] [aria-label*="شرح"], div[role="dialog"] div[role="textbox"]'
        )
        .first();

      await captionBox.waitFor({ state: 'visible', timeout: 10000 });
      await captionBox.click({ force: true });
      await captionBox.focus();
      await page.waitForTimeout(400);

      try {
        await page.keyboard.insertText(content);
      } catch {
        await captionBox.pressSequentially(content, { delay: 10 });
      }
      await page.waitForTimeout(1000);
      onProgress('✅ [InstagramNode] Post caption entered.');
    }

    // Step 7: Click "Share" (Final submission)
    onProgress('[InstagramNode] Clicking "Share" to submit post...');
    const shareBtn = page
      .locator(
        'div[role="dialog"] div[role="button"]:has-text("Share"), div[role="dialog"] button:has-text("Share"), div[role="dialog"] div[role="button"]:has-text("مشاركة"), div[role="dialog"] button:has-text("مشاركة")'
      )
      .first();

    await shareBtn.waitFor({ state: 'visible', timeout: 10000 });
    await shareBtn.click({ force: true });

    // Step 8: Wait for Post Confirmation
    await this.waitForPostConfirmation(page, onProgress);
    onProgress('✅ [InstagramNode] Post published successfully!');

    // Save as verified macro
    const initialSteps: MacroAction[] = [
      { action: 'navigate', url: dest },
      {
        action: 'click',
        selector:
          'svg[aria-label="New post"], svg[aria-label="منشور جديد"], [aria-label="New post"], [aria-label="Create"], [aria-label="إنشاء"], span:has-text("Create"), span:has-text("إنشاء")',
      },
      { action: 'upload', selector: 'div[role="dialog"] input[type="file"]' },
      {
        action: 'click',
        selector:
          'div[role="dialog"] div[role="button"]:has-text("Next"), div[role="dialog"] button:has-text("Next"), div[role="dialog"] div[role="button"]:has-text("التالي"), div[role="dialog"] button:has-text("التالي")',
      },
      {
        action: 'click',
        selector:
          'div[role="dialog"] div[role="button"]:has-text("Next"), div[role="dialog"] button:has-text("Next"), div[role="dialog"] div[role="button"]:has-text("التالي"), div[role="dialog"] button:has-text("التالي")',
      },
      {
        action: 'type',
        selector:
          'div[role="dialog"] div[aria-label="Write a caption..."], div[role="dialog"] [aria-label*="caption"], div[role="dialog"] [aria-label*="شرح"], div[role="dialog"] div[role="textbox"]',
      },
      {
        action: 'click',
        selector:
          'div[role="dialog"] div[role="button"]:has-text("Share"), div[role="dialog"] button:has-text("Share"), div[role="dialog"] div[role="button"]:has-text("مشاركة"), div[role="dialog"] button:has-text("مشاركة")',
      },
      { action: 'done' },
    ];
    this.macroCache.saveMacro(this.platform, initialSteps);
  }

  private async waitForPostConfirmation(page: Page, onProgress: (m: string) => void) {
    onProgress('[InstagramNode] Waiting for Instagram upload confirmation...');
    const successLoc = page.locator(
      'text="Your post has been shared.", text="تمت مشاركة منشورك.", text="Post shared", text="Shared"'
    ).first();

    const dialog = page.locator('div[role="dialog"]').first();

    // Either confirmation text appears, or dialog hides completely
    await Promise.race([
      successLoc.waitFor({ state: 'visible', timeout: 45000 }).catch(() => {}),
      dialog.waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {}),
    ]);

    await page.waitForTimeout(3000);
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
      if (!currentUrl.includes('instagram.com')) {
        await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);
      }
    } else if (action.action === 'click' && action.selector) {
      const loc = page.locator(action.selector).first();
      await loc.waitFor({ state: 'visible', timeout: 12000 });
      await loc.click({ force: true });
      await page.waitForTimeout(2000);
    } else if (action.action === 'type') {
      const textToType = content || action.value || '';
      if (!textToType.trim()) return;

      const locator = page
        .locator(
          action.selector ||
            'div[role="dialog"] div[aria-label="Write a caption..."], div[role="dialog"] [aria-label*="caption"], div[role="dialog"] [aria-label*="شرح"], div[role="dialog"] div[role="textbox"]'
        )
        .first();

      await locator.waitFor({ state: 'visible', timeout: 12000 });
      await locator.click({ force: true });
      await locator.focus();
      await page.waitForTimeout(300);

      try {
        await page.keyboard.insertText(textToType);
      } catch {
        await locator.pressSequentially(textToType, { delay: 10 });
      }
      await page.waitForTimeout(1000);
    } else if (action.action === 'upload') {
      if (images && images.length > 0) {
        const dialog = page.locator('div[role="dialog"]').first();
        await dialog.waitFor({ state: 'visible', timeout: 15000 });

        const fileInput = page.locator('div[role="dialog"] input[type="file"]').first();
        await fileInput.waitFor({ state: 'attached', timeout: 10000 });
        await fileInput.setInputFiles(images);
        await page.waitForTimeout(3000);
      }
    } else if (action.action === 'fail') {
      throw new Error(`AI indicated failure: ${action.value}`);
    }
  }
}
