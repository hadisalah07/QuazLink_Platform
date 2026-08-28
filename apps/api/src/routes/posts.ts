import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { dispatchJobToLocalRunner } from '../ws/gateway';

const router = Router();

// One-shot compose: create the Campaign + Post, then a Job, and enqueue it.
// Merges "write" and "publish" into a single UI action.
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!; // guaranteed by requireAuth
    const { content, mediaUrls, socialAccountId, targetUrl } = req.body;

    if (!socialAccountId) {
      return res.status(400).json({ error: 'socialAccountId is required' });
    }

    // Ownership guard: the target account must belong to the caller, or a user
    // could publish through someone else's Facebook session (socialAccountId
    // comes straight from the request body).
    const account = await prisma.socialAccount.findFirst({
      where: { id: socialAccountId, userId },
      select: { id: true, destinations: true },
    });
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Target safety: never let an empty/foreign URL silently fall back to the
    // personal timeline in the worker. Require the target to be one of THIS
    // account's detected page destinations.
    const destinations = Array.isArray(account.destinations) ? (account.destinations as any[]) : [];
    if (!targetUrl || !destinations.some((d) => d?.url === targetUrl)) {
      return res.status(400).json({ error: 'A valid target page is required (must be one of the account destinations).' });
    }

    // Since we don't have a UI for campaigns yet, create a default one
    let campaign = await prisma.campaign.findFirst({
      where: { userId },
    });
    if (!campaign) {
      campaign = await prisma.campaign.create({
        data: { userId, name: 'Default Campaign', status: 'active' },
      });
    }

    const post = await prisma.post.create({
      data: {
        campaignId: campaign.id,
        content: content || '',
        mediaUrls: mediaUrls || [],
        status: 'processing',
      },
    });

    const job = await prisma.job.create({
      data: {
        postId: post.id,
        socialAccountId,
        status: 'pending',
        targetUrl,
      },
    });

    // Smart Hybrid Dispatch: If user's Desktop Runner is active, dispatch directly to user device!
    const dispatchedToRunner = await dispatchJobToLocalRunner(userId, {
      id: job.id,
      postId: post.id,
      content: post.content,
      mediaUrls: post.mediaUrls,
      targetUrl,
      socialAccountId,
    });

    // We no longer fallback to a background queue. If the runner is offline,
    // the job remains 'pending' and will be synced when the runner connects.

    res.status(201).json({
      jobId: job.id,
      postId: post.id,
      executionTarget: dispatchedToRunner ? 'local_desktop_runner' : 'pending_offline',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
