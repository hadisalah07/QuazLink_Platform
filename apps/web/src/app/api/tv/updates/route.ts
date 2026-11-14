import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const TV_LATEST_VERSION = "1.0.8";
export const TV_MIN_REQUIRED_VERSION = "1.0.0";
export const TV_RELEASE_DATE = "2026-11-15";
export const TV_RELEASE_NOTES = `• إغلاق تلقائي للقائمة العائمة بعد 10 ثوانٍ من عدم النشاط (10s AFK Timeout).
• دعم كامل وموثوق لإغلاق القائمة عبر زر Back أو زر الريموت أو زر الإغلاق المباشر (OverlayRootLayout Dispatcher).
• تحسين تهيئة خدمة الريموت (typeWindowStateChanged) لمنع تحذيرات تسجيل النصوص والحظر الأمني في Google TV.`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientVersion = (searchParams.get("currentVersion") || "1.0.0").replace(/^v/i, "").trim();

  const isNewer = compareVersions(TV_LATEST_VERSION, clientVersion) > 0;

  return NextResponse.json({
    success: true,
    hasUpdate: isNewer,
    currentVersion: clientVersion,
    latestVersion: TV_LATEST_VERSION,
    minRequiredVersion: TV_MIN_REQUIRED_VERSION,
    releaseName: `QuazHome TV v${TV_LATEST_VERSION} (Official Edition)`,
    releaseNotes: TV_RELEASE_NOTES,
    downloadUrl: `https://app.quazlink.site/downloads/QuazHomeTV.apk?v=${TV_LATEST_VERSION}`,
    publishedAt: new Date(TV_RELEASE_DATE).toISOString(),
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
