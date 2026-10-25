import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const POS_LATEST_VERSION = "1.3.8";
export const POS_MIN_REQUIRED_VERSION = "1.0.0";
export const POS_RELEASE_DATE = "2026-10-25";
export const POS_RELEASE_NOTES = `• إضافة ثيم "Golden Hyalos" (جولدن هيالوس 👑) الفاخر بلون الذهب المعدني الخالص وحجر السج الأسود وانعكاسات الزجاج المنشوري الملكي.
• حل مشكلة قص الهوامش السفلية في تبويب المظهر والإعدادات (Scroll Clearance Fix) مع ضمان ظهور بطاقة المعاينة الحية كاملة.
• تحسينات عامة في أداء التمرير واستقرار واجهة نقطة البيع.`;

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

  // Exact verified binary file sizes (bytes)
  const setupFileSize = isLegacyWin ? 73978596 : 74253442;
  const portableFileSize = isLegacyWin ? 73640936 : 73919523;

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
    ? `QuazLink POS & ERP v${POS_LATEST_VERSION} (إصدار Legacy مخصص ومتوافق مع Windows 7 / 8 / POSReady - مع ثيم جولدن هيالوس وإصلاح الهوامش)`
    : `QuazLink POS & ERP v${POS_LATEST_VERSION} (ثيم جولدن هيالوس الفاخر، حل مشكلة قص الهوامش السفلية، وتحسينات الأداء)`;

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
    patchUrl: `/downloads/QuazLink-POS-Patch-v1.3.8.zip?v=${POS_LATEST_VERSION}&t=${new Date(POS_RELEASE_DATE).getTime()}`,
    patchSize: 1155688,
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
