import { Router, Request, Response } from 'express';
import * as crypto from 'node:crypto';
import prisma from '../prisma';
import { extractClientIp, resolveGeoLocation } from '../lib/geoip';
import { optionalAuth } from '../middleware/auth';

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

/**
 * -------------------------------------------------------------------------------------
 * ENTERPRISE MULTI-BRANCH CLOUD SYNC & LIVE MONITORING PIPELINE
 * -------------------------------------------------------------------------------------
 */

/**
 * Helper to get current Date string YYYY-MM-DD
 */
function getTodayDateString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

/**
 * POST /api/pos/sync/push
 * Ingests offline-first invoices, items, and cashier shifts from desktop POS terminals.
 * High-speed atomic aggregation for real-time owner command center.
 */
router.post('/sync/push', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      branchCode: rawBranchCode,
      hardwareId,
      licenseKey,
      invoices = [],
      shifts = [],
      tenantId: rawTenantId,
    } = req.body ?? {};

    const branchCode = (rawBranchCode || 'main').toString().trim().toLowerCase();
    const cleanHwId = hardwareId ? hardwareId.toString().trim() : null;

    // Resolve tenantId: (1) licenseKey decoded payload, (2) authenticated session, (3) hardware pairing, (4) explicit param, (5) default fallback
    let tenantId = (rawTenantId || '').toString().trim();

    if (licenseKey && typeof licenseKey === 'string' && licenseKey.includes('-')) {
      try {
        const parts = licenseKey.split('-');
        if (parts.length >= 3) {
          const b64 = parts[2];
          const decoded = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
          if (decoded.tenantId && decoded.tenantId !== 'default_tenant') {
            tenantId = decoded.tenantId;
          } else if (decoded.userId) {
            tenantId = decoded.userId;
          }
        }
      } catch (licErr) {
        // Fallback gracefully
      }
    }

    if ((!tenantId || tenantId === 'default_tenant') && req.userId) {
      tenantId = req.userId;
    }

    if ((!tenantId || tenantId === 'default_tenant') && cleanHwId) {
      try {
        const dev = await prisma.device.findFirst({
          where: { pairingToken: cleanHwId },
          select: { userId: true },
        });
        if (dev?.userId) {
          tenantId = dev.userId;
        }
      } catch (devErr) {
        // Fallback gracefully
      }
    }

    if (!tenantId) {
      tenantId = 'default_tenant';
    }

    // 1. Auto-register or ensure branch exists
    await prisma.posBranch.upsert({
      where: {
        tenantId_branchCode: {
          tenantId,
          branchCode,
        },
      },
      create: {
        tenantId,
        branchCode,
        name: branchCode === 'main' ? 'الفرع الرئيسي' : `فرع ${branchCode.toUpperCase()}`,
        isActive: true,
      },
      update: {
        isActive: true,
        updatedAt: new Date(),
      },
    });

    let savedInvoicesCount = 0;
    let savedShiftsCount = 0;
    const today = getTodayDateString();

    // 2. Ingest Invoices
    if (Array.isArray(invoices) && invoices.length > 0) {
      for (const item of invoices) {
        const inv = item.invoice || item;
        const localId = (inv.id || inv.localInvoiceId || '').toString().trim();
        if (!localId) continue;

        const total = parseFloat(inv.total_amount ?? inv.totalAmount ?? 0) || 0;
        const paid = parseFloat(inv.paid_amount ?? inv.paidAmount ?? total) || 0;
        const remaining = parseFloat(inv.remaining_amount ?? inv.remainingAmount ?? 0) || 0;
        const method = (inv.payment_method ?? inv.paymentMethod ?? 'cash').toString();
        const status = (inv.status ?? 'completed').toString();
        const cashier = (inv.cashier_name ?? inv.cashierName ?? 'كاشير').toString();
        const invNumber = (inv.invoice_number ?? inv.invoiceNumber ?? `INV-${localId.slice(0, 8)}`).toString();
        const rawItems = item.items || inv.rawItems || null;
        const itemsCount = Array.isArray(rawItems) ? rawItems.length : (parseInt(inv.items_count ?? inv.itemsCount ?? '1', 10) || 1);
        const createdAt = inv.created_at ? new Date(inv.created_at) : new Date();

        await prisma.posInvoiceSync.upsert({
          where: {
            tenantId_branchCode_localInvoiceId: {
              tenantId,
              branchCode,
              localInvoiceId: localId,
            },
          },
          create: {
            tenantId,
            branchCode,
            hardwareId: cleanHwId,
            localInvoiceId: localId,
            invoiceNumber: invNumber,
            customerName: inv.customer_name || inv.customerName || null,
            customerPhone: inv.customer_phone || inv.customerPhone || null,
            totalAmount: total,
            paidAmount: paid,
            remainingAmount: remaining,
            paymentMethod: method,
            status,
            cashierName: cashier,
            itemsCount,
            rawItems: rawItems ? rawItems : undefined,
            localCreatedAt: createdAt,
            syncedAt: new Date(),
          },
          update: {
            totalAmount: total,
            paidAmount: paid,
            remainingAmount: remaining,
            paymentMethod: method,
            status,
            rawItems: rawItems ? rawItems : undefined,
            syncedAt: new Date(),
          },
        });
        savedInvoicesCount++;
      }
    }

    // 3. Ingest Shifts
    if (Array.isArray(shifts) && shifts.length > 0) {
      for (const s of shifts) {
        const shift = s.shift || s;
        const localShiftId = (shift.id || shift.localShiftId || '').toString().trim();
        if (!localShiftId) continue;

        const cashier = (shift.cashier_name || shift.cashierName || 'كاشير').toString();
        const status = (shift.status || 'open').toString();
        const startCash = parseFloat(shift.starting_cash ?? shift.startingCash ?? 0) || 0;
        const expCash = parseFloat(shift.expected_cash ?? shift.expectedCash ?? 0) || 0;
        const actCash = parseFloat(shift.actual_cash ?? shift.actualCash ?? 0) || 0;
        const diff = parseFloat(shift.difference ?? 0) || 0;
        const totalSales = parseFloat(shift.total_sales ?? shift.totalSales ?? 0) || 0;
        const invoicesCount = parseInt(shift.invoices_count ?? shift.invoicesCount ?? '0', 10) || 0;

        await prisma.posShiftSync.upsert({
          where: {
            tenantId_branchCode_localShiftId: {
              tenantId,
              branchCode,
              localShiftId,
            },
          },
          create: {
            tenantId,
            branchCode,
            hardwareId: cleanHwId,
            localShiftId,
            cashierName: cashier,
            status,
            openedAt: shift.opened_at ? new Date(shift.opened_at) : new Date(),
            closedAt: shift.closed_at ? new Date(shift.closed_at) : null,
            startingCash: startCash,
            expectedCash: expCash,
            actualCash: actCash,
            difference: diff,
            totalSales,
            invoicesCount,
            rawZReport: shift.z_report || shift.rawZReport || undefined,
            syncedAt: new Date(),
          },
          update: {
            status,
            closedAt: shift.closed_at ? new Date(shift.closed_at) : null,
            expectedCash: expCash,
            actualCash: actCash,
            difference: diff,
            totalSales,
            invoicesCount,
            rawZReport: shift.z_report || shift.rawZReport || undefined,
            syncedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        savedShiftsCount++;
      }
    }

    // 4. Update Pre-aggregated Daily Stats for high-speed sub-millisecond retrieval
    const dayStart = new Date(`${today}T00:00:00.000Z`);
    const dayEnd = new Date(`${today}T23:59:59.999Z`);

    const dailyInvoices = await prisma.posInvoiceSync.findMany({
      where: {
        tenantId,
        branchCode,
        createdAt: { gte: dayStart, lte: dayEnd },
        status: 'completed',
      },
    });

    const totalSales = dailyInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalCash = dailyInvoices.filter((i) => i.paymentMethod === 'cash').reduce((sum, i) => sum + i.paidAmount, 0);
    const totalCard = dailyInvoices.filter((i) => i.paymentMethod === 'card').reduce((sum, i) => sum + i.paidAmount, 0);
    const totalCredit = dailyInvoices.reduce((sum, i) => sum + i.remainingAmount, 0);
    const estimatedNetProfit = totalSales * 0.28; // Estimated 28% margin if cost not synced

    const activeShiftsCount = await prisma.posShiftSync.count({
      where: {
        tenantId,
        branchCode,
        status: 'open',
      },
    });

    await prisma.posBranchDailyStats.upsert({
      where: {
        tenantId_branchCode_date: {
          tenantId,
          branchCode,
          date: today,
        },
      },
      create: {
        tenantId,
        branchCode,
        date: today,
        totalSales,
        totalInvoices: dailyInvoices.length,
        totalCash,
        totalCard,
        totalCredit,
        netProfit: estimatedNetProfit,
        activeShifts: activeShiftsCount,
        lastSyncAt: new Date(),
      },
      update: {
        totalSales,
        totalInvoices: dailyInvoices.length,
        totalCash,
        totalCard,
        totalCredit,
        netProfit: estimatedNetProfit,
        activeShifts: activeShiftsCount,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Cloud Sync Ingestion completed successfully.',
      pushedInvoices: savedInvoicesCount,
      pushedShifts: savedShiftsCount,
      branchCode,
      serverTimestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [POS Sync Error]:', error);
    res.status(500).json({ error: error.message || 'Sync failed.' });
  }
});

/**
 * GET /api/pos/sync/pull
 * Supplies updates to the desktop POS client (e.g. cloud price updates, products catalog).
 */
router.get('/sync/pull', async (req: Request, res: Response) => {
  try {
    const { branch = 'main', tenantId = 'default_tenant' } = req.query as Record<string, string>;
    res.json({
      success: true,
      branch,
      products: [],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/pos/branches
 * Returns all registered branches for the enterprise tenant or authenticated account.
 */
router.get('/branches', optionalAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.userId || (req.query.tenantId as string) || 'default_tenant';
    let branches = await prisma.posBranch.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    // If no branches exist yet, provide default branches
    if (branches.length === 0) {
      if (req.userId) {
        // Create initial primary branch for new user account
        await prisma.posBranch.create({
          data: {
            tenantId,
            branchCode: 'main',
            name: 'الفرع الرئيسي (HQ)',
            city: 'القاهرة',
            isActive: true,
          },
        });
      } else {
        const defaultBranches = [
          { branchCode: 'main', name: 'الفرع الرئيسي (المعادي)', city: 'القاهرة' },
          { branchCode: 'branch_nasr', name: 'فرع مدينة نصر', city: 'القاهرة' },
          { branchCode: 'branch_tagamoa', name: 'فرع التجمع الخامس', city: 'القاهرة الجديدة' },
        ];
        for (const b of defaultBranches) {
          await prisma.posBranch.create({
            data: {
              tenantId,
              branchCode: b.branchCode,
              name: b.name,
              city: b.city,
              isActive: true,
            },
          });
        }
      }
      branches = await prisma.posBranch.findMany({ where: { tenantId, isActive: true }, orderBy: { createdAt: 'asc' } });
    }

    res.json({ success: true, branches });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/pos/branches
 * Creates or updates a branch linked to the owner's enterprise account.
 */
router.post('/branches', optionalAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.userId || (req.body.tenantId as string) || 'default_tenant';
    const { branchCode: rawCode, name, city, phone, address } = req.body ?? {};

    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      return res.status(400).json({ error: 'كود الفرع (Branch Code) مطلوب.' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'اسم الفرع (Branch Name) مطلوب.' });
    }

    const branchCode = rawCode.trim().toLowerCase().replace(/\s+/g, '_');

    const branch = await prisma.posBranch.upsert({
      where: {
        tenantId_branchCode: {
          tenantId,
          branchCode,
        },
      },
      create: {
        tenantId,
        branchCode,
        name: name.trim(),
        city: city?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        isActive: true,
      },
      update: {
        name: name.trim(),
        city: city?.trim() || undefined,
        phone: phone?.trim() || undefined,
        address: address?.trim() || undefined,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, branch });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save branch' });
  }
});

/**
 * GET /api/pos/monitor/live
 * The Live Command Center Endpoint: Fetches real-time KPIs, active shifts, and live sales stream.
 */
router.get('/monitor/live', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      branchCode = 'all',
      date = getTodayDateString(),
      tenantId: rawTenantId,
    } = req.query as Record<string, string>;

    // Strict Account / Tenant resolution
    let tenantId = (rawTenantId || '').toString().trim();
    if (req.userId) {
      tenantId = req.userId;
    }
    if (!tenantId) {
      tenantId = 'default_tenant';
    }

    const isAllBranches = !branchCode || branchCode === 'all';
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    // Fetch Account / Organization Info if authenticated
    let accountInfo: {
      userId: string | null;
      email: string | null;
      name: string | null;
      businessName: string;
      planName: string;
      isEnterprise: boolean;
      totalBranches: number;
    } | null = null;

    if (req.userId) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, name: true, role: true },
      });
      if (user) {
        accountInfo = {
          userId: user.id,
          email: user.email,
          name: user.name,
          businessName: user.name ? `${user.name} Retail OS` : 'مؤسسة التجزئة الذكية',
          planName: 'Enterprise Multi-Branch License',
          isEnterprise: true,
          totalBranches: 0,
        };
      }
    }

    // 1. Fetch Branches for this Tenant
    let branches = await prisma.posBranch.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (branches.length === 0) {
      if (req.userId) {
        // Create initial primary branch for new user account
        await prisma.posBranch.create({
          data: {
            tenantId,
            branchCode: 'main',
            name: accountInfo?.businessName ? `الفرع الرئيسي - ${accountInfo.businessName}` : 'الفرع الرئيسي (HQ)',
            city: 'القاهرة',
            isActive: true,
          },
        });
        branches = await prisma.posBranch.findMany({ where: { tenantId, isActive: true }, orderBy: { createdAt: 'asc' } });
      } else {
        // Seed default branches for public showcase
        await prisma.posBranch.createMany({
          data: [
            { tenantId, branchCode: 'main', name: 'الفرع الرئيسي (المعادي)', city: 'القاهرة', isActive: true },
            { tenantId, branchCode: 'branch_nasr', name: 'فرع مدينة نصر', city: 'القاهرة', isActive: true },
            { tenantId, branchCode: 'branch_tagamoa', name: 'فرع التجمع الخامس', city: 'القاهرة الجديدة', isActive: true },
          ],
        });
        branches = await prisma.posBranch.findMany({ where: { tenantId, isActive: true }, orderBy: { createdAt: 'asc' } });
      }
    }

    if (accountInfo) {
      accountInfo.totalBranches = branches.length;
    }

    // 2. Query Invoices for KPI & Stream
    const invoiceFilter: any = {
      tenantId,
      createdAt: { gte: dayStart, lte: dayEnd },
      status: 'completed',
    };
    if (!isAllBranches) {
      invoiceFilter.branchCode = branchCode;
    }

    const todayInvoices = await prisma.posInvoiceSync.findMany({
      where: invoiceFilter,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 3. Query Daily Stats for aggregated summary
    const statsFilter: any = { tenantId, date };
    if (!isAllBranches) {
      statsFilter.branchCode = branchCode;
    }
    const branchStats = await prisma.posBranchDailyStats.findMany({
      where: statsFilter,
    });

    const todaySales = branchStats.length > 0
      ? branchStats.reduce((sum, s) => sum + s.totalSales, 0)
      : todayInvoices.reduce((sum, i) => sum + i.totalAmount, 0);

    const todayInvoicesCount = branchStats.length > 0
      ? branchStats.reduce((sum, s) => sum + s.totalInvoices, 0)
      : todayInvoices.length;

    const todayCash = branchStats.length > 0
      ? branchStats.reduce((sum, s) => sum + s.totalCash, 0)
      : todayInvoices.filter((i) => i.paymentMethod === 'cash').reduce((sum, i) => sum + i.paidAmount, 0);

    const todayCard = branchStats.length > 0
      ? branchStats.reduce((sum, s) => sum + s.totalCard, 0)
      : todayInvoices.filter((i) => i.paymentMethod === 'card').reduce((sum, i) => sum + i.paidAmount, 0);

    const todayCredit = branchStats.length > 0
      ? branchStats.reduce((sum, s) => sum + s.totalCredit, 0)
      : todayInvoices.reduce((sum, i) => sum + i.remainingAmount, 0);

    const estimatedNetProfit = branchStats.length > 0
      ? branchStats.reduce((sum, s) => sum + s.netProfit, 0)
      : todaySales * 0.28;

    // 4. Query Active Shifts
    const shiftFilter: any = { tenantId, status: 'open' };
    if (!isAllBranches) {
      shiftFilter.branchCode = branchCode;
    }
    const activeShifts = await prisma.posShiftSync.findMany({
      where: shiftFilter,
      orderBy: { openedAt: 'desc' },
    });

    // Estimate live cash currently inside all cash drawers
    const totalCashInDrawers = activeShifts.reduce((acc, s) => acc + (s.startingCash + s.totalSales), 0);

    // 5. Compute Branch Comparison Breakdown
    const allBranchesStats = await prisma.posBranchDailyStats.findMany({
      where: { tenantId, date },
    });

    const totalNetworkSales = allBranchesStats.reduce((acc, b) => acc + b.totalSales, 0) || todaySales || 1;

    const branchComparison = branches.map((b) => {
      const bStat = allBranchesStats.find((s) => s.branchCode === b.branchCode);
      const bSales = bStat ? bStat.totalSales : 0;
      const bInvoices = bStat ? bStat.totalInvoices : 0;
      const percent = totalNetworkSales > 0 ? Math.round((bSales / totalNetworkSales) * 100) : 0;
      return {
        branchCode: b.branchCode,
        name: b.name,
        city: b.city,
        sales: bSales,
        invoices: bInvoices,
        percentage: percent,
        activeShifts: bStat ? bStat.activeShifts : 0,
      };
    });

    // 6. Recent Sales Stream (Format for easy display in UI)
    const recentSales = todayInvoices.slice(0, 25).map((inv) => ({
      id: inv.id,
      localInvoiceId: inv.localInvoiceId,
      invoiceNumber: inv.invoiceNumber,
      branchCode: inv.branchCode,
      branchName: branches.find((b) => b.branchCode === inv.branchCode)?.name || inv.branchCode,
      customerName: inv.customerName || 'عميل نقدي',
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      remainingAmount: inv.remainingAmount,
      paymentMethod: inv.paymentMethod,
      cashierName: inv.cashierName || 'كاشير',
      itemsCount: inv.itemsCount,
      createdAt: inv.createdAt,
      timeAgoMinutes: Math.round((Date.now() - new Date(inv.createdAt).getTime()) / 60000),
      rawItems: inv.rawItems,
    }));

    res.json({
      success: true,
      accountInfo,
      selectedBranch: isAllBranches ? 'all' : branchCode,
      date,
      serverTime: new Date().toISOString(),
      branches,
      kpis: {
        todaySales: Math.round(todaySales * 100) / 100,
        todayInvoices: todayInvoicesCount,
        averageTicket: todayInvoicesCount > 0 ? Math.round((todaySales / todayInvoicesCount) * 100) / 100 : 0,
        todayCash: Math.round(todayCash * 100) / 100,
        todayCard: Math.round(todayCard * 100) / 100,
        todayCredit: Math.round(todayCredit * 100) / 100,
        cashInDrawers: Math.round(totalCashInDrawers * 100) / 100,
        estimatedNetProfit: Math.round(estimatedNetProfit * 100) / 100,
        activeShiftsCount: activeShifts.length,
      },
      activeShifts: activeShifts.map((s) => ({
        id: s.id,
        branchCode: s.branchCode,
        branchName: branches.find((b) => b.branchCode === s.branchCode)?.name || s.branchCode,
        cashierName: s.cashierName,
        openedAt: s.openedAt,
        startingCash: s.startingCash,
        currentSales: s.totalSales,
        currentInvoices: s.invoicesCount,
        estimatedDrawerCash: s.startingCash + s.totalSales,
        status: s.status,
      })),
      recentSales,
      branchComparison,
    });
  } catch (error: any) {
    console.error('❌ [Live Monitor Error]:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch live monitor data.' });
  }
});

export default router;
