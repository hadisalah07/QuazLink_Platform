import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { extractClientIp, resolveGeoLocation } from '../lib/geoip';

const router = Router();

export const POS_LATEST_VERSION = '1.2.5';
export const POS_RELEASE_DATE = '2026-10-15';
export const POS_RELEASE_NOTES = `• محرك البحث الذكي والفوري (Live Autocomplete): شريط بحث فوري ومرن بالكامل للمنتجات، يدعم تطبيع الحروف العربية والإنجليزية والرموز، والبحث بأجزاء متعددة من الاسم أو الباركود، مع التنقل السلس بالأسهم وزر Enter للإضافة الفورية للفاتورة.
• خيارات الطباعة المباشرة من شاشة الفاتورة والكاشير: إمكانية اختيار القياس الافتراضي للطباعة (حراري 80mm / A4 / A5) بضغطة واحدة من واجهة الكاشير ومزامنة أزرار الحفظ والطباعة والدفع فورياً.
• بطاقة تفاصيل وملخص الفاتورة أعلى الحساب: بطاقة أنيقة تعرض نوع الفاتورة (مبيعات / مشتريات / قطاعي / جملة) مع إظهار اسم العميل ورقم الهاتف مباشرة وبشكل مريح قبل الدفع.
• دعم كامل وموحد لكافة نسخ ويندوز الحديثة (Windows 11 / 10) والقديمة (Windows 7 / 8 / POSReady 32-bit & 64-bit).`;

/**
 * POST /api/pos/telemetry
 * Automatic hardware beacon sent by QuazLink POS & ERP client upon boot/heartbeat.
 * Records machine specs, operating system, and geolocation without needing a user account.
 */
router.post('/telemetry', async (req: Request, res: Response) => {
  try {
    const {
      hardwareId,
      hostname,
      username,
      osPlatform,
      osRelease,
      osArch,
      cpuModel,
      totalMemoryMB,
      appVersion,
      businessName,
      licenseType,
      licenseKey,
    } = req.body ?? {};

    if (!hardwareId || typeof hardwareId !== 'string') {
      return res.status(400).json({ error: 'Valid hardwareId is required.' });
    }

    const ip = extractClientIp(req);
    const geo = await resolveGeoLocation(ip, req.headers as any);

    const terminal = await prisma.posTerminal.upsert({
      where: { hardwareId: hardwareId.trim() },
      create: {
        hardwareId: hardwareId.trim(),
        hostname: typeof hostname === 'string' ? hostname.trim() : 'POS-Workstation',
        username: typeof username === 'string' ? username.trim() : null,
        osPlatform: typeof osPlatform === 'string' ? osPlatform.trim() : 'win32',
        osRelease: typeof osRelease === 'string' ? osRelease.trim() : 'Windows',
        osArch: typeof osArch === 'string' ? osArch.trim() : 'x64',
        cpuModel: typeof cpuModel === 'string' ? cpuModel.trim() : 'Generic CPU',
        totalMemoryMB: typeof totalMemoryMB === 'number' ? totalMemoryMB : null,
        appVersion: typeof appVersion === 'string' ? appVersion.trim() : '1.1.0',
        businessName: typeof businessName === 'string' ? businessName.trim() : 'Retail Terminal',
        licenseType: typeof licenseType === 'string' ? licenseType.trim() : 'trial',
        licenseKey: typeof licenseKey === 'string' ? licenseKey.trim() : null,
        ipAddress: ip,
        country: geo.country,
        city: geo.city,
        countryCode: geo.countryCode,
        launchCount: 1,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
      update: {
        hostname: typeof hostname === 'string' ? hostname.trim() : undefined,
        username: typeof username === 'string' ? username.trim() : undefined,
        osPlatform: typeof osPlatform === 'string' ? osPlatform.trim() : undefined,
        osRelease: typeof osRelease === 'string' ? osRelease.trim() : undefined,
        osArch: typeof osArch === 'string' ? osArch.trim() : undefined,
        cpuModel: typeof cpuModel === 'string' ? cpuModel.trim() : undefined,
        totalMemoryMB: typeof totalMemoryMB === 'number' ? totalMemoryMB : undefined,
        appVersion: typeof appVersion === 'string' ? appVersion.trim() : undefined,
        businessName: typeof businessName === 'string' ? businessName.trim() : undefined,
        licenseType: typeof licenseType === 'string' ? licenseType.trim() : undefined,
        licenseKey: typeof licenseKey === 'string' ? licenseKey.trim() : undefined,
        ipAddress: ip,
        country: geo.country,
        city: geo.city,
        countryCode: geo.countryCode,
        lastSeenAt: new Date(),
        launchCount: { increment: 1 },
      },
    });

    console.log(`🏬 POS Terminal Registered: [${terminal.businessName}] (${geo.flag} ${geo.city}, ${geo.country}) [HW: ${terminal.hardwareId}]`);

    res.json({
      success: true,
      registered: true,
      terminalId: terminal.id,
      location: geo,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/pos/updates
 * Official POS update check endpoint (queries version, logs telemetry if hardwareId provided).
 */
router.get('/updates', async (req: Request, res: Response) => {
  try {
    const { currentVersion, hardwareId, hostname, businessName, osRelease } = req.query as Record<string, string>;
    const cleanCurrent = (currentVersion || '1.0.0').replace(/^v/i, '').trim();

    // If hardwareId is present in update check, asynchronously record/update terminal presence
    if (hardwareId && typeof hardwareId === 'string' && hardwareId.trim()) {
      const ip = extractClientIp(req);
      resolveGeoLocation(ip, req.headers as any).then(async (geo) => {
        try {
          await prisma.posTerminal.upsert({
            where: { hardwareId: hardwareId.trim() },
            create: {
              hardwareId: hardwareId.trim(),
              hostname: hostname?.trim() || 'POS-Terminal',
              osRelease: osRelease?.trim() || 'Windows',
              businessName: businessName?.trim() || 'Retail Terminal',
              appVersion: cleanCurrent,
              ipAddress: ip,
              country: geo.country,
              city: geo.city,
              countryCode: geo.countryCode,
              launchCount: 1,
              firstSeenAt: new Date(),
              lastSeenAt: new Date(),
            },
            update: {
              appVersion: cleanCurrent,
              ipAddress: ip,
              country: geo.country,
              city: geo.city,
              countryCode: geo.countryCode,
              lastSeenAt: new Date(),
              launchCount: { increment: 1 },
            },
          });
        } catch {}
      }).catch(() => {});
    }

    const isNewer = compareVersions(POS_LATEST_VERSION, cleanCurrent) > 0;

    const lowerOs = (osRelease || '').toLowerCase();
    const isLegacyWin =
      lowerOs.includes('6.1') ||
      lowerOs.includes('6.2') ||
      lowerOs.includes('6.3') ||
      lowerOs.includes('windows 7') ||
      lowerOs.includes('windows 8') ||
      lowerOs.includes('posready');

    const setupFilename = isLegacyWin ? 'QuazLink-POS-Legacy-Win7-Setup.exe' : 'QuazLink-POS-Setup.exe';
    const portableFilename = isLegacyWin ? 'QuazLink-POS-Legacy-Win7-Portable.exe' : 'QuazLink-POS-Portable.zip';

    const releaseTitle = isLegacyWin
      ? `QuazLink POS & ERP v${POS_LATEST_VERSION} (إصدار Legacy مخصص ومتوافق مع Windows 7 / 8 / POSReady - مع البحث الذكي الفوري والطباعة)`
      : `QuazLink POS & ERP v${POS_LATEST_VERSION} (محرك البحث الذكي الفوري، واختيار قياس الطباعة A4/A5، وتفاصيل الفاتورة)`;

    res.json({
      success: true,
      hasUpdate: isNewer,
      currentVersion: cleanCurrent,
      latestVersion: POS_LATEST_VERSION,
      minRequiredVersion: '1.0.0',
      releaseName: releaseTitle,
      releaseNotes: POS_RELEASE_NOTES,
      downloadUrl: `/downloads/${setupFilename}`,
      portableUrl: `/downloads/${portableFilename}`,
      assetSize: isLegacyWin ? 73974272 : 74212111,
      portableSize: isLegacyWin ? 73640804 : 73878193,
      publishedAt: new Date(POS_RELEASE_DATE).toISOString(),
      mandatory: false,
      isLegacyWin7: isLegacyWin,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = v2.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const n1 = p1[i] ?? 0;
    const n2 = p2[i] ?? 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

export default router;
