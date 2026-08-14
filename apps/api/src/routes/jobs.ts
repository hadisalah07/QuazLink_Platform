import { Router } from 'express';
import * as fs from 'fs';
import prisma from '../prisma';
import { addJobToQueue } from '../queue';

const router = Router();

// Create a job and add to queue.
// Job has no direct userId — ownership flows Job -> Post -> Campaign.userId,
// and the target account must belong to the caller too.
router.post('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const { postId, socialAccountId } = req.body;

    // Both referenced rows must belong to the caller, or a user could publish
    // another tenant's post through another tenant's account.
    const post = await prisma.post.findFirst({
      where: { id: postId, campaign: { userId } },
      select: { id: true },
    });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const account = await prisma.socialAccount.findFirst({
      where: { id: socialAccountId, userId },
      select: { id: true },
    });
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Create job in DB
    const job = await prisma.job.create({
      data: {
        postId,
        socialAccountId,
        status: 'pending'
      }
    });

    // Add to BullMQ
    await addJobToQueue({ jobId: job.id, postId, socialAccountId });

    res.status(201).json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get the caller's jobs only (scoped through the Post -> Campaign relation).
router.get('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const jobs = await prisma.job.findMany({
      where: { post: { campaign: { userId } } },
      include: { socialAccount: true, post: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(jobs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the proof screenshot the worker saved for a job — only if the job
// belongs to the caller.
router.get('/:id/screenshot', async (req, res) => {
  try {
    const userId = req.userId!;
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, post: { campaign: { userId } } },
    });
    if (!job || !job.screenshotUrl) {
      return res.status(404).json({ error: 'No screenshot for this job' });
    }
    if (!fs.existsSync(job.screenshotUrl)) {
      return res.status(404).json({ error: 'Screenshot file missing on disk' });
    }
    res.sendFile(job.screenshotUrl);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
