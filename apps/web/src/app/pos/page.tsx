"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Store,
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
  FolderArchive,
  RefreshCw,
  ShoppingBag,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  QrCode,
  Tag,
  Shield,
  FileText,
  BadgePercent,
  Terminal,
  ArrowRight,
  Monitor
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import {
  getDownloadsInfo,
  generatePosLicense,
  type DownloadsInfoResponse
} from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

export default function PosPortalPage() {
  const { lang, isAr } = useLanguage();
  const t = translations[lang];

  // Download metadata
  const [downloadsInfo, setDownloadsInfo] = React.useState<DownloadsInfoResponse | null>(null);
  const [loadingInfo, setLoadingInfo] = React.useState(true);

  // License state
  const [posHwId, setPosHwId] = React.useState("");
  const [posBusinessName, setPosBusinessName] = React.useState("");
  const [posTier, setPosTier] = React.useState<"lifetime" | "saas_subscription">("lifetime");
  const [posLicenseKey, setPosLicenseKey] = React.useState<string | null>(null);
  const [posExpiresAt, setPosExpiresAt] = React.useState<string | null>(null);
  const [loadingLicense, setLoadingLicense] = React.useState(false);
  const [licenseError, setLicenseError] = React.useState<string | null>(null);
  const [copiedKey, setCopiedKey] = React.useState(false);

  // Interactive Mockup State
  const [mockupCartCount, setMockupCartCount] = React.useState(3);
  const [activeFaq, setActiveFaq] = React.useState<number | null>(null);
  const [downloadOsTab, setDownloadOsTab] = React.useState<"modern" | "legacy">("modern");

  React.useEffect(() => {
    getDownloadsInfo()
      .then((data) => {
        setDownloadsInfo(data);
        setLoadingInfo(false);
      })
      .catch((err) => {
        console.warn("Failed to load downloads info:", err);
        setLoadingInfo(false);
      });
  }, []);

  const handleCopyLicense = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posHwId.trim()) {
      setLicenseError(isAr ? "يرجى إدخال بصمة الجهاز (Hardware ID) التي تظهر لك في شاشة تفعيل البرنامج." : "Please enter the Hardware ID shown on the app activation screen.");
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
      setLicenseError(e.message || (isAr ? "حدث خطأ أثناء إصدار كود التفعيل." : "Failed to generate license key."));
    } finally {
      setLoadingLicense(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">

      {/* 1. HERO SECTION */}
      <section className="relative w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-20 text-center flex flex-col items-center">
        
        {/* Release Tag */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-medium mb-8 shadow-sm"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{t.posHeroReleaseTag}</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-5xl text-balance leading-[1.15]"
        >
          {t.posHeroTitle1}{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            {t.posHeroTitle2}
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-base sm:text-xl text-gray-300 max-w-3xl leading-relaxed text-balance"
        >
          {t.posHeroSubtitle}
        </motion.p>

        {/* Quick CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="#downloads"
            className="flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-base hover:from-emerald-400 hover:to-cyan-400 shadow-xl shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5" />
            <span>{t.posHeroDownloadBtn}</span>
          </a>

          <a
            href="#activation"
            className="flex items-center gap-2 px-7 py-4 rounded-2xl bg-[#0B101D] hover:bg-[#121929] text-white font-semibold text-base border border-white/15 transition-all hover:border-emerald-500/40"
          >
            <Key className="w-5 h-5 text-emerald-400" />
            <span>{t.posHeroActivateBtn}</span>
          </a>

          <a
            href="#features"
            className="flex items-center gap-2 px-6 py-4 rounded-2xl text-gray-400 hover:text-white text-sm font-medium transition-colors"
          >
            <span>{t.posHeroExploreBtn}</span>
            <ChevronDown className="w-4 h-4" />
          </a>
        </motion.div>

        {/* Strategic Pillars Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className={`mt-16 w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 ${isAr ? "text-right" : "text-left"}`}
        >
          <div className="p-4 rounded-2xl bg-[#0F1424] border border-emerald-500/20 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-emerald-400">{t.pillar1Val}</span>
              <Printer className="w-5 h-5 text-emerald-400/70" />
            </div>
            <span className="text-xs font-semibold text-white">{t.pillar1Title}</span>
            <span className="text-[11px] text-gray-400">{t.pillar1Desc}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#0F1424] border border-emerald-500/20 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-cyan-400">{t.pillar2Val}</span>
              <HardDrive className="w-5 h-5 text-cyan-400/70" />
            </div>
            <span className="text-xs font-semibold text-white">{t.pillar2Title}</span>
            <span className="text-[11px] text-gray-400">{t.pillar2Desc}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#0F1424] border border-emerald-500/20 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-amber-400">{t.pillar3Val}</span>
              <QrCode className="w-5 h-5 text-amber-400/70" />
            </div>
            <span className="text-xs font-semibold text-white">{t.pillar3Title}</span>
            <span className="text-[11px] text-gray-400">{t.pillar3Desc}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#0F1424] border border-emerald-500/20 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-emerald-400">{t.pillar4Val}</span>
              <Tag className="w-5 h-5 text-emerald-400/70" />
            </div>
            <span className="text-xs font-semibold text-white">{t.pillar4Title}</span>
            <span className="text-[11px] text-gray-400">{t.pillar4Desc}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#0F1424] border border-emerald-500/20 flex flex-col gap-1.5 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-green-400">{t.pillar5Val}</span>
              <Smartphone className="w-5 h-5 text-green-400/70" />
            </div>
            <span className="text-xs font-semibold text-white">{t.pillar5Title}</span>
            <span className="text-[11px] text-gray-400">{t.pillar5Desc}</span>
          </div>
        </motion.div>

      </section>

      {/* 2. INTERACTIVE APP SHOWCASE / TERMINAL PREVIEW */}
      <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="relative rounded-3xl bg-gradient-to-b from-[#131B2E] to-[#0A0E18] p-1 border border-emerald-500/25 shadow-2xl shadow-emerald-950/50 overflow-hidden">
          
          {/* Top Window Chrome */}
          <div className="h-11 px-4 bg-[#0B101D] border-b border-white/10 rounded-t-[22px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>QuazLink POS & ERP — الفرع الرئيسي (B01) — كاشير رقم (POS-01)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>الوردية #12 مفتوحة</span>
            </div>
          </div>

          {/* Interactive Mock POS Body */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#080C16]">
            
            {/* Left 8 Cols: Sales Register Screen */}
            <div className="lg:col-span-8 flex flex-col gap-4 text-right">
              {/* Barcode input simulation */}
              <div className="p-4 rounded-2xl bg-[#0F1626] border border-white/10 flex items-center justify-between gap-4">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-mono">F2: بيع سريع</span>
                <div className="flex-1 flex items-center gap-3 justify-end text-right">
                  <span className="text-xs text-gray-400">امسح الباركود أو ابحث عن الصنف:</span>
                  <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-emerald-500/40 text-emerald-300 font-mono text-sm flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-emerald-400 animate-pulse" />
                    <span>6221155990012</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-2xl bg-[#0E1424] border border-white/5 overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2.5 bg-white/5 text-xs font-semibold text-gray-300 border-b border-white/5">
                  <div className="col-span-5 text-right">الصنف</div>
                  <div className="col-span-2 text-center">الكمية</div>
                  <div className="col-span-2 text-center">السعر</div>
                  <div className="col-span-3 text-left">الإجمالي</div>
                </div>
                
                <div className="divide-y divide-white/5 text-sm">
                  <div className="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/[0.02]">
                    <div className="col-span-5 text-right font-medium">
                      <span>شاشة Dell UltraSharp 27" 4K</span>
                      <span className="block text-[11px] text-emerald-400 font-mono">SN: DL-4K-992182 (ضمان سنتين)</span>
                    </div>
                    <div className="col-span-2 text-center font-mono text-gray-300">1</div>
                    <div className="col-span-2 text-center font-mono text-gray-300">18,500 ج.م</div>
                    <div className="col-span-3 text-left font-mono font-bold text-emerald-400">18,500 ج.م</div>
                  </div>

                  <div className="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/[0.02]">
                    <div className="col-span-5 text-right font-medium">
                      <span>كابل HDMI 2.1 Ultra High Speed 2M</span>
                      <span className="block text-[11px] text-gray-500">باركود: 6220011244</span>
                    </div>
                    <div className="col-span-2 text-center font-mono text-gray-300">2</div>
                    <div className="col-span-2 text-center font-mono text-gray-300">350 ج.م</div>
                    <div className="col-span-3 text-left font-mono font-bold text-emerald-400">700 ج.م</div>
                  </div>

                  <div className="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/[0.02]">
                    <div className="col-span-5 text-right font-medium">
                      <span>ماوس لاسلكي Logitech MX Master 3S</span>
                      <span className="block text-[11px] text-emerald-400 font-mono">SN: MX-3S-881924</span>
                    </div>
                    <div className="col-span-2 text-center font-mono text-gray-300">1</div>
                    <div className="col-span-2 text-center font-mono text-gray-300">4,200 ج.م</div>
                    <div className="col-span-3 text-left font-mono font-bold text-emerald-400">4,200 ج.م</div>
                  </div>
                </div>
              </div>

              {/* Bottom Financial summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-[11px] text-gray-400 block">المجموع قبل الضريبة</span>
                  <span className="text-base font-bold font-mono text-gray-200">20,526.32 ج.م</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-[11px] text-amber-300 block">ضريبة القيمة المضافة (14%)</span>
                  <span className="text-base font-bold font-mono text-amber-400">2,873.68 ج.م</span>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-[11px] text-emerald-300 block">الإجمالي النهائي المطلوب</span>
                  <span className="text-lg font-black font-mono text-emerald-400">23,400.00 ج.م</span>
                </div>
              </div>
            </div>

            {/* Right 4 Cols: Thermal Receipt Simulator & Payment */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="p-5 rounded-2xl bg-[#0F1626] border border-emerald-500/20 text-center flex flex-col items-center">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-1">
                  معاينة الإيصال الحراري الفوري
                </span>
                <span className="text-[11px] text-gray-400 mb-4">
                  طباعة نقطية عالية النقاء 1.8ms (80mm ESC/POS)
                </span>

                {/* Thermal Bill Mockup */}
                <div className="w-full max-w-[260px] bg-white text-black p-4 rounded-lg shadow-xl font-mono text-[11px] text-right space-y-2 border border-gray-300">
                  <div className="text-center font-bold text-xs pb-1 border-b border-dashed border-gray-400">
                    شركة كويزلينك لتجارة التجزئة
                    <div className="text-[9px] font-normal text-gray-700">س.ت: 409182 | ب.ض: 582-901-233</div>
                  </div>

                  <div className="flex justify-between text-[10px]">
                    <span>فاتورة رقم:</span>
                    <span className="font-bold">INV-B01-POS01-0042</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>التاريخ والوقت:</span>
                    <span>2026-10-07 14:30</span>
                  </div>
                  
                  <div className="border-t border-b border-dashed border-gray-400 py-1 text-[10px] space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>Dell UltraSharp 4K x1</span>
                      <span>18,500.00</span>
                    </div>
                    <div className="text-[8px] text-gray-600">S/N: DL-4K-992182 (ضمان سنتين)</div>
                    <div className="flex justify-between font-bold">
                      <span>كابل HDMI 2.1 x2</span>
                      <span>700.00</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Logitech MX 3S x1</span>
                      <span>4,200.00</span>
                    </div>
                  </div>

                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span>المبلغ الخاضع للضريبة:</span>
                      <span>20,526.32</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ضريبة القيمة المضافة 14%:</span>
                      <span>2,873.68</span>
                    </div>
                    <div className="flex justify-between font-black text-xs pt-1 border-t border-gray-300">
                      <span>الصافي المدفوع:</span>
                      <span>23,400.00 ج.م</span>
                    </div>
                  </div>

                  {/* ETA QR Code Mockup */}
                  <div className="pt-2 border-t border-dashed border-gray-400 flex flex-col items-center gap-1">
                    <div className="w-16 h-16 bg-gray-900 rounded p-1 flex items-center justify-center text-white">
                      <QrCode className="w-12 h-12 text-white" />
                    </div>
                    <span className="text-[8px] text-gray-600">إيصال ضريبي إلكتروني معتمد (ETA TLV)</span>
                  </div>
                </div>

                <div className="w-full mt-4 flex items-center justify-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>طابعة Xprinter 80mm جاهزة ومتصلة</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 3. DIRECT DOWNLOADS CENTER */}
      <section id="downloads" className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-20 scroll-mt-24">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4">
            <Download className="w-3.5 h-3.5" />
            <span>{t.posDownloadTag}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            {t.posDownloadTitle}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-gray-400 leading-relaxed">
            {t.posDownloadSubtitle}
          </p>
        </div>

        {/* OS Edition Switcher Tabs */}
        <div className="flex items-center justify-center mb-10">
          <div className="inline-flex p-1.5 rounded-2xl bg-[#090D18] border border-white/10 gap-1">
            <button
              onClick={() => setDownloadOsTab("modern")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                downloadOsTab === "modern"
                  ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-black shadow-lg shadow-emerald-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Laptop className="w-4 h-4" />
              <span>{t.posTabModern}</span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/20 text-black font-extrabold">{t.posTabModernRecommended}</span>
            </button>

            <button
              onClick={() => setDownloadOsTab("legacy")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                downloadOsTab === "legacy"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>{t.posTabLegacy}</span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/20 text-black font-extrabold">{t.posTabLegacyOptional}</span>
            </button>
          </div>
        </div>

        {/* Download Cards Grid */}
        <AnimatePresence mode="wait">
          {downloadOsTab === "modern" ? (
            <motion.div
              key="modern-cards"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12"
            >
              {/* Card 1: Official Windows Installer (.exe) */}
              <SpotlightCard className="relative p-8 rounded-3xl bg-[#0B101D] border-2 border-emerald-500/40 flex flex-col justify-between group">
                <div className="absolute top-5 left-5 px-3 py-1 rounded-full bg-emerald-500 text-black font-bold text-xs uppercase tracking-wide">
                  موصى به للمحلات
                </div>

                <div>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                    <Laptop className="w-7 h-7 text-emerald-400" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">
                    برنامج التثبيت الرسمي (Windows 10 / 11)
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mb-4">
                    QuazLink-POS-Setup-v1.1.0.exe • الإصدار 1.1.0
                  </p>

                  <p className="text-sm text-gray-300 leading-relaxed mb-6">
                    برنامج تثبيت قياسي كامل (NSIS Setup) يقوم بتهيئة بيئة التشغيل، إنشاء اختصارات سطح المكتب وقائمة ابدأ، وربط الطابعات وأجهزة الباركود تلقائياً.
                  </p>

                  <div className="space-y-2.5 mb-8 text-xs text-gray-300">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>تثبيت بنقرة واحدة مع أيقونة رسمية على الديسكتوب</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>محرك Chromium 126 مع قاعدة بيانات محلية SQLite فائقة السرعة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>حجم الملف: <strong>70.6 ميجابايت</strong> (جاهز للتحميل)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <a
                    href="/downloads/QuazLink-POS-Setup-v1.1.0.exe"
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-center text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-cyan-400 transition-all transform hover:-translate-y-0.5"
                    download="QuazLink-POS-Setup-v1.1.0.exe"
                  >
                    <Download className="w-5 h-5" />
                    <span>تحميل برنامج التثبيت (Setup .exe)</span>
                  </a>
                  <span className="block text-center text-[11px] text-gray-500 mt-2">
                    رابط مباشر وسريع • يدعم استئناف التحميل
                  </span>
                </div>
              </SpotlightCard>

              {/* Card 2: Portable Edition (.zip) */}
              <SpotlightCard className="relative p-8 rounded-3xl bg-[#0B101D] border border-white/10 flex flex-col justify-between group hover:border-cyan-500/40 transition-colors">
                <div className="absolute top-5 left-5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-xs">
                  بدون تثبيت (Portable)
                </div>

                <div>
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                    <FolderArchive className="w-7 h-7 text-cyan-400" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">
                    النسخة المحمولة بدون تثبيت
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mb-4">
                    QuazLink-POS-Portable-v1.1.0.zip • الإصدار 1.1.0
                  </p>

                  <p className="text-sm text-gray-300 leading-relaxed mb-6">
                    نسخة مجهزة للتشغيل الفوري من فلاشة USB أو أي مجلد بدون صلاحيات مدير النظام (No Admin Rights). فك الضغط واضغط مرتين للبدء فوراً.
                  </p>

                  <div className="space-y-2.5 mb-8 text-xs text-gray-300">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>لا تتطلب أي خطوات تثبيت أو إعدادات مسبقة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>مثالية لأجهزة الكاشير المقيدة أو العمل من فلاشة USB</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>حجم الملف: <strong>73.8 ميجابايت</strong> (مضغوط ZIP)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <a
                    href="/downloads/QuazLink-POS-Portable-v1.1.0.zip"
                    className="w-full py-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-center text-sm sm:text-base flex items-center justify-center gap-2.5 border border-white/10 hover:border-cyan-500/50 transition-all"
                    download="QuazLink-POS-Portable-v1.1.0.zip"
                  >
                    <FolderArchive className="w-5 h-5 text-cyan-400" />
                    <span>تحميل النسخة المحمولة (Portable .zip)</span>
                  </a>
                  <span className="block text-center text-[11px] text-gray-500 mt-2">
                    تشغيل فوري • احتفظ ببياناتك على فلاشة
                  </span>
                </div>
              </SpotlightCard>
            </motion.div>
          ) : (
            <motion.div
              key="legacy-cards"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12"
            >
              {/* Legacy Card 1: Windows 7 Installer (.exe) */}
              <SpotlightCard className="relative p-8 rounded-3xl bg-[#0E0F17] border-2 border-amber-500/40 flex flex-col justify-between group">
                <div className="absolute top-5 left-5 px-3 py-1 rounded-full bg-amber-500 text-black font-bold text-xs uppercase tracking-wide">
                  مخصص لأجهزة Win 7 & POSReady
                </div>

                <div>
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                    <Monitor className="w-7 h-7 text-amber-400" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">
                    نسخة التثبيت للأجهزة القديمة (Win 7 Edition)
                  </h3>
                  <p className="text-xs text-amber-300 font-mono mb-4">
                    QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe • الإصدار 1.1.0
                  </p>

                  <p className="text-sm text-gray-300 leading-relaxed mb-6">
                    إصدار مخصص رسمياً لأجهزة نقاط البيع القديمة وشاشات اللمس (Elo, Posiflex, IBM) التي تعمل بنظام Windows 7 SP1 أو Windows 8 أو Windows POSReady 7 دون الحاجة لتحديث نظام التشغيل.
                  </p>

                  <div className="space-y-2.5 mb-8 text-xs text-gray-300">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>متوافق 100% مع Windows 7 SP1 (32 بت و 64 بت)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>استهلاك ذاكرة منخفض جداً (يناسب أجهزة 2GB RAM)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>حجم خفيف فائق السرعة: <strong>73.8 ميجابايت</strong> (جاهز للتحميل)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <a
                    href="/downloads/QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe"
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-center text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition-all transform hover:-translate-y-0.5"
                    download="QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe"
                  >
                    <Download className="w-5 h-5" />
                    <span>تحميل نسخة Windows 7 (Setup .exe)</span>
                  </a>
                  <span className="block text-center text-[11px] text-gray-500 mt-2">
                    متوافق مع جميع شاشات اللمس وطابعات الفواتير القديمة
                  </span>
                </div>
              </SpotlightCard>

              {/* Legacy Card 2: Windows 7 Portable (.zip / .exe) */}
              <SpotlightCard className="relative p-8 rounded-3xl bg-[#0E0F17] border border-amber-500/20 flex flex-col justify-between group hover:border-amber-500/40 transition-colors">
                <div className="absolute top-5 left-5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-xs">
                  بدون تثبيت (Win 7 Portable)
                </div>

                <div>
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                    <FolderArchive className="w-7 h-7 text-amber-400" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">
                    النسخة المحمولة لويندوز 7
                  </h3>
                  <p className="text-xs text-amber-300 font-mono mb-4">
                    QuazLink-POS-Legacy-Win7-Portable-v1.1.0.zip • الإصدار 1.1.0
                  </p>

                  <p className="text-sm text-gray-300 leading-relaxed mb-6">
                    ملف تنفيذي فوري يعمل مباشرة على أي جهاز كاشير بنظام ويندوز 7 بدون أي خطوات تثبيت أو ملفات إضافية. فقط فك الضغط وابدأ البيع.
                  </p>

                  <div className="space-y-2.5 mb-8 text-xs text-gray-300">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>تشغيل فوري بضغطة زر دون الحاجة لصلاحيات Administrator</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>محرك SQLite WebAssembly خفيف وثابت بالكامل</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>حجم الملف: <strong>73.6 ميجابايت</strong> (مضغوط ZIP)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <a
                    href="/downloads/QuazLink-POS-Legacy-Win7-Portable-v1.1.0.zip"
                    className="w-full py-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-center text-sm sm:text-base flex items-center justify-center gap-2.5 border border-white/10 hover:border-amber-500/50 transition-all"
                    download="QuazLink-POS-Legacy-Win7-Portable-v1.1.0.zip"
                  >
                    <FolderArchive className="w-5 h-5 text-amber-400" />
                    <span>تحميل نسخة Win 7 المحمولة (Portable .zip)</span>
                  </a>
                  <span className="block text-center text-[11px] text-gray-500 mt-2">
                    تشغيل مباشر من فلاشة USB أو سطح المكتب
                  </span>
                </div>
              </SpotlightCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* System Requirements Bar */}
        <div className="p-6 rounded-2xl bg-[#090D18] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-gray-300">
          <div className="flex items-center gap-3">
            <Cpu className={`w-6 h-6 shrink-0 ${downloadOsTab === "modern" ? "text-emerald-400" : "text-amber-400"}`} />
            <div>
              <span className="font-bold text-white block">
                {downloadOsTab === "modern" ? "متطلبات النسخة الحديثة (Modern):" : "متطلبات نسخة الأجهزة القديمة (Legacy Win7):"}
              </span>
              <span className="text-gray-400">
                {downloadOsTab === "modern"
                  ? "ويندوز 10 أو 11 (64 بت) • رامات 4 جيجابايت فأكثر • مساحة تخزين 600 ميجابايت • محرك Chromium الحديث"
                  : "ويندوز 7 SP1 أو ويندوز 8 أو POSReady 7 (32/64 بت) • رامات 2 جيجابايت فقط • مساحة تخزين 200 ميجابايت"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 border-t md:border-t-0 md:border-r border-white/10 pt-4 md:pt-0 md:pr-6">
            <div>
              <span className="font-bold text-white block">الأجهزة والطرفيات المدعومة:</span>
              <span className="text-gray-400">جميع طابعات الفواتير الحرارية (80mm/58mm)، قارئ الباركود USB/Serial، وأدراج النقدية.</span>
            </div>
          </div>
        </div>

      </section>

      {/* 4. INSTANT MACHINE ACTIVATION & LICENSE GENERATOR */}
      <section id="activation" className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-20 scroll-mt-24">
        
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#0B101D] to-[#070A12] border border-emerald-500/30 shadow-2xl relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start relative z-10">
            
            {/* Left 5 cols: Description & Instructions */}
            <div className={`lg:col-span-5 ${isAr ? "text-right" : "text-left"}`}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4 border border-emerald-500/30">
                <Key className="w-3.5 h-3.5" />
                <span>{t.posActTag}</span>
              </div>

              <h2 className="text-3xl font-extrabold text-white mb-4">
                {t.posActTitle}
              </h2>

              <p className="text-sm text-gray-300 leading-relaxed mb-6">
                {t.posActSubtitle}
              </p>

              {/* Free Trial Banner */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-6 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-200">
                  <strong className="block font-bold text-white mb-0.5">
                    {isAr ? "فترة تجريبية مجانية 60 يوماً مدمجة:" : "Built-in 60-Day Full Trial:"}
                  </strong>
                  {isAr 
                    ? "كل نسخة تقوم بتحميلها تأتي مفعلة تلقائياً بكامل الميزات وبدون أي قيود لمدة شهرين لتجربة البرنامج في متجرك."
                    : "Every downloaded copy is automatically pre-activated with full features and zero limitations for two months."}
                </div>
              </div>

              <div className="space-y-3 text-xs text-gray-400">
                <span className="font-semibold text-white block">
                  {isAr ? "كيف تحصل على بصمة جهازك (Hardware ID)؟" : "How to obtain your Hardware ID?"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-[10px]">1</span>
                  <span>{t.posActStep1Desc}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-[10px]">2</span>
                  <span>{t.posActStep2Desc}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-[10px]">3</span>
                  <span>{t.posActStep3Desc}</span>
                </div>
              </div>
            </div>

            {/* Right 7 cols: Interactive Form */}
            <div className="lg:col-span-7 bg-[#090D18] p-6 sm:p-8 rounded-2xl border border-white/10">
              <form onSubmit={handleGenerateLicense} className={`space-y-5 ${isAr ? "text-right" : "text-left"}`}>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2">
                    {t.posActFormHwidLabel} <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t.posActFormHwidPlaceholder}
                    value={posHwId}
                    onChange={(e) => setPosHwId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/15 text-white font-mono text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 transition-colors uppercase"
                  />
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    {isAr ? "يتم استخراجه من شاشة إعدادات الترخيص داخل برنامج الكاشير." : "Retrieved from the License & Activation settings inside QuazLink POS."}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2">
                    {t.posActFormBizLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={t.posActFormBizPlaceholder}
                    value={posBusinessName}
                    onChange={(e) => setPosBusinessName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/15 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2">
                    {isAr ? "نوع الترخيص المطلوب" : "License Plan Tier"}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPosTier("lifetime")}
                      className={`p-3.5 rounded-xl border ${isAr ? "text-right" : "text-left"} transition-all ${
                        posTier === "lifetime"
                          ? "bg-emerald-500/20 border-emerald-500 text-white shadow-md shadow-emerald-500/10"
                          : "bg-black/30 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      <span className="font-bold text-xs block mb-0.5">
                        {isAr ? "ترخيص دائم للأجهزة" : "Lifetime Standalone"}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {isAr ? "مدى الحياة بدون إنترنت (Lifetime)" : "Perpetual offline license"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPosTier("saas_subscription")}
                      className={`p-3.5 rounded-xl border ${isAr ? "text-right" : "text-left"} transition-all ${
                        posTier === "saas_subscription"
                          ? "bg-cyan-500/20 border-cyan-500 text-white shadow-md shadow-cyan-500/10"
                          : "bg-black/30 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      <span className="font-bold text-xs block mb-0.5">
                        {isAr ? "اشتراك سنوي سحابي" : "Annual Cloud Sync"}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {isAr ? "مزامنة سحابية مستمرة (12 شهر)" : "Cloud backup (12 Months)"}
                      </span>
                    </button>
                  </div>
                </div>

                {licenseError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{licenseError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loadingLicense}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-sm flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-cyan-400 transition-all disabled:opacity-50"
                >
                  {loadingLicense ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isAr ? "جاري تشفير وإصدار المفتاح الرقمي..." : "Signing cryptographic license key..."}</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>{t.posActFormSubmitBtn}</span>
                    </>
                  )}
                </button>

              </form>

              {/* Output Result Box */}
              <AnimatePresence>
                {posLicenseKey && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`mt-6 p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 ${isAr ? "text-right" : "text-left"} space-y-3`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        {t.posActSuccessTitle}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {t.posActSuccessSigned}
                      </span>
                    </div>

                    <div className="relative">
                      <textarea
                        readOnly
                        rows={2}
                        value={posLicenseKey}
                        className="w-full p-3 pr-4 rounded-xl bg-black/70 border border-emerald-500/30 font-mono text-xs text-emerald-300 break-all select-all focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyLicense(posLicenseKey)}
                        className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs flex items-center gap-2 hover:bg-emerald-400 transition-colors shadow-md"
                      >
                        {copiedKey ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>{t.posActCopiedMsg}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{t.posActCopyKeyBtn}</span>
                          </>
                        )}
                      </button>

                      <div className="text-[11px] text-gray-400">
                        {posExpiresAt ? (
                          <span>{t.posActValidUntil} <strong className="text-white font-mono">{posExpiresAt}</strong></span>
                        ) : (
                          <span className="text-emerald-400 font-bold">{t.posActLifetime}</span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-normal pt-2 border-t border-white/10">
                      {t.posActFinalStep}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

          </div>

        </div>

      </section>

      {/* 5. COMPREHENSIVE FEATURES SHOWCASE */}
      <section id="features" className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-20 scroll-mt-24">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.posFeaturesHeaderTag}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            {t.posFeaturesHeaderTitle}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-gray-400 leading-relaxed">
            {t.posFeaturesHeaderSubtitle}
          </p>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${isAr ? "text-right" : "text-left"}`}>
          
          <SpotlightCard className="p-7 rounded-2xl bg-[#0B101D] border border-white/10 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-5">
                <Printer className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2.5">
                {t.posFeat1Title}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.posFeat1Desc}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-white/5 text-[11px] text-emerald-400 font-medium">
              {t.posFeat1Badge}
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-7 rounded-2xl bg-[#0B101D] border border-white/10 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-5">
                <Tag className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2.5">
                {t.posFeat2Title}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.posFeat2Desc}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-white/5 text-[11px] text-cyan-400 font-medium">
              {t.posFeat2Badge}
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-7 rounded-2xl bg-[#0B101D] border border-white/10 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-5">
                <QrCode className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2.5">
                {t.posFeat3Title}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.posFeat3Desc}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-white/5 text-[11px] text-amber-400 font-medium">
              {t.posFeat3Badge}
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-7 rounded-2xl bg-[#0B101D] border border-white/10 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-5">
                <Clock className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2.5">
                {t.posFeat4Title}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.posFeat4Desc}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-white/5 text-[11px] text-purple-400 font-medium">
              {t.posFeat4Badge}
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-7 rounded-2xl bg-[#0B101D] border border-white/10 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-5">
                <Smartphone className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2.5">
                {t.posFeat5Title}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.posFeat5Desc}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-white/5 text-[11px] text-green-400 font-medium">
              {t.posFeat5Badge}
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-7 rounded-2xl bg-[#0B101D] border border-white/10 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-5">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2.5">
                {t.posFeat6Title}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.posFeat6Desc}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-white/5 text-[11px] text-blue-400 font-medium">
              {t.posFeat6Badge}
            </div>
          </SpotlightCard>

        </div>

      </section>

      {/* 6. HARDWARE & PERIPHERALS COMPATIBILITY */}
      <section id="hardware" className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-20 scroll-mt-24">
        
        <div className={`p-8 sm:p-12 rounded-3xl bg-[#090D18] border border-white/10 ${isAr ? "text-right" : "text-left"}`}>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 pb-8 border-b border-white/10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {t.posHwTitle}
              </h2>
              <p className="text-sm text-gray-400">
                {t.posHwSubtitle}
              </p>
            </div>

            <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
              {t.posHwBadge}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
              <Printer className="w-6 h-6 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">{t.posHwPrintersTitle}</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.posHwPrintersDesc}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
              <QrCode className="w-6 h-6 text-cyan-400" />
              <h4 className="text-sm font-bold text-white">{t.posHwBarcodesTitle}</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.posHwBarcodesDesc}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
              <ShoppingBag className="w-6 h-6 text-amber-400" />
              <h4 className="text-sm font-bold text-white">{t.posHwDrawersTitle}</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.posHwDrawersDesc}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
              <Laptop className="w-6 h-6 text-purple-400" />
              <h4 className="text-sm font-bold text-white">{t.posHwTerminalsTitle}</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.posHwTerminalsDesc}
              </p>
            </div>

          </div>

        </div>

      </section>

      {/* 7. QUICK START GUIDE */}
      <section id="guide" className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-20 scroll-mt-24">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {t.posGuideTitle}
          </h2>
          <p className="mt-3 text-sm text-gray-400">
            {t.posGuideSubtitle}
          </p>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-4 gap-6 ${isAr ? "text-right" : "text-left"}`}>
          
          <div className="p-6 rounded-2xl bg-[#0B101D] border border-white/10 relative">
            <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm mb-4">
              1
            </span>
            <h4 className="text-base font-bold text-white mb-2">{t.posGuideStep1Title}</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              {t.posGuideStep1Desc}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0B101D] border border-white/10 relative">
            <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm mb-4">
              2
            </span>
            <h4 className="text-base font-bold text-white mb-2">{t.posGuideStep2Title}</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              {t.posGuideStep2Desc}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0B101D] border border-white/10 relative">
            <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm mb-4">
              3
            </span>
            <h4 className="text-base font-bold text-white mb-2">{t.posGuideStep3Title}</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              {t.posGuideStep3Desc}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0B101D] border border-white/10 relative">
            <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm mb-4">
              4
            </span>
            <h4 className="text-base font-bold text-white mb-2">{t.posGuideStep4Title}</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              {t.posGuideStep4Desc}
            </p>
          </div>

        </div>

      </section>

      {/* 8. FAQ SECTION */}
      <section id="faq" className="w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-20 scroll-mt-24">
        
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            {t.posFaqTitle}
          </h2>
          <p className="mt-3 text-sm text-gray-400">
            {t.posFaqSubtitle}
          </p>
        </div>

        <div className={`space-y-4 ${isAr ? "text-right" : "text-left"}`}>
          
          <div className="p-5 rounded-2xl bg-[#0B101D] border border-white/10">
            <h4 className="text-sm font-bold text-white mb-2">
              {t.posFaq1Q}
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              {t.posFaq1A}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0B101D] border border-white/10">
            <h4 className="text-sm font-bold text-white mb-2">
              {t.posFaq2Q}
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              {t.posFaq2A}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0B101D] border border-white/10">
            <h4 className="text-sm font-bold text-white mb-2">
              {t.posFaq3Q}
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              {t.posFaq3A}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0B101D] border border-white/10">
            <h4 className="text-sm font-bold text-white mb-2">
              {t.posFaq4Q}
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              {t.posFaq4A}
            </p>
          </div>

        </div>

      </section>

      {/* 9. BOTTOM CTA BANNER */}
      <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
        <div className="p-10 rounded-3xl bg-gradient-to-r from-emerald-900/60 via-[#0B101D] to-cyan-900/60 border border-emerald-500/40 text-center flex flex-col items-center">
          <Store className="w-12 h-12 text-emerald-400 mb-4" />
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            {t.posBottomCtaTitle}
          </h2>
          <p className="text-sm text-gray-300 max-w-2xl mb-8 leading-relaxed">
            {t.posBottomCtaSubtitle}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="#downloads"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-sm flex items-center gap-2 hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/25"
            >
              <Download className="w-4 h-4" />
              <span>{t.posBottomCtaDownloadBtn}</span>
            </a>
            <a
              href="#activation"
              className="px-7 py-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/10 transition-colors"
            >
              <span>{t.posBottomCtaActivateBtn}</span>
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}

