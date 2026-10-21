import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export const POS_LATEST_VERSION = "1.3.6";
export const POS_MIN_REQUIRED_VERSION = "1.0.0";
export const POS_RELEASE_DATE = "2026-10-22";
export const POS_RELEASE_NOTES = `• إصلاحات عامة وتحسينات شاملة في الأداء (Bug Fixes & System Improvements):
• نظام الإشعارات الذكي الفوري (Single Overwrite Toast Engine): منع تراكم ورص رسائل الإشعارات رأسياً واستبدال الرسائل في نفس المكان فوراً مع أنيميشن تفاعلي سلس وحذف الأيقونات المكررة.
• وضع الشاشة الكاملة (Full-Screen Mode): إضافة زر التكبير السريع (⛶) في شريط الكاشير العلوي مع دعم كامل للخروج السريع عبر زر ESC أو اختصار Ctrl + Q.
• مؤشر عدسة التكبير الذكي (Zoom Lens Indicator): تمييز نسبة التكبير البصرية في الهيدر لسهولة القراءة والتحكم.
• تحديث رقم التواصل والتفعيل المعتمد لخدمة العملاء والمبيعات: 01019078440.
• حماية التجربة المجانية الصارمة (30-Day Anti-Tamper Trial) وحوكمة بصمة العتاد الدائمة (Motherboard HWID).
• التوافق المزدوج بنسبة 100% مع أنظمة Windows 7 / 8 / POSReady وأنظمة Windows 10 / 11 Modern.`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientVersion = (searchParams.get("currentVersion") || "1.0.0").replace(/^v/i, "").trim();
  const osRelease = (searchParams.get("osRelease") || "").toLowerCase();
  const isLegacyWin =
    osRelease.includes("6.1") ||
    osRelease.includes("6.2") ||
    osRelease.includes("6.3") ||
    osRelease.includes("windows 7") ||
    osRelease.includes("windows 8") ||
    osRelease.includes("posready");

  const setupFilename = isLegacyWin ? "QuazLink-POS-Legacy-Win7-Setup.exe" : "QuazLink-POS-Setup.exe";
  const portableFilename = isLegacyWin ? "QuazLink-POS-Legacy-Win7-Portable.exe" : "QuazLink-POS-Portable.zip";

  // Determine file sizes from public/downloads or /data/downloads if present
  let setupFileSize = isLegacyWin ? 73978596 : 74217038;
  let portableFileSize = isLegacyWin ? 73640936 : 73886179;

  try {
    const candidateDirs = [
      path.join("/data/downloads"),
      path.join(process.cwd(), "public", "downloads"),
      path.join(process.cwd(), "apps", "web", "public", "downloads"),
    ];

    for (const dir of candidateDirs) {
      const sPath = path.join(dir, setupFilename);
      const pPath = path.join(dir, portableFilename);
      if (fs.existsSync(sPath)) {
        setupFileSize = fs.statSync(sPath).size;
        break;
      }
      if (fs.existsSync(pPath)) {
        portableFileSize = fs.statSync(pPath).size;
      }
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

  const releaseTitle = isLegacyWin
    ? `QuazLink POS & ERP v${POS_LATEST_VERSION} (إصدار Legacy مخصص ومتوافق مع Windows 7 / 8 / POSReady - مع إصلاحات وتحسينات عامة)`
    : `QuazLink POS & ERP v${POS_LATEST_VERSION} (إصلاحات وتحسينات عامة، نظام الإشعارات الفوري، ووضع الشاشة الكاملة)`;

  return NextResponse.json({
    success: true,
    hasUpdate: isNewer,
    currentVersion: clientVersion,
    latestVersion: POS_LATEST_VERSION,
    minRequiredVersion: POS_MIN_REQUIRED_VERSION,
    releaseName: releaseTitle,
    releaseNotes: POS_RELEASE_NOTES,
    downloadUrl: `/downloads/${setupFilename}?v=${POS_LATEST_VERSION}&t=${new Date(POS_RELEASE_DATE).getTime()}`,
    portableUrl: `/downloads/${portableFilename}?v=${POS_LATEST_VERSION}&t=${new Date(POS_RELEASE_DATE).getTime()}`,
    assetSize: setupFileSize,
    portableSize: portableFileSize,
    publishedAt: new Date(POS_RELEASE_DATE).toISOString(),
    mandatory: false,
    isLegacyWin7: isLegacyWin,
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
