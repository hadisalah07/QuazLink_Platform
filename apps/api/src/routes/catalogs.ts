import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { fetchProducts } from '../lib/catalog/fetchProducts';
import { encrypt } from '../lib/crypto';

const router = Router();

// GET /api/catalogs
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const catalogs = await prisma.catalog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    
    // Hide apiKey before sending to client for security
    const sanitized = catalogs.map(c => {
      const { apiKey, ...rest } = c;
      return rest;
    });

    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/catalogs
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, sourceType, apiUrl, apiKey, authScheme, authHeader } = req.body;

    if (!name || !apiUrl) {
      return res.status(400).json({ error: 'Name and API URL are required' });
    }

    const catalog = await prisma.catalog.create({
      data: {
        userId,
        name,
        sourceType: sourceType || 'custom',
        apiUrl,
        apiKey: apiKey ? encrypt(apiKey) : null,
        authScheme: authScheme || 'bearer',
        authHeader: authHeader || null,
      },
    });

    // Hide apiKey in response
    const { apiKey: _key, ...sanitized } = catalog;
    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/catalogs/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Verify ownership
    const catalog = await prisma.catalog.findUnique({ where: { id } });
    if (!catalog || catalog.userId !== userId) {
      return res.status(404).json({ error: 'Catalog not found' });
    }

    await prisma.catalog.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/catalogs/:id/products
router.get('/:id/products', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const catalog = await prisma.catalog.findUnique({ where: { id } });
    if (!catalog || catalog.userId !== userId) {
      return res.status(404).json({ error: 'Catalog not found' });
    }

    const products = await fetchProducts(catalog);
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
