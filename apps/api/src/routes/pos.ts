import { Router, Request, Response } from 'express';
import * as crypto from 'node:crypto';
import prisma from '../prisma';
import { extractClientIp, resolveGeoLocation } from '../lib/geoip';

const router = Router();

const SECRET_SALT = 'QUAZLINK_ENTERPRISE_ERP_CORE_SALT_2026';

export const POS_LATEST_VERSION = '1.3.7';
export const POS_RELEASE_DATE = '2026-10-22';
export const POS_RELEASE_NOTES = `• تحديثات الواجهة وتجربة المستخدم الممتازة (UI & UX Improvements):
• أيقونة زوم ذكية وقابلة للطي والتمدد (Collapsible Zoom Control): الأيقونة فقط تظهر في الهيدر العلوي لتوفير المساحة وتفتح بسلاسة عند الضغط عليها للتحكم بنسبة التكبير (+ 100% -).
• إغلاق تلقائي ذكي لعناصر التحكم في الزوم عند الضغط خارجها أو عند الضغط على زر ESC.
• نظام الإشعارات الفوري الذكي (Single Overwrite Toast Engine) لمنع تراكم الرسائل.
• وضع ملء الشاشة الفوري (Full-Screen Mode) المخصص لشاشات اللمس ونقاط البيع.
• إصلاحات عامة وتحسينات شاملة في سرعة واستقرار النظام.`;

/**
 * Smart lookup to find an existing POS Terminal by Motherboard UUID, Hardware ID, or Hostname+Username,
 * preventing duplicate cards when an app updates or changes network adapters.
 */
async function resolvePosTerminal(params: {
  hardwareId: string;
  motherboardUuid?: string | null;
  hostname?: string | null;
  username?: string | null;
}) {
  const cleanHwId = params.hardwareId.trim();

  // 1. Exact hardwareId match
  let existing = await prisma.posTerminal.findUnique({
    where: { hardwareId: cleanHwId },
  });
  if (existing) return existing;

  // 2. Motherboard UUID match (if provided and valid)
  const mbUuid = params.motherboardUuid?.trim();
  if (mbUuid && mbUuid.length > 8 && !mbUuid.toLowerCase().includes('default') && !mbUuid.toLowerCase().includes('none')) {
    existing = await prisma.posTerminal.findFirst({
      where: { motherboardUuid: mbUuid },
      orderBy: { lastSeenAt: 'desc' },
    });
    if (existing) return existing;
  }

  // 3. Exact hostname + username match on the same physical workstation
  const host = params.hostname?.trim();
  const user = params.username?.trim();
  if (host && user && host !== 'POS-Workstation' && host !== 'CASHIER-PC' && host !== 'Test-PC') {
    existing = await prisma.posTerminal.findFirst({
      where: {
        hostname: host,
        username: user,
      },
      orderBy: { lastSeenAt: 'desc' },
    });
    if (existing) return existing;
  }

  return null;
}

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
      cpuProcessorId,
      cpuCores,
      totalMemoryMB,
      motherboardUuid,
      motherboardSerial,
      motherboardMfr,
      motherboardModel,
      diskModel,
      diskSizeGB,
      biosVersion,
      rawHardware,
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
    const cleanHwId = hardwareId.trim();

    const existing = await resolvePosTerminal({
      hardwareId: cleanHwId,
      motherboardUuid,
      hostname,
      username,
    });

    let terminal;
    if (existing) {
      terminal = await prisma.posTerminal.update({
        where: { id: existing.id },
        data: {
          hardwareId: cleanHwId,
          hostname: typeof hostname === 'string' ? hostname.trim() : undefined,
          username: typeof username === 'string' ? username.trim() : undefined,
          osPlatform: typeof osPlatform === 'string' ? osPlatform.trim() : undefined,
          osRelease: typeof osRelease === 'string' ? osRelease.trim() : undefined,
          osArch: typeof osArch === 'string' ? osArch.trim() : undefined,
          cpuModel: typeof cpuModel === 'string' ? cpuModel.trim() : undefined,
          cpuProcessorId: typeof cpuProcessorId === 'string' ? cpuProcessorId.trim() : undefined,
          cpuCores: typeof cpuCores === 'number' ? cpuCores : undefined,
          totalMemoryMB: typeof totalMemoryMB === 'number' ? totalMemoryMB : undefined,
          motherboardUuid: typeof motherboardUuid === 'string' ? motherboardUuid.trim() : undefined,
          motherboardSerial: typeof motherboardSerial === 'string' ? motherboardSerial.trim() : undefined,
          motherboardMfr: typeof motherboardMfr === 'string' ? motherboardMfr.trim() : undefined,
          motherboardModel: typeof motherboardModel === 'string' ? motherboardModel.trim() : undefined,
          diskModel: typeof diskModel === 'string' ? diskModel.trim() : undefined,
          diskSizeGB: typeof diskSizeGB === 'number' ? diskSizeGB : undefined,
          biosVersion: typeof biosVersion === 'string' ? biosVersion.trim() : undefined,
          rawHardware: rawHardware || undefined,
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
    } else {
      terminal = await prisma.posTerminal.create({
        data: {
          hardwareId: cleanHwId,
          hostname: typeof hostname === 'string' ? hostname.trim() : 'POS-Workstation',
          username: typeof username === 'string' ? username.trim() : null,
          osPlatform: typeof osPlatform === 'string' ? osPlatform.trim() : 'win32',
          osRelease: typeof osRelease === 'string' ? osRelease.trim() : 'Windows',
          osArch: typeof osArch === 'string' ? osArch.trim() : 'x64',
          cpuModel: typeof cpuModel === 'string' ? cpuModel.trim() : 'Generic CPU',
          cpuProcessorId: typeof cpuProcessorId === 'string' ? cpuProcessorId.trim() : null,
          cpuCores: typeof cpuCores === 'number' ? cpuCores : null,
          totalMemoryMB: typeof totalMemoryMB === 'number' ? totalMemoryMB : null,
          motherboardUuid: typeof motherboardUuid === 'string' ? motherboardUuid.trim() : null,
          motherboardSerial: typeof motherboardSerial === 'string' ? motherboardSerial.trim() : null,
          motherboardMfr: typeof motherboardMfr === 'string' ? motherboardMfr.trim() : null,
          motherboardModel: typeof motherboardModel === 'string' ? motherboardModel.trim() : null,
          diskModel: typeof diskModel === 'string' ? diskModel.trim() : null,
          diskSizeGB: typeof diskSizeGB === 'number' ? diskSizeGB : null,
          biosVersion: typeof biosVersion === 'string' ? biosVersion.trim() : null,
          rawHardware: rawHardware || undefined,
          appVersion: typeof appVersion === 'string' ? appVersion.trim() : '1.1.0',
          businessName: typeof businessName === 'string' ? businessName.trim() : 'Retail Terminal',
          licenseType: typeof licenseType === 'string' ? licenseType.trim() : 'trial',
          licenseKey: typeof licenseKey === 'string' ? licenseKey.trim() : null,
          trialStartedAt: new Date(),
          ipAddress: ip,
          country: geo.country,
          city: geo.city,
          countryCode: geo.countryCode,
          launchCount: 1,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        },
      });
    }

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
      ? `QuazLink POS & ERP v${POS_LATEST_VERSION} (إصدار Legacy مخصص ومتوافق مع Windows 7 / 8 / POSReady - مع إصلاحات وتحسينات عامة)`
      : `QuazLink POS & ERP v${POS_LATEST_VERSION} (إصلاحات وتحسينات عامة، نظام الإشعارات الفوري، ووضع الشاشة الكاملة)`;

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

/**
 * POST /api/pos/trial/verify
 * Cloud Trial Ledger: Enforces the 30-day trial limit across Windows formats & reinstalls.
 */
router.post('/trial/verify', async (req: Request, res: Response) => {
  try {
    const {
      hardwareId,
      hostname,
      businessName,
      appVersion,
      osRelease,
      motherboardUuid,
      motherboardSerial,
      motherboardMfr,
      motherboardModel,
      cpuModel,
      cpuProcessorId,
      cpuCores,
      diskModel,
      diskSizeGB,
      biosVersion,
      totalMemoryMB,
      rawHardware,
    } = req.body ?? {};
    if (!hardwareId || typeof hardwareId !== 'string') {
      return res.status(400).json({ error: 'Valid hardwareId is required.' });
    }

    const cleanHwId = hardwareId.trim().toUpperCase();
    const ip = extractClientIp(req);
    const geo = await resolveGeoLocation(ip, req.headers as any);

    let terminal = await resolvePosTerminal({
      hardwareId: cleanHwId,
      motherboardUuid,
      hostname,
    });

    const now = new Date();
    const TRIAL_DAYS = 30;

    if (!terminal) {
      terminal = await prisma.posTerminal.create({
        data: {
          hardwareId: cleanHwId,
          hostname: typeof hostname === 'string' ? hostname.trim() : 'POS-Workstation',
          osRelease: typeof osRelease === 'string' ? osRelease.trim() : 'Windows',
          businessName: typeof businessName === 'string' ? businessName.trim() : 'Retail Terminal',
          appVersion: typeof appVersion === 'string' ? appVersion.trim() : POS_LATEST_VERSION,
          motherboardUuid: typeof motherboardUuid === 'string' ? motherboardUuid.trim() : null,
          motherboardSerial: typeof motherboardSerial === 'string' ? motherboardSerial.trim() : null,
          motherboardMfr: typeof motherboardMfr === 'string' ? motherboardMfr.trim() : null,
          motherboardModel: typeof motherboardModel === 'string' ? motherboardModel.trim() : null,
          cpuModel: typeof cpuModel === 'string' ? cpuModel.trim() : null,
          cpuProcessorId: typeof cpuProcessorId === 'string' ? cpuProcessorId.trim() : null,
          cpuCores: typeof cpuCores === 'number' ? cpuCores : null,
          diskModel: typeof diskModel === 'string' ? diskModel.trim() : null,
          diskSizeGB: typeof diskSizeGB === 'number' ? diskSizeGB : null,
          biosVersion: typeof biosVersion === 'string' ? biosVersion.trim() : null,
          totalMemoryMB: typeof totalMemoryMB === 'number' ? totalMemoryMB : null,
          rawHardware: rawHardware || undefined,
          licenseType: 'trial',
          trialStartedAt: now,
          ipAddress: ip,
          country: geo.country,
          city: geo.city,
          countryCode: geo.countryCode,
          launchCount: 1,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
    } else {
      terminal = await prisma.posTerminal.update({
        where: { id: terminal.id },
        data: {
          hardwareId: cleanHwId,
          lastSeenAt: now,
          launchCount: { increment: 1 },
          appVersion: typeof appVersion === 'string' ? appVersion.trim() : terminal.appVersion,
          motherboardUuid: typeof motherboardUuid === 'string' ? motherboardUuid.trim() : undefined,
          motherboardSerial: typeof motherboardSerial === 'string' ? motherboardSerial.trim() : undefined,
          motherboardMfr: typeof motherboardMfr === 'string' ? motherboardMfr.trim() : undefined,
          motherboardModel: typeof motherboardModel === 'string' ? motherboardModel.trim() : undefined,
          cpuModel: typeof cpuModel === 'string' ? cpuModel.trim() : undefined,
          cpuProcessorId: typeof cpuProcessorId === 'string' ? cpuProcessorId.trim() : undefined,
          cpuCores: typeof cpuCores === 'number' ? cpuCores : undefined,
          diskModel: typeof diskModel === 'string' ? diskModel.trim() : undefined,
          diskSizeGB: typeof diskSizeGB === 'number' ? diskSizeGB : undefined,
          biosVersion: typeof biosVersion === 'string' ? biosVersion.trim() : undefined,
          totalMemoryMB: typeof totalMemoryMB === 'number' ? totalMemoryMB : undefined,
          rawHardware: rawHardware || undefined,
        },
      });
    }

    // Calculate expiration based on trialStartedAt (Permanent Server Ground Truth)
    const firstSeen = new Date(terminal.firstSeenAt);
    const trialStart = new Date(terminal.trialStartedAt || terminal.firstSeenAt);
    const expiresAt = new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const diffMs = expiresAt.getTime() - now.getTime();
    const isExpired = diffMs <= 0;
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    let status = 'trial';
    if (terminal.licenseType === 'lifetime') {
      status = 'active';
    } else if (isExpired && terminal.licenseType === 'trial') {
      status = 'expired';
    }

    // Cryptographic signature
    const payload = {
      hw: cleanHwId,
      tier: terminal.licenseType || 'trial',
      firstSeenAt: firstSeen.toISOString(),
      expiresAt: terminal.licenseType === 'lifetime' ? null : expiresAt.toISOString(),
      status,
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', SECRET_SALT).update(b64).digest('hex').slice(0, 8).toUpperCase();
    const trialToken = `QLPOS-TRIAL-${b64}-${sig}`;

    res.json({
      success: true,
      hardwareId: cleanHwId,
      status,
      tier: terminal.licenseType || 'trial',
      firstSeenAt: firstSeen.toISOString(),
      expiresAt: terminal.licenseType === 'lifetime' ? null : expiresAt.toISOString(),
      daysRemaining: terminal.licenseType === 'lifetime' ? null : daysRemaining,
      trialToken,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
