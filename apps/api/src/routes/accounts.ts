import { Router } from 'express';
import prisma from '../prisma';
import { dispatchConnectJobToLocalRunner } from '../ws/gateway';

const router = Router();

// Start connecting a Facebook account: create a placeholder row and let the
// local runner open a browser for manual login, then save the session.
router.post('/connect', async (req, res) => {
  try {
    const userId = req.userId!;
    const platform = (req.body?.platform || 'facebook').toLowerCase();

    const account = await prisma.socialAccount.create({
      data: {
        userId,
        platform,
        status: 'connecting',
      },
    });

    const dispatched = await dispatchConnectJobToLocalRunner(userId, account.id, platform);
    
    if (!dispatched) {
      await prisma.socialAccount.delete({ where: { id: account.id } });
      return res.status(400).json({ error: 'No active desktop runner found. Please pair your local PC first.' });
    }

    res.status(201).json({ id: account.id, status: account.status, platform: account.platform });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List accounts for the UI to render + poll. Never expose the stored session.
router.get('/', async (req, res) => {
  try {
    const userId = req.userId!;

    const accounts = await prisma.socialAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        platform: true,
        status: true,
        lastUsedAt: true,
        createdAt: true,
        destinations: true,
      },
    });

    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Re-detect the pages/destinations for an already-connected account, reusing
// the saved session (no manual re-login). Refreshes `destinations` in place.
router.post('/:id/detect-pages', async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const account = await prisma.socialAccount.findFirst({
      where: { id, userId },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (account.status !== 'active' || !account.encryptedStorageState) {
      return res.status(400).json({ error: 'Account has no saved session. Connect it first.' });
    }

    // TODO: implement dispatchRedetectJobToLocalRunner
    // await addRedetectJob({ socialAccountId: id });
    res.status(501).json({ error: 'Re-detect pages is currently being migrated to Zero-Ban architecture.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an account
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Ensure the account belongs to the user
    const account = await prisma.socialAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Delete associated jobs first to avoid foreign key constraints
    await prisma.job.deleteMany({
      where: { socialAccountId: id },
    });

    await prisma.socialAccount.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
