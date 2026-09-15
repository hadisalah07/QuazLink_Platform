import { Router } from 'express';
import * as fs from 'fs';
import prisma from '../prisma';

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

    // Removed cloud worker queue logic (addJobToQueue)
    // The Desktop Agent will automatically dispatch this if connected, 
    // or keep it pending until it connects.

    res.status(201).json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get the caller's jobs only (scoped through the Post -> Campaign relation).
router.get('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const jobs = await prisma.job.findMany({
      where: { post: { campaign: { userId } } },
      include: { socialAccount: true, post: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
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

    const raw = job.screenshotUrl.trim();

    // 1. Data URL (Base64)
    if (raw.startsWith('data:')) {
      const matches = raw.match(/^data:([^;]+);base64,(.+)$/s);
      if (matches) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(buffer);
      }
    }

    // 2. Raw Base64 without data URI scheme
    if (raw.startsWith('/9j/')) {
      const buffer = Buffer.from(raw, 'base64');
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(buffer);
    }
    if (raw.startsWith('iVBORw')) {
      const buffer = Buffer.from(raw, 'base64');
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(buffer);
    }

    // 3. Remote URL
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return res.redirect(raw);
    }

    // 4. File on disk (legacy workers)
    if (fs.existsSync(raw)) {
      return res.sendFile(raw);
    }

    return res.status(404).json({ error: 'Screenshot file missing on disk' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reset a stuck job back to pending
router.post('/:id/reset', async (req, res) => {
  try {
    const userId = req.userId!;
    
    // Ensure the job exists and belongs to the caller
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, post: { campaign: { userId } } },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only allow resetting if it's explicitly failed or errored. 
    // Dispatched jobs might be currently publishing, so resetting them would cause a double post.
    if (!['failed', 'error'].includes(job.status)) {
      return res.status(400).json({ error: `Cannot reset job in status '${job.status}'. Only failed jobs can be reset.` });
    }

    // Update job status to pending
    const updatedJob = await prisma.job.update({
      where: { id: job.id },
      data: { status: 'pending' },
    });

    // Removed BullMQ re-queueing. The Desktop Agent handles pending jobs.

    res.json(updatedJob);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
