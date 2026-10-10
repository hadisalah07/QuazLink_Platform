import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export const POS_LATEST_VERSION = "1.1.0";
export const POS_MIN_REQUIRED_VERSION = "1.0.0";
export const POS_RELEASE_DATE = "2026-10-08";
export const POS_RELEASE_NOTES = `• حل مشكلة إتمام المعاملات وحفظ الفواتير في قاعدة البيانات (Fix WASM commit reset)
• تصحيح مسار الإيصالات الحرارية ومنع أخطاء الصلاحيات (EPERM fix to ~/.quazlink/receipts)
• إضافة نظام الفحص والتحديث التلقائي المباشر من المنصة (Check for Updates)
• إشعار فوري داخل شاشة الكاشير عند توفر إصدار جديد مع إمكانية التثبيت التلقائي بنقرة واحدة
• تحسينات في استقرار الاتصال وسرعة المزامنة السحابية`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientVersion = (searchParams.get("currentVersion") || "1.0.0").replace(/^v/i, "").trim();

  // Determine file sizes from public/downloads if present
  let setupFileSize = 74112728; // Fallback default
  let portableFileSize = 221663438;

  try {
    const publicDownloadsDir = path.join(process.cwd(), "public", "downloads");
    const setupPath = path.join(publicDownloadsDir, "QuazLink-POS-Setup.exe");
    const portablePath = path.join(publicDownloadsDir, "QuazLink-POS-Portable.zip");

    if (fs.existsSync(setupPath)) {
      setupFileSize = fs.statSync(setupPath).size;
    }
    if (fs.existsSync(portablePath)) {
      portableFileSize = fs.statSync(portablePath).size;
    }
  } catch {}

  // Compare versions
  const isNewer = compareVersions(POS_LATEST_VERSION, clientVersion) > 0;

  // Asynchronously notify backend telemetry if hardwareId is present
  const hardwareId = searchParams.get("hardwareId");
  if (hardwareId) {
    const internalHost = process.env.INTERNAL_API_HOST || "api";
    const internalUrl = `http://${internalHost}:3001/api/pos/updates${new URL(request.url).search}`;
    const fwdHeaders: Record<string, string> = {};
    const xff = request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip");
    if (xff) fwdHeaders["x-forwarded-for"] = xff;
    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp) fwdHeaders["cf-connecting-ip"] = cfIp;

    fetch(internalUrl, { headers: fwdHeaders }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    hasUpdate: isNewer,
    currentVersion: clientVersion,
    latestVersion: POS_LATEST_VERSION,
    minRequiredVersion: POS_MIN_REQUIRED_VERSION,
    releaseName: `QuazLink POS & ERP v${POS_LATEST_VERSION} (إصدار الاستقرار والأداء)`,
    releaseNotes: POS_RELEASE_NOTES,
    downloadUrl: "/downloads/QuazLink-POS-Setup.exe",
    portableUrl: "/downloads/QuazLink-POS-Portable.zip",
    assetSize: setupFileSize,
    portableSize: portableFileSize,
    publishedAt: new Date(POS_RELEASE_DATE).toISOString(),
    mandatory: false,
  });
}

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = v2.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const n1 = p1[i] ?? 0;
    const n2 = p2[i] ?? 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}
