import { Router } from 'express';
import authRouter from './auth';
import jobsRouter from './jobs';
import accountsRouter from './accounts';
import postsRouter from './posts';

import catalogsRouter from './catalogs';
import aiRouter from './ai';
import devicesRouter from './devices';
import integrationsRouter from './integrations';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Public auth endpoints (signup/login/logout). /me self-guards internally.
router.use('/auth', authRouter);

// Everything below requires a valid session or API Key (X-API-Key)
router.use('/jobs', requireAuth, jobsRouter);
router.use('/accounts', requireAuth, accountsRouter);
router.use('/posts', requireAuth, postsRouter);
router.use('/catalogs', requireAuth, catalogsRouter);
router.use('/ai', requireAuth, aiRouter);
router.use('/devices', requireAuth, devicesRouter);
router.use('/integrations', requireAuth, integrationsRouter);

export default router;
