import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import prisma from '../prisma';
import { optionalAuth } from '../middleware/auth';

const router = Router();
const SECRET_SALT = 'QUAZLINK_ENTERPRISE_ERP_CORE_SALT_2026';

// Resolve downloads directory in web public folder or pos-client release
const WEB_DOWNLOADS_DIR = path.resolve(__dirname, '../../../web/public/downloads');
const POS_RELEASE_DIR = path.resolve(__dirname, '../../../pos-client/dist/release');

function getFileInfo(filePath: string) {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    return {
      exists: true,
      sizeBytes: stats.size,
      sizeMB: Math.round((stats.size / (1024 * 1024)) * 10) / 10,
      modifiedAt: stats.mtime.toISOString(),
    };
  }
  return {
    exists: false,
    sizeBytes: 0,
    sizeMB: 0,
    modifiedAt: null,
  };
}

// GET /api/downloads/info - Metadata about all client downloads
router.get('/info', (_req, res) => {
  const posInstallerPath = path.join(WEB_DOWNLOADS_DIR, 'QuazLink-POS-Setup.exe');
  const posPortablePath = path.join(WEB_DOWNLOADS_DIR, 'QuazLink-POS-Portable.zip');
  const posLegacySetupPath = path.join(WEB_DOWNLOADS_DIR, 'QuazLink-POS-Legacy-Win7-Setup.exe');
  const posLegacyPortablePath = path.join(WEB_DOWNLOADS_DIR, 'QuazLink-POS-Legacy-Win7-Portable.zip');
  const runnerPath = path.join(WEB_DOWNLOADS_DIR, 'QuazLink-Runner-Setup.exe');

  const posInstallerInfo = getFileInfo(posInstallerPath);
  const posPortableInfo = getFileInfo(posPortablePath);
  const posLegacySetupInfo = getFileInfo(posLegacySetupPath);
  const posLegacyPortableInfo = getFileInfo(posLegacyPortablePath);
  const runnerInfo = getFileInfo(runnerPath);

  res.json({
    posClient: {
      name: 'QuazLink POS & Retail Engine (Modern Edition)',
      version: '1.2.0',
      description: 'نظام الكاشير ونقاط البيع وإدارة المخازن والفواتير (يعمل بدون إنترنت Offline-First)',
      recommended: true,
      installer: {
        filename: 'QuazLink-POS-Setup-v1.2.0.exe',
        downloadUrl: '/downloads/QuazLink-POS-Setup-v1.2.0.exe',
        apiDownloadUrl: '/api/downloads/file/QuazLink-POS-Setup-v1.2.0.exe',
        ...posInstallerInfo,
      },
      portable: {
        filename: 'QuazLink-POS-Portable-v1.2.0.zip',
        downloadUrl: '/downloads/QuazLink-POS-Portable-v1.2.0.zip',
        apiDownloadUrl: '/api/downloads/file/QuazLink-POS-Portable-v1.2.0.zip',
        ...posPortableInfo,
      },
      requirements: {
        os: 'Windows 10 / Windows 11 (64-bit)',
        ram: '4 GB RAM minimum (8 GB recommended)',
        disk: '600 MB free space',
        peripherals: 'Thermal Receipt Printers (ESC/POS 80mm/58mm), USB Barcode Scanners, Cash Drawers',
      },
    },
    posLegacyClient: {
      name: 'QuazLink POS & Retail Engine (Legacy Win7 Edition)',
      version: '1.2.0',
      description: 'نسخة مخصصة لأجهزة الكاشير ونقاط البيع القديمة والشاشات اللمسية التي تعمل بأنظمة Windows 7 / POSReady 7',
      recommended: false,
      isLegacy: true,
      installer: {
        filename: 'QuazLink-POS-Legacy-Win7-Setup-v1.2.0.exe',
        downloadUrl: '/downloads/QuazLink-POS-Legacy-Win7-Setup-v1.2.0.exe',
        apiDownloadUrl: '/api/downloads/file/QuazLink-POS-Legacy-Win7-Setup-v1.2.0.exe',
        ...posLegacySetupInfo,
      },
      portable: {
        filename: 'QuazLink-POS-Legacy-Win7-Portable-v1.2.0.zip',
        downloadUrl: '/downloads/QuazLink-POS-Legacy-Win7-Portable-v1.2.0.zip',
        apiDownloadUrl: '/api/downloads/file/QuazLink-POS-Legacy-Win7-Portable-v1.2.0.zip',
        ...posLegacyPortableInfo,
      },
      requirements: {
        os: 'Windows 7 SP1 / Windows 8 / 8.1 / POSReady 7 (32 & 64 bit)',
        ram: '2 GB RAM minimum',
        disk: '400 MB free space',
        peripherals: 'All Thermal Receipt Printers (ESC/POS), Serial/USB Barcode Scanners, Cash Drawers',
      },
    },
    runner: {
      name: 'QuazLink Automation Runner',
      version: '26.10.14',
      description: 'محرك الأتمتة المكتبي الخفيف لتنفيذ فواتير الواتساب ومنشورات السوشيال ميديا',
      recommended: false,
      installer: {
        filename: 'QuazLink-Runner-Setup-v26.10.14.exe',
        downloadUrl: '/downloads/QuazLink-Runner-Setup-v26.10.14.exe',
        apiDownloadUrl: '/api/downloads/file/QuazLink-Runner-Setup-v26.10.14.exe',
        ...runnerInfo,
      },
    },
  });
});

// GET /api/downloads/file/:filename - Direct file stream download
router.get('/file/:filename', (req, res) => {
  const allowedFiles = [
    'QuazLink-POS-Setup.exe',
    'QuazLink-POS-Setup-v1.2.0.exe',
    'QuazLink-POS-Setup-v1.1.0.exe',
    'QuazLink-POS-Portable.zip',
    'QuazLink-POS-Portable-v1.2.0.zip',
    'QuazLink-POS-Portable-v1.1.0.zip',
    'QuazLink-POS-Legacy-Win7-Setup.exe',
    'QuazLink-POS-Legacy-Win7-Setup-v1.2.0.exe',
    'QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe',
    'QuazLink-POS-Legacy-Win7-Portable.exe',
    'QuazLink-POS-Legacy-Win7-Portable.zip',
    'QuazLink-POS-Legacy-Win7-Portable-v1.2.0.zip',
    'QuazLink-POS-Legacy-Win7-Portable-v1.1.0.zip',
    'QuazLink-Runner-Setup.exe',
    'QuazLink-Runner-Setup-v26.10.14.exe',
    'QuazLink-Runner-Setup-v26.10.13.exe',
  ];

  const { filename } = req.params;
  if (!allowedFiles.includes(filename)) {
    return res.status(404).json({ error: 'الملف المطلوب غير موجود أو غير مصرح به.' });
  }

  const filePath = path.join(WEB_DOWNLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    const cdnMap: Record<string, string> = {
      'QuazLink-POS-Setup.exe': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.2.0/QuazLink-POS-Setup-v1.2.0.exe',
      'QuazLink-POS-Setup-v1.2.0.exe': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.2.0/QuazLink-POS-Setup-v1.2.0.exe',
      'QuazLink-POS-Setup-v1.1.0.exe': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Setup-v1.1.0.exe',
      'QuazLink-POS-Portable.zip': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.2.0/QuazLink-POS-Portable-v1.2.0.zip',
      'QuazLink-POS-Portable-v1.2.0.zip': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.2.0/QuazLink-POS-Portable-v1.2.0.zip',
      'QuazLink-POS-Portable-v1.1.0.zip': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Portable-v1.1.0.zip',
      'QuazLink-POS-Legacy-Win7-Setup.exe': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.2.0/QuazLink-POS-Legacy-Win7-Setup-v1.2.0.exe',
      'QuazLink-POS-Legacy-Win7-Setup-v1.2.0.exe': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.2.0/QuazLink-POS-Legacy-Win7-Setup-v1.2.0.exe',
      'QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe',
      'QuazLink-POS-Legacy-Win7-Portable.exe': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.2.0/QuazLink-POS-Legacy-Win7-Portable-v1.2.0.zip',
      'QuazLink-POS-Legacy-Win7-Portable.zip': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.2.0/QuazLink-POS-Legacy-Win7-Portable-v1.2.0.zip',
      'QuazLink-POS-Legacy-Win7-Portable-v1.2.0.zip': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.2.0/QuazLink-POS-Legacy-Win7-Portable-v1.2.0.zip',
      'QuazLink-POS-Legacy-Win7-Portable-v1.1.0.zip': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Legacy-Win7-Portable.zip',
      'QuazLink-Runner-Setup.exe': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/v26.10.14/QuazLink-Runner-Setup-v26.10.14.exe',
      'QuazLink-Runner-Setup-v26.10.14.exe': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/v26.10.14/QuazLink-Runner-Setup-v26.10.14.exe',
      'QuazLink-Runner-Setup-v26.10.13.exe': 'https://github.com/hadisalah07/QuazLink_Platform/releases/download/v26.10.13/QuazLink-Runner-Setup-v26.10.13.exe',
    };

    if (cdnMap[filename]) {
      return res.redirect(302, cdnMap[filename]);
    }

    return res.status(404).json({ error: 'لم يتم العثور على ملف التثبيت على السيرفر.' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

// POST /api/downloads/pos/license - Generate or retrieve license key for hardware ID
router.post('/pos/license', optionalAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { hardwareId, businessName, tier = 'lifetime', expDays = 365 } = req.body;

    if (!hardwareId || typeof hardwareId !== 'string' || !hardwareId.trim()) {
      return res.status(400).json({ error: 'يرجى إدخال بصمة الجهاز (Hardware ID) بشكل صحيح.' });
    }

    const cleanHwId = hardwareId.trim().toUpperCase();

    // Generate cryptographic license key
    const payload = {
      tier: tier === 'lifetime' ? 'lifetime' : 'saas_subscription',
      hw: cleanHwId,
      exp: tier === 'lifetime' ? null : new Date(Date.now() + expDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      modules: ['core_pos', 'shifts_zreport', 'serial_warranty', 'ai_marketing', 'whatsapp_receipts', 'crm_ledgers', 'cloud_sync'],
    };

    const prefix = tier === 'lifetime' ? 'LIFE' : 'SAAS';
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', SECRET_SALT).update(b64).digest('hex').slice(0, 8).toUpperCase();
    const licenseKey = `QLPOS-${prefix}-${b64}-${sig}`;

    // If user is authenticated, register this device in user's devices table
    if (userId) {
      try {
        const existing = await prisma.device.findFirst({
          where: { userId, pairingToken: cleanHwId },
        });

        if (!existing) {
          await prisma.device.create({
            data: {
              userId,
              name: businessName ? `${businessName} (POS Terminal)` : `POS Machine (${cleanHwId.slice(-9)})`,
              platform: 'win32-pos',
              pairingToken: cleanHwId,
              status: 'offline',
            },
          });
        }
      } catch (dbErr) {
        console.warn('POS device registration warning:', dbErr);
      }
    }

    res.json({
      success: true,
      hardwareId: cleanHwId,
      licenseKey,
      tier,
      expiresAt: payload.exp,
      businessName: businessName || 'QuazLink Merchant',
      instructions: 'انسخ كود التفعيل وأدخله في شاشة تفعيل الترخيص داخل برنامج الكاشير على جهازك.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
