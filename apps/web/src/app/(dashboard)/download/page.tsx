"use client";

import * as React from "react";
import Link from "next/link";
import {
  Download,
  Laptop,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Sparkles,
  Smartphone,
  HardDrive,
  Cpu,
  Key,
  Copy,
  Check,
  Printer,
  Layers,
  Store,
  FolderArchive,
  RefreshCw,
  ShoppingBag,
  Clock,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  Monitor
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import {
  createDevicePairing,
  getDownloadsInfo,
  generatePosLicense,
  type DownloadsInfoResponse
} from "@/lib/api";
import { PLATFORM_VERSION } from "@/lib/version";

export default function DownloadPage() {
  const [activeTab, setActiveTab] = React.useState<"pos" | "runner">("pos");

  // Runner pairing state
  const [runnerPairingToken, setRunnerPairingToken] = React.useState<string | null>(null);
  const [loadingRunnerPair, setLoadingRunnerPair] = React.useState(false);

  // POS Licensing state
  const [posHwId, setPosHwId] = React.useState("");
  const [posBusinessName, setPosBusinessName] = React.useState("");
  const [posTier, setPosTier] = React.useState<"lifetime" | "saas_subscription">("lifetime");
  const [posLicenseKey, setPosLicenseKey] = React.useState<string | null>(null);
  const [posExpiresAt, setPosExpiresAt] = React.useState<string | null>(null);
  const [loadingLicense, setLoadingLicense] = React.useState(false);
  const [licenseError, setLicenseError] = React.useState<string | null>(null);

  // Clipboard copy state
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // Metadata from API
  const [downloadsInfo, setDownloadsInfo] = React.useState<DownloadsInfoResponse | null>(null);

  React.useEffect(() => {
    getDownloadsInfo()
      .then((data) => setDownloadsInfo(data))
      .catch((err) => console.warn("Failed to load downloads info:", err));
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleGenerateRunnerCode = async () => {
    setLoadingRunnerPair(true);
    try {
      const res = await createDevicePairing("Desktop Automation Runner");
      setRunnerPairingToken(res.pairingToken);
    } catch (e: any) {
      alert("فشل توليد رمز الربط: " + e.message);
    } finally {
      setLoadingRunnerPair(false);
    }
  };

  const handleGeneratePosLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posHwId.trim()) {
      setLicenseError("يرجى إدخال بصمة الجهاز (Hardware ID) التي تظهر داخل برنامج الكاشير.");
      return;
    }
    setLicenseError(null);
    setLoadingLicense(true);
    try {
      const res = await generatePosLicense({
        hardwareId: posHwId.trim(),
        businessName: posBusinessName.trim() || undefined,
        tier: posTier,
        expDays: posTier === "lifetime" ? undefined : 365,
      });
      setPosLicenseKey(res.licenseKey);
      setPosExpiresAt(res.expiresAt);
    } catch (e: any) {
      setLicenseError(e.message || "حدث خطأ أثناء توليد مفتاح الترخيص.");
    } finally {
      setLoadingLicense(false);
    }
  };

  return (
    <div className="flex flex-col space-y-8 max-w-6xl mx-auto pb-20">
      {/* Header & Product Switcher Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>QUAZLINK DESKTOP ECOSYSTEM • {PLATFORM_VERSION}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            مركز تحميل برامج وتطبيقات <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">QuazLink</span>
          </h1>
          <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
            حمّل برامج كويزلينك المكتبية الرسمية على أي جهاز كمبيوتر أو لابتوب بنظام Windows للعمل الميداني وإدارة محلك وأتمتة أعمالك.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1.5 rounded-2xl bg-white/5 border border-white/10 self-start md:self-auto backdrop-blur-md">
          <button
            onClick={() => setActiveTab("pos")}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "pos"
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Store className="w-4 h-4" />
            <span>نظام الكاشير والمخازن (POS &amp; ERP)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/40 text-emerald-200 border border-emerald-400/30">
              جديد
            </span>
          </button>

          <button
            onClick={() => setActiveTab("runner")}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "runner"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>محرك الأتمتة (Desktop Runner)</span>
          </button>
        </div>
      </div>

      {/* Standalone POS Portal Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-[#0B101D] to-cyan-950/60 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-right">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>بوابة نظام الكاشير المستقلة (QuazLink POS Portal)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">مستقلة 100%</span>
            </h4>
            <p className="text-xs text-gray-400">
              قم بزيارة البوابة المستقلة المخصصة للتجار وأصحاب المحلات لتنزيل البرنامج، تفعيل الرخص، واستعراض توافق العتاد.
            </p>
          </div>
        </div>
        <Link
          href="/pos"
          className="shrink-0 px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-400 transition-colors shadow-md shadow-emerald-500/20"
        >
          <span>فتح بوابة الكاشير المستقلة</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: POS & ERP DESKTOP CLIENT                                           */}
      {/* ========================================================================= */}
      {activeTab === "pos" && (
        <div className="space-y-10">
          {/* Main Hero Showcase */}
          <div className="relative rounded-3xl p-8 md:p-12 border border-emerald-500/30 bg-gradient-to-b from-emerald-950/40 via-[var(--color-quaz-bg)] to-black/70 shadow-2xl overflow-hidden space-y-8">
            <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                <Store className="w-4 h-4 text-emerald-400" />
                <span>OFFLINE-FIRST ENTERPRISE RETAIL ENGINE • v1.1.0</span>
              </div>

              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
                برنامج الكاشير ونقاط البيع{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                  QuazLink POS &amp; ERP
                </span>
              </h2>

              <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                برنامج مكتبي متكامل لإدارة المبيعات، الفواتير، المخازن، حسابات العملاء، وطباعة الإيصالات الحرارية.
                يعمل بنسبة <strong>100% بدون إنترنت</strong> مع حفظ فوري فائق السرعة ومزامنة سحابية ذكية مع حسابك على QuazLink.
              </p>
            </div>

            {/* Download Buttons Section */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                href="/downloads/QuazLink-POS-Setup.exe"
                download="QuazLink-POS-Setup.exe"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold rounded-2xl text-base shadow-[0_0_35px_rgba(16,185,129,0.5)] hover:shadow-[0_0_50px_rgba(16,185,129,0.8)] transition-all flex items-center justify-center gap-3 cursor-pointer group"
              >
                <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                <div className="text-right">
                  <div className="font-bold text-sm md:text-base">تحميل برنامج التثبيت (Win 10/11 Setup)</div>
                  <div className="text-[11px] text-emerald-100 font-mono font-normal">تثبيت بنقرة واحدة مع اختصار سطح المكتب (~70 MB)</div>
                </div>
              </a>

              <a
                href="/downloads/QuazLink-POS-Portable.zip"
                download="QuazLink-POS-Portable.zip"
                className="w-full sm:w-auto px-6 py-4 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-3 cursor-pointer"
              >
                <FolderArchive className="w-5 h-5 text-emerald-400" />
                <div className="text-right">
                  <div>نسخة محمولة (Win 10/11 Portable)</div>
                  <div className="text-[11px] text-gray-400 font-mono font-normal">فك الضغط وتشغيل مباشر بدون تثبيت (~73 MB)</div>
                </div>
              </a>
            </div>

            {/* Dedicated Windows 7 Legacy Options */}
            <div className="pt-4 border-t border-white/10 flex flex-col items-center gap-3">
              <div className="text-xs text-amber-300 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-amber-400" />
                <span>لديك جهاز كاشير أو شاشة لمس بنظام Windows 7 / 8 / POSReady 7 القديم (32-bit &amp; 64-bit)؟</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href="/downloads/QuazLink-POS-Legacy-Win7-Setup.exe"
                  download="QuazLink-POS-Legacy-Win7-Setup.exe"
                  className="px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>تحميل نسخة Windows 7 (32-bit Setup .exe ~73 MB)</span>
                </a>

                <a
                  href="/downloads/QuazLink-POS-Legacy-Win7-Portable.zip"
                  download="QuazLink-POS-Legacy-Win7-Portable.zip"
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-semibold flex items-center gap-2 transition-all"
                >
                  <FolderArchive className="w-4 h-4 text-amber-400" />
                  <span>نسخة Win 7 محمولة (32-bit Portable .zip ~73 MB)</span>
                </a>
              </div>
            </div>

            {/* Hardware & Spec Badges */}
            <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-gray-400 pt-2 font-mono">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                الأنظمة: Windows 10 / 11 (64-bit)
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                طابعات الفواتير: ESC/POS (80mm &amp; 58mm)
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                قاعدة بيانات SQLite محلية مدمجة
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                تفعيل تجريبي تلقائي 60 يوماً
              </span>
            </div>
          </div>

          {/* 4 Steps Installation & Setup Guide */}
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white">كيف تبدأ استخدام البرنامج في 4 خطوات بسيطة</h3>
              <p className="text-xs text-gray-400 mt-1">
                تنزيل سريع وتثبيت سلس على أي جهاز كمبيوتر في متجرك أو مستودعك
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <SpotlightCard
                spotlightColor="rgba(16, 185, 129, 0.2)"
                className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold font-mono text-lg flex items-center justify-center">
                  1
                </div>
                <h4 className="text-sm font-bold text-white">حمّل البرنامج على الجهاز</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  اضغط على زر التحميل بالأعلى لتنزيل ملف <code className="text-emerald-300 font-mono">QuazLink-POS-Setup.exe</code> على أي كمبيوتر لديك.
                </p>
              </SpotlightCard>

              <SpotlightCard
                spotlightColor="rgba(16, 185, 129, 0.2)"
                className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold font-mono text-lg flex items-center justify-center">
                  2
                </div>
                <h4 className="text-sm font-bold text-white">التثبيت والتشغيل</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  شغّل برنامج التثبيت. سيتم إنشاء اختصار رسمي على سطح المكتب. افتح البرنامج ليبدأ العمل فوراً في وضع ملء الشاشة.
                </p>
              </SpotlightCard>

              <SpotlightCard
                spotlightColor="rgba(16, 185, 129, 0.2)"
                className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold font-mono text-lg flex items-center justify-center">
                  3
                </div>
                <h4 className="text-sm font-bold text-white">نسخ بصمة الجهاز</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  من داخل البرنامج، توجه إلى تبويب <strong>الإعدادات ⚙️</strong> وانسخ <strong>بصمة الجهاز (Hardware ID)</strong> المكونة من كود فريد لجهازك.
                </p>
              </SpotlightCard>

              <SpotlightCard
                spotlightColor="rgba(16, 185, 129, 0.2)"
                className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold font-mono text-lg flex items-center justify-center">
                  4
                </div>
                <h4 className="text-sm font-bold text-white">توليد وتفعيل الرخصة</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  الصق بصمة الجهاز في الصندوق أدناه لإصدار رخصة دائمة باسم محلك، أو استمتع بفترة الـ 60 يوماً التجريبية المضمنة تلقائياً!
                </p>
              </SpotlightCard>
            </div>
          </div>

          {/* Interactive Cloud License Generator */}
          <SpotlightCard
            spotlightColor="rgba(16, 185, 129, 0.25)"
            className="p-6 md:p-8 rounded-2xl border border-emerald-500/30 bg-black/40 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-emerald-400" />
                  <span>توليد وتفعيل ترخيص المحل لجهازك (Machine License Generator)</span>
                </h3>
                <p className="text-xs text-gray-400">
                  أدخل بصمة عتاد الجهاز (Hardware ID) الظاهرة في شاشة إعدادات الكاشير لإنشاء رخصة تشفير رقمية رسمية.
                </p>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold self-start sm:self-auto flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>تشفير رقمي HMAC-SHA256</span>
              </div>
            </div>

            <form onSubmit={handleGeneratePosLicense} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
                    <span>بصمة الجهاز (Hardware Machine ID)</span>
                    <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: QL-HW-A1B2-C3D4-E5F6-7890"
                    value={posHwId}
                    onChange={(e) => setPosHwId(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white font-mono text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all uppercase"
                  />
                  <span className="text-[11px] text-gray-500 block">
                    تجد هذا الكود داخل شاشة إعدادات البرنامج على الجهاز المراد تشغيله.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300">اسم المتجر / الفرع</label>
                  <input
                    type="text"
                    placeholder="مثال: فرع وسط البلد"
                    value={posBusinessName}
                    onChange={(e) => setPosBusinessName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">نوع الترخيص:</span>
                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="tier"
                      checked={posTier === "lifetime"}
                      onChange={() => setPosTier("lifetime")}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>ترخيص دائم مدى الحياة (Lifetime)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="tier"
                      checked={posTier === "saas_subscription"}
                      onChange={() => setPosTier("saas_subscription")}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>اشتراك سنوي (1 سنة)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loadingLicense}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-extrabold rounded-xl text-xs shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4 text-black" />
                  <span>{loadingLicense ? "جاري إصدار الترخيص..." : "توليد كود التفعيل للكمبيوتر"}</span>
                </button>
              </div>

              {licenseError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                  {licenseError}
                </div>
              )}

              {posLicenseKey && (
                <div className="mt-4 p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      تم إنشاء مفتاح الترخيص بنجاح!
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">
                      الصلاحية: {posExpiresAt ? `ينتهي في ${posExpiresAt}` : "دائم مدى الحياة (Lifetime)"}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex-1 p-3 bg-black/60 border border-white/20 rounded-xl font-mono text-xs text-emerald-200 select-all overflow-x-auto whitespace-nowrap">
                      {posLicenseKey}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(posLicenseKey, "pos-key")}
                      className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    >
                      {copiedKey === "pos-key" ? (
                        <>
                          <Check className="w-4 h-4 text-black" />
                          <span>تم النسخ!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-black" />
                          <span>نسخ الكود</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    💡 <strong>طريقة التفعيل:</strong> افتح برنامج الكاشير على جهازك، ثم توجه إلى <strong>الإعدادات ⚙️</strong> &larr; الصق كود التفعيل في خانة <strong>&quot;مفتاح الترخيص&quot;</strong> واضغط <strong>&quot;تفعيل&quot;</strong>. سيتم فتح جميع الموديولات فوراً!
                  </p>
                </div>
              )}
            </form>
          </SpotlightCard>

          {/* POS Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[
              {
                icon: Zap,
                title: "100% Offline-First",
                desc: "يعمل بسرعة خارقة بدون أي انتظار حتى في حال انقطاع الإنترنت أو بطئه التام."
              },
              {
                icon: Printer,
                title: "طابعات الفواتير والباركود",
                desc: "دعم فوري لكافة طابعات الفواتير الحرارية ESC/POS وقوارئ الباركود وأدراج النقدية."
              },
              {
                icon: Layers,
                title: "إدارة المخازن وسيريال الأجهزة",
                desc: "تتبع دقيق للأرصدة، تنبيهات النواقص، تاريخ الصلاحية، وسيريال الضمان للأجهزة."
              },
              {
                icon: Smartphone,
                title: "فواتير الواتساب التلقائية",
                desc: "إرسال فاتورة PDF أو نصية للعميل مباشرة عبر واتساب بمجرد إتمام عملية البيع."
              },
              {
                icon: RefreshCw,
                title: "مزامنة سحابية مؤمنة",
                desc: "مزامنة تلقائية مع لوحة تحكم QuazLink عند توفر الإنترنت لمتابعة مبيعات فروعك من هاتفك."
              },
              {
                icon: Clock,
                title: "ورديات الكاشير وتقفيل Z-Report",
                desc: "فتح وإغلاق الورديات، تسوية العهدة النقدية، وحساب الفروقات والتقارير المالية اليومية بدقة."
              }
            ].map((f, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-500/20 transition-all space-y-2.5"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h4 className="text-sm font-bold text-white">{f.title}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AUTOMATION RUNNER                                                   */}
      {/* ========================================================================= */}
      {activeTab === "runner" && (
        <div className="space-y-10">
          {/* Runner Hero Banner */}
          <div className="relative rounded-3xl p-8 md:p-12 border border-cyan-500/30 bg-gradient-to-b from-cyan-950/40 via-[var(--color-quaz-bg)] to-black/60 shadow-2xl overflow-hidden text-center space-y-6">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              OFFICIAL DESKTOP RUNNER • {PLATFORM_VERSION}
            </div>

            <div className="space-y-3 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
                تحميل برنامج <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">QuazLink Runner</span> للكمبيوتر
              </h2>
              <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                محرك الأتمتة المكتبي الخفيف والموثوق. يقوم بتنفيذ مهام رسائل وفواتير الواتساب، ونشر الحالات، ومنشورات فيسبوك وإنستغرام تلقائياً من جهازك وعنوان الـ IP المنزلي الحقيقي لمنع الحظر بنسبة 100%.
              </p>
            </div>

            {/* Primary Download CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                href="/downloads/QuazLink-Runner-Setup.exe"
                download="QuazLink-Runner-Setup.exe"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold rounded-2xl text-base shadow-[0_0_35px_rgba(34,211,238,0.5)] hover:shadow-[0_0_45px_rgba(34,211,238,0.8)] transition-all flex items-center justify-center gap-3 cursor-pointer group"
              >
                <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                <span>تحميل برنامج التثبيت (Windows .exe)</span>
              </a>

              <a
                href="quazlink://open"
                className="w-full sm:w-auto px-6 py-4 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Laptop className="w-4 h-4 text-cyan-400" />
                <span>فتح البرنامج المثبت بالفعل</span>
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400 pt-2 font-mono">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                الحجم: ~80 ميجابايت
              </span>
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                الأنظمة: Windows 10 / 11 (64-bit)
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                تثبيت بنقرة واحدة (One-Click Setup)
              </span>
            </div>
          </div>

          {/* 3 Step Setup Guide */}
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white">طريقة التثبيت والربط في دقيقة واحدة</h3>
              <p className="text-xs text-gray-400 mt-1">خطوات سريعة وسهلة لتشغيل الرانر وربطه بحسابك</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold font-mono text-lg flex items-center justify-center">
                  1
                </div>
                <h4 className="text-sm font-bold text-white">حمّل وثبّت البرنامج</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  اضغط على زر التحميل، وافتح ملف <code className="text-cyan-300 font-mono">QuazLink-Runner-Setup.exe</code>. سيتم التثبيت فورياً وإنشاء اختصار رسمي على سطح المكتب.
                </p>
              </SpotlightCard>

              <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold font-mono text-lg flex items-center justify-center">
                  2
                </div>
                <h4 className="text-sm font-bold text-white">اربط جهازك بحسابك</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  افتح البرنامج واضغط زر <strong>⚡ Open &amp; Auto-Pair</strong> في الموقع، أو ولّد رمز ربط من الأسفل والصقه في البرنامج لربطه بحسابك الشخصي.
                </p>
              </SpotlightCard>

              <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold font-mono text-lg flex items-center justify-center">
                  3
                </div>
                <h4 className="text-sm font-bold text-white">جاهز لتنفيذ الأتمتة!</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  يظل الرانر يعمل بهدوء في الخلفية بجوار الساعة (System Tray). يستقبل فواتير الواتساب والمهام وينفذها بدقة وثبات تام.
                </p>
              </SpotlightCard>
            </div>
          </div>

          {/* Instant Pairing Code Generator Box */}
          <SpotlightCard className="p-6 md:p-8 rounded-2xl border border-cyan-500/30 bg-black/40 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-cyan-400" />
                  <span>توليد رمز ربط فوري (Machine Pairing Code)</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  إذا قمت بتثبيت البرنامج وتريد ربط هذا الكمبيوتر بحسابك، اضغط لتوليد رمز الربط المباشر.
                </p>
              </div>

              <button
                onClick={handleGenerateRunnerCode}
                disabled={loadingRunnerPair}
                className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl text-xs hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Key className="w-4 h-4 text-black" />
                <span>{loadingRunnerPair ? "جاري التوليد..." : "توليد كود الربط الآن"}</span>
              </button>
            </div>

            {runnerPairingToken ? (
              <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">رمز الربط المتاح:</span>
                  <span className="px-3.5 py-1.5 bg-black/60 border border-white/20 rounded-lg text-white font-mono font-bold text-lg tracking-widest">
                    {runnerPairingToken}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(runnerPairingToken, "runner-token")}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === "runner-token" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === "runner-token" ? "تم النسخ" : "نسخ الكود"}</span>
                  </button>
                  <a
                    href={`quazlink://pair?token=${runnerPairingToken}`}
                    className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                  >
                    <Zap className="w-3.5 h-3.5 fill-black" />
                    <span>⚡ ربط تلقائي فوري</span>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-mono">
                اضغط على &quot;توليد كود الربط الآن&quot; لإنشاء رمز صالح لجهاز الكمبيوتر الخاص بك.
              </p>
            )}
          </SpotlightCard>
        </div>
      )}
    </div>
  );
}
