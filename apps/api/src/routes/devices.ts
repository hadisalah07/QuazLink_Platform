import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../prisma';
import { isUserDeviceOnline } from '../ws/gateway';

const router = Router();

// GET /api/devices - List all registered user devices
router.get('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const devices = await prisma.device.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        platform: true,
        status: true,
        appVersion: true,
        lastHeartbeat: true,
        keepAwake: true,
        createdAt: true,
      },
    });

    const isOnline = isUserDeviceOnline(userId);

    res.json({
      devices,
      isOnline,
      activeCount: devices.filter((d) => d.status === 'online').length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/devices/pair - Generate a new temporary pairing token
router.post('/pair', async (req, res) => {
  try {
    const userId = req.userId!;
    const { name = "My Desktop Runner", platform = "win32" } = req.body;

    // Generate a secure 6-character uppercase pairing code or hex token
    const pairingToken = 'QL-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    const device = await prisma.device.create({
      data: {
        userId,
        name,
        platform,
        pairingToken,
        status: 'offline',
      },
    });

    res.status(201).json({
      deviceId: device.id,
      pairingToken: device.pairingToken,
      instructions: `Enter this code in your QuazLink Desktop Agent to pair: ${pairingToken}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/devices/:id - Update device settings (e.g. keepAwake toggle, custom name)
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, keepAwake } = req.body;

    const device = await prisma.device.findFirst({
      where: { id, userId },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const updated = await prisma.device.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(keepAwake !== undefined && { keepAwake: Boolean(keepAwake) }),
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/devices/:id - Unpair / remove device
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    await prisma.device.deleteMany({
      where: { id, userId },
    });

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
