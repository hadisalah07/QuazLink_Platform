import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { getCountryFlag } from '../lib/geoip';

const router = Router();

// Apply auth + admin guard across all endpoints in this router
router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/analytics
 * Comprehensive dashboard metrics, user directory, active sessions, and geographic breakdown.
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // 1. Parallel KPI Aggregations
    const [
      totalUsers,
      totalDevices,
      onlineDevicesCount,
      totalJobs,
      completedJobs,
      failedJobs,
      activeJobs,
      totalCampaigns,
      totalSocialAccounts,
      usersRaw,
      onlineDevicesRaw,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.device.count(),
      prisma.device.count({
        where: {
          status: 'online',
          lastHeartbeat: { gte: fiveMinutesAgo },
        },
      }),
      prisma.job.count(),
      prisma.job.count({ where: { status: 'completed' } }),
      prisma.job.count({ where: { status: 'failed' } }),
      prisma.job.count({ where: { status: { in: ['active', 'dispatched', 'pending'] } } }),
      prisma.campaign.count(),
      prisma.socialAccount.count(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          devices: {
            orderBy: { lastHeartbeat: 'desc' },
          },
          socialAccounts: {
            select: { id: true, platform: true, status: true },
          },
          _count: {
            select: { campaigns: true },
          },
        },
      }),
      prisma.device.findMany({
        where: {
          status: 'online',
          lastHeartbeat: { gte: fiveMinutesAgo },
        },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { lastHeartbeat: 'desc' },
      }),
    ]);

    // 2. Fetch Jobs count per user
    const userJobCounts = await prisma.job.groupBy({
      by: ['socialAccountId'],
      _count: { id: true },
    });

    // 3. Process Users Directory
    const countryMap = new Map<string, { country: string; countryCode: string; count: number; cities: Set<string> }>();

    const users = usersRaw.map((u) => {
      const isOnline = u.devices.some(
        (d) => d.status === 'online' && d.lastHeartbeat && d.lastHeartbeat >= fiveMinutesAgo
      );

      // Best effort country and city determination
      const primaryDevice = u.devices[0];
      const countryCode = u.countryCode || primaryDevice?.countryCode || 'EG';
      const country = u.country || primaryDevice?.country || 'Egypt';
      const city = u.city || primaryDevice?.city || 'Cairo';
      const flag = getCountryFlag(countryCode);

      // Aggregate geo stats
      const key = countryCode || 'UN';
      if (!countryMap.has(key)) {
        countryMap.set(key, {
          country,
          countryCode: key,
          count: 0,
          cities: new Set<string>(),
        });
      }
      const geoEntry = countryMap.get(key)!;
      geoEntry.count += 1;
      if (city && city !== 'Unknown' && city !== 'City Node') {
        geoEntry.cities.add(city);
      }

      // Calculate social platforms
      const platforms = Array.from(new Set(u.socialAccounts.map((s) => s.platform)));

      const isMasterAdmin = u.email.toLowerCase() === 'hadisalah07@gmail.com';
      const role = isMasterAdmin ? 'admin' : (u.role || 'user');

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role,
        isMasterAdmin,
        isOnline,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        lastLoginIp: u.lastLoginIp || primaryDevice?.ipAddress || null,
        location: {
          country,
          city,
          countryCode,
          flag,
        },
        devices: u.devices.map((d) => ({
          id: d.id,
          name: d.name,
          platform: d.platform,
          status: d.status,
          isOnline: d.status === 'online' && !!d.lastHeartbeat && d.lastHeartbeat >= fiveMinutesAgo,
          ipAddress: d.ipAddress,
          appVersion: d.appVersion || 'v26.10.14',
          lastHeartbeat: d.lastHeartbeat,
          country: d.country || country,
          city: d.city || city,
          flag: getCountryFlag(d.countryCode || countryCode),
        })),
        socialAccountsCount: u.socialAccounts.length,
        socialPlatforms: platforms,
        campaignsCount: u._count.campaigns,
      };
    });

    // 4. Build Geographic Distribution Breakdown
    const totalUsersCount = Math.max(1, users.length);
    const geoDistribution = Array.from(countryMap.values())
      .map((entry) => ({
        country: entry.country,
        countryCode: entry.countryCode,
        flag: getCountryFlag(entry.countryCode),
        count: entry.count,
        percentage: Math.round((entry.count / totalUsersCount) * 100),
        cities: Array.from(entry.cities).slice(0, 5),
      }))
      .sort((a, b) => b.count - a.count);

    // 5. Build Live Active Sessions
    const activeSessions = onlineDevicesRaw.map((d) => ({
      deviceId: d.id,
      deviceName: d.name,
      platform: d.platform,
      appVersion: d.appVersion || 'v26.10.14',
      status: d.status,
      lastHeartbeat: d.lastHeartbeat,
      ipAddress: d.ipAddress,
      user: {
        id: d.user.id,
        name: d.user.name,
        email: d.user.email,
      },
      location: {
        country: d.country || 'Global Node',
        city: d.city || 'Regional Node',
        countryCode: d.countryCode || 'UN',
        flag: getCountryFlag(d.countryCode),
      },
    }));

    // Active users count: users with active runner or logged in recently
    const activeUsersNow = users.filter((u) => u.isOnline).length;
    const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 100;

    res.json({
      kpis: {
        totalUsers,
        activeUsersNow,
        totalDevices,
        onlineDevicesCount,
        totalJobs,
        completedJobs,
        failedJobs,
        activeJobs,
        successRate,
        totalCampaigns,
        totalSocialAccounts,
      },
      geoDistribution,
      activeSessions,
      users,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/users/:userId/role
 * Allows updating user role between 'user' and 'admin'.
 */
router.patch('/users/:userId/role', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body ?? {};

    if (!role || (role !== 'user' && role !== 'admin')) {
      return res.status(400).json({ error: 'Role must be either "user" or "admin".' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Protect master admin from being demoted
    if (targetUser.email.toLowerCase() === 'hadisalah07@gmail.com' && role !== 'admin') {
      return res.status(400).json({ error: 'The Master Super Admin role cannot be demoted.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    res.json({ success: true, user: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
