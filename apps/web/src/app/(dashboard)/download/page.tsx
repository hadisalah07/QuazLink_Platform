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
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

export default function DownloadPage() {
  const { lang, isAr } = useLanguage();
  const t = translations[lang];

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
      alert("Failed to generate pairing token: " + e.message);
    } finally {
      setLoadingRunnerPair(false);
    }
  };

  const handleGeneratePosLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posHwId.trim()) {
      setLicenseError(isAr ? "يرجى إدخال بصمة الجهاز (Hardware ID) التي تظهر داخل برنامج الكاشير." : "Please enter the Hardware ID shown inside POS settings.");
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
      setLicenseError(e.message || (isAr ? "حدث خطأ أثناء توليد مفتاح الترخيص." : "An error occurred while generating license key."));
    } finally {
      setLoadingLicense(false);
    }
  };

  return (
    <div className={`flex flex-col space-y-8 max-w-6xl mx-auto pb-20 ${isAr ? "text-right" : "text-left"}`}>
      {/* Header & Product Switcher Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.dlDashTag} • {PLATFORM_VERSION}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            {t.dlDashTitle}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">QuazLink</span>
          </h1>
          <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
            {t.dlDashSubtitle}
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
            <span>{t.dlTabPos}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/40 text-emerald-200 border border-emerald-400/30 whitespace-nowrap">
              {isAr ? "جديد" : "NEW"}
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
            <span>{t.dlTabRunner}</span>
          </button>
        </div>
      </div>

      {/* Standalone POS Portal Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-[#0B101D] to-cyan-950/60 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{t.dlPosBannerTitle}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono whitespace-nowrap">
                {t.dlPosBannerTag}
              </span>
            </h4>
            <p className="text-xs text-gray-400">
              {t.dlPosBannerDesc}
            </p>
          </div>
        </div>
        <Link
          href="/pos"
          className="shrink-0 px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-400 transition-colors shadow-md shadow-emerald-500/20 whitespace-nowrap"
        >
          <span>{t.dlPosBannerBtn}</span>
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
                <span>{t.dlPosSectionTag}</span>
              </div>

              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
                {t.dlPosSectionTitle}
              </h2>

              <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                {t.dlPosSectionDesc}
              </p>
            </div>

            {/* Download Buttons Section */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                href="/downloads/QuazLink-POS-Setup-v1.1.0.exe"
                download="QuazLink-POS-Setup-v1.1.0.exe"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold rounded-2xl text-base shadow-[0_0_35px_rgba(16,185,129,0.5)] hover:shadow-[0_0_50px_rgba(16,185,129,0.8)] transition-all flex items-center justify-center gap-3 cursor-pointer group"
              >
                <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                <div className={isAr ? "text-right" : "text-left"}>
                  <div className="font-bold text-sm md:text-base">{t.dlPosBtnSetup}</div>
                  <div className="text-[11px] text-emerald-100 font-mono font-normal">QuazLink-POS-Setup-v1.1.0.exe • (~70.6 MB)</div>
                </div>
              </a>

              <a
                href="/downloads/QuazLink-POS-Portable-v1.1.0.zip"
                download="QuazLink-POS-Portable-v1.1.0.zip"
                className="w-full sm:w-auto px-6 py-4 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-3 cursor-pointer"
              >
                <FolderArchive className="w-5 h-5 text-emerald-400" />
                <div className={isAr ? "text-right" : "text-left"}>
                  <div>{t.dlPosBtnPortable}</div>
                  <div className="text-[11px] text-gray-400 font-mono font-normal">QuazLink-POS-Portable-v1.1.0.zip • (~73.8 MB)</div>
                </div>
              </a>
            </div>

            {/* Dedicated Windows 7 Legacy Options */}
            <div className="pt-4 border-t border-white/10 flex flex-col items-center gap-3">
              <div className="text-xs text-amber-300 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-amber-400" />
                <span>{isAr ? "لديك جهاز كاشير أو شاشة لمس بنظام Windows 7 / 8 / POSReady 7 القديم؟" : "Running legacy Windows 7, 8, or POSReady 7 terminals?"}</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href="/downloads/QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe"
                  download="QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe"
                  className="px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>{t.dlPosBtnWin7Setup}</span>
                </a>

                <a
                  href="/downloads/QuazLink-POS-Legacy-Win7-Portable-v1.1.0.zip"
                  download="QuazLink-POS-Legacy-Win7-Portable-v1.1.0.zip"
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-semibold flex items-center gap-2 transition-all"
                >
                  <FolderArchive className="w-4 h-4 text-amber-400" />
                  <span>{t.dlPosBtnWin7Portable}</span>
                </a>
              </div>
            </div>

            {/* Hardware & Spec Badges */}
            <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-gray-400 pt-2 font-mono">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                {t.dlPosBadgeSystems}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                {t.dlPosBadgePrinters}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                {t.dlPosBadgeDb}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {t.dlPosBadgeTrial}
              </span>
            </div>
          </div>

          {/* 4 Steps Installation & Setup Guide */}
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white">{t.posGuideTitle}</h3>
              <p className="text-xs text-gray-400 mt-1">
                {t.posGuideSubtitle}
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
                <h4 className="text-sm font-bold text-white">{t.posGuideStep1Title}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {t.posGuideStep1Desc}
                </p>
              </SpotlightCard>

              <SpotlightCard
                spotlightColor="rgba(16, 185, 129, 0.2)"
                className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold font-mono text-lg flex items-center justify-center">
                  2
                </div>
                <h4 className="text-sm font-bold text-white">{t.posGuideStep2Title}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {t.posGuideStep2Desc}
                </p>
              </SpotlightCard>

              <SpotlightCard
                spotlightColor="rgba(16, 185, 129, 0.2)"
                className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold font-mono text-lg flex items-center justify-center">
                  3
                </div>
                <h4 className="text-sm font-bold text-white">{t.posGuideStep3Title}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {t.posGuideStep3Desc}
                </p>
              </SpotlightCard>

              <SpotlightCard
                spotlightColor="rgba(16, 185, 129, 0.2)"
                className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold font-mono text-lg flex items-center justify-center">
                  4
                </div>
                <h4 className="text-sm font-bold text-white">{t.posGuideStep4Title}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {t.posGuideStep4Desc}
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
                  <span>{t.dlLicenseTitle}</span>
                </h3>
                <p className="text-xs text-gray-400">
                  {t.dlLicenseSubtitle}
                </p>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold self-start sm:self-auto flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{t.dlLicenseSuccessSigned}</span>
              </div>
            </div>

            <form onSubmit={handleGeneratePosLicense} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
                    <span>{t.dlLicenseHwidLabel}</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t.dlLicenseHwidPlaceholder}
                    value={posHwId}
                    onChange={(e) => setPosHwId(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white font-mono text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all uppercase"
                  />
                  <span className="text-[11px] text-gray-500 block">
                    {isAr ? "تجد هذا الكود داخل شاشة إعدادات البرنامج على الجهاز المراد تشغيله." : "Find this code inside the POS settings screen on the terminal."}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300">{t.dlLicenseBizLabel}</label>
                  <input
                    type="text"
                    placeholder={t.dlLicenseBizPlaceholder}
                    value={posBusinessName}
                    onChange={(e) => setPosBusinessName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{t.dlLicenseTypeLabel}</span>
                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="tier"
                      checked={posTier === "lifetime"}
                      onChange={() => setPosTier("lifetime")}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>{t.dlLicenseLifetime}</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="tier"
                      checked={posTier === "saas_subscription"}
                      onChange={() => setPosTier("saas_subscription")}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>{t.dlLicenseSubscription}</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loadingLicense}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-extrabold rounded-xl text-xs shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4 text-black" />
                  <span>{loadingLicense ? t.dlLicenseGenerating : t.dlLicenseGenerateBtn}</span>
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
                      {t.dlLicenseSuccessTitle}
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">
                      {posExpiresAt ? (isAr ? `ينتهي في ${posExpiresAt}` : `Expires: ${posExpiresAt}`) : t.dlLicenseLifetime}
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
                          <span>{t.dlLicenseCopied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-black" />
                          <span>{t.dlLicenseCopyBtn}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    {t.dlLicenseNotice}
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
                title: t.dlPosFeat1Title,
                desc: t.dlPosFeat1Desc
              },
              {
                icon: Printer,
                title: t.dlPosFeat2Title,
                desc: t.dlPosFeat2Desc
              },
              {
                icon: Layers,
                title: t.dlPosFeat3Title,
                desc: t.dlPosFeat3Desc
              },
              {
                icon: Smartphone,
                title: t.dlPosFeat4Title,
                desc: t.dlPosFeat4Desc
              },
              {
                icon: RefreshCw,
                title: t.dlPosFeat5Title,
                desc: t.dlPosFeat5Desc
              },
              {
                icon: Clock,
                title: t.dlPosFeat6Title,
                desc: t.dlPosFeat6Desc
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
              <span>{t.dlRunnerSectionTag}</span>
            </div>

            <div className="space-y-3 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
                {t.dlRunnerSectionTitle}
              </h2>
              <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                {t.dlRunnerSectionDesc}
              </p>
            </div>

            {/* Primary Download CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                href="/downloads/QuazLink-Runner-Setup-v26.10.14.exe"
                download="QuazLink-Runner-Setup-v26.10.14.exe"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold rounded-2xl text-base shadow-[0_0_35px_rgba(34,211,238,0.5)] hover:shadow-[0_0_45px_rgba(34,211,238,0.8)] transition-all flex items-center justify-center gap-3 cursor-pointer group"
              >
                <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                <div className={isAr ? "text-right" : "text-left"}>
                  <div className="font-bold text-sm md:text-base">{t.dlRunnerBtnDownload}</div>
                  <div className="text-[11px] text-cyan-200 font-mono font-normal">QuazLink-Runner-Setup-v26.10.14.exe • (~76 MB)</div>
                </div>
              </a>

              <a
                href="quazlink://open"
                className="w-full sm:w-auto px-6 py-4 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Laptop className="w-4 h-4 text-cyan-400" />
                <span>{t.dlRunnerBtnOpen}</span>
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400 pt-2 font-mono">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                {isAr ? "الحجم: ~76.5 ميجابايت" : "Size: ~76.5 MB"}
              </span>
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                {isAr ? "الأنظمة: Windows 10 / 11 (64-bit)" : "OS: Windows 10 / 11 (64-bit)"}
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {isAr ? "تثبيت بنقرة واحدة (One-Click Setup)" : "One-Click Setup"}
              </span>
            </div>
          </div>

          {/* 3 Step Setup Guide */}
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white">{t.dlRunnerStepsTitle}</h3>
              <p className="text-xs text-gray-400 mt-1">{t.dlRunnerStepsSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold font-mono text-lg flex items-center justify-center">
                  1
                </div>
                <h4 className="text-sm font-bold text-white">{t.dlRunnerStep1Title}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {t.dlRunnerStep1Desc}
                </p>
              </SpotlightCard>

              <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold font-mono text-lg flex items-center justify-center">
                  2
                </div>
                <h4 className="text-sm font-bold text-white">{t.dlRunnerStep2Title}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {t.dlRunnerStep2Desc}
                </p>
              </SpotlightCard>

              <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold font-mono text-lg flex items-center justify-center">
                  3
                </div>
                <h4 className="text-sm font-bold text-white">{t.dlRunnerStep3Title}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {t.dlRunnerStep3Desc}
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
                  <span>{t.dlRunnerPairTokenTitle}</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {t.dlRunnerPairTokenDesc}
                </p>
              </div>

              <button
                onClick={handleGenerateRunnerCode}
                disabled={loadingRunnerPair}
                className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl text-xs hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Key className="w-4 h-4 text-black" />
                <span>{loadingRunnerPair ? t.dlRunnerPairing : t.dlRunnerPairBtn}</span>
              </button>
            </div>

            {runnerPairingToken ? (
              <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{isAr ? "رمز الربط المتاح:" : "Available Pairing Code:"}</span>
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
                    <span>{copiedKey === "runner-token" ? t.dlRunnerPairTokenCopied : t.dlRunnerPairTokenCopyBtn}</span>
                  </button>
                  <a
                    href={`quazlink://pair?token=${runnerPairingToken}`}
                    className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                  >
                    <Zap className="w-3.5 h-3.5 fill-black" />
                    <span>{isAr ? "⚡ ربط تلقائي فوري" : "⚡ Instant Auto-Pair"}</span>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-mono">
                {isAr ? "اضغط على \"توليد رمز ربط يدوي\" لإنشاء رمز صالح لجهاز الكمبيوتر الخاص بك." : "Click \"Generate 6-Digit Pairing Code\" to link your computer to your QuazLink account."}
              </p>
            )}
          </SpotlightCard>
        </div>
      )}
    </div>
  );
}
