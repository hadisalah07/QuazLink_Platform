"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Tv,
  Zap,
  Sparkles,
  ShieldCheck,
  Copy,
  Check,
  Terminal,
  ArrowRight,
  Activity,
  Layers,
  ChevronLeft,
  Sliders,
  ExternalLink,
  Laptop
} from "lucide-react";
import { StarField } from "@/components/effects/StarField";
import { NebulaBackground } from "@/components/effects/NebulaBackground";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useLanguage } from "@/context/LanguageContext";

export default function TvPortalPage() {
  const { lang, isAr } = useLanguage();
  const [copied, setCopied] = React.useState(false);
  const [hostOrigin, setHostOrigin] = React.useState("http://192.168.1.2:3001");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setHostOrigin(window.location.origin);
    }
  }, []);

  const downloadUrl = `${hostOrigin}/downloads/QuazHomeTV.apk?v=1.0.6`;

  const copyUrl = () => {
    navigator.clipboard.writeText(downloadUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className={`relative min-h-screen w-full flex flex-col items-center bg-[#060913] text-white overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-300 ${isAr ? "font-cairo" : ""}`} dir={isAr ? "rtl" : "ltr"}>
      {/* ── BACKGROUND EFFECTS ── */}
      <NebulaBackground />
      <StarField />

      {/* ── TOP NAV & LANGUAGE SWITCHER ── */}
      <LanguageSwitcher variant="floating" />

      {/* ── TOP NAV BAR ── */}
      <header className="relative z-20 w-full max-w-6xl px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-md group-hover:scale-110 transition-transform" />
            <img src="/logo.png" alt="QuazLink" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
              Quaz<span className="text-[var(--color-quaz-cyan,#22D3EE)]">Link</span>
            </span>
            <span className="text-[10px] font-mono text-gray-400 tracking-wider uppercase">
              {isAr ? "محرك التلفزيون الذكي" : "Smart TV & IoT Engine"}
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:inline-flex items-center gap-2 bg-[#0B101D] border border-white/10 px-3.5 py-1.5 rounded-full text-xs font-medium text-gray-300">
            <span className="w-2 h-2 rounded-full bg-[var(--color-quaz-cyan,#22D3EE)] animate-pulse" />
            <span>Fastify Hub :3001</span>
          </div>

          <Link href="/download" className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all flex items-center gap-1.5">
            <span>{isAr ? "جميع المنصات" : "All Platforms"}</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </Link>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <main className="relative z-10 w-full max-w-4xl px-4 sm:px-6 pt-10 pb-16 flex flex-col items-center text-center">
        {/* Animated Glowing Logo */}
        <motion.div
          className="relative w-24 h-24 mb-6 flex items-center justify-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/30 via-purple-500/25 to-emerald-500/20 blur-2xl animate-pulse" />
          <img src="/logo.png" alt="QuazLink Logo" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_25px_rgba(34,211,238,0.5)]" />
        </motion.div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-[#0B101D] border border-white/10 px-3.5 py-1.5 rounded-full shadow-sm mb-5">
          <span className="w-2 h-2 rounded-full bg-[var(--color-quaz-cyan,#22D3EE)] animate-pulse" />
          <span className="text-xs sm:text-sm font-medium text-gray-300">
            {isAr ? "المنظومة الذكية لشاشات أندرويد تي في" : "Next-Gen Android TV & Smart Home Engine"}
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            TV App v1.0.6
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-400 mb-4">
          QuazLink TV
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-gray-300 max-w-2xl mb-8 leading-relaxed">
          {isAr
            ? "التحكم في المنزل الذكي من شاشة التلفزيون بدون إيقاف الأفلام عبر واجهة زجاجية عائمة وزرار الريموت المخصص، متصلة مباشرة بـ Home Assistant."
            : "Control your entire smart home directly from Android TV without interrupting Netflix or YouTube. Powered by a floating glassmorphic overlay and low-latency Home Assistant gateway."}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-16 w-full sm:w-auto">
          <a
            href={downloadUrl}
            className="w-full sm:w-auto px-8 py-3.5 bg-white text-black font-bold text-sm sm:text-base rounded-full hover:bg-gray-200 transition-all shadow-[0_0_25px_rgba(255,255,255,0.35)] flex items-center justify-center gap-2.5 group"
          >
            <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
            <span>{isAr ? "تحميل ملف APK المباشر للشاشة (v1.0.6)" : "Download TV APK v1.0.6"}</span>
          </a>

          <Link
            href="/tv/portal"
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-sm rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/10"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>{isAr ? "بوابة تخصيص أزرار الشاشة (Entities Portal)" : "TV Entities Manager"}</span>
          </Link>

          <Link
            href="/tv/pair"
            className="w-full sm:w-auto px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-semibold text-sm rounded-full transition-all flex items-center justify-center gap-2"
          >
            <Tv className="w-4 h-4 text-cyan-400" />
            <span>{isAr ? "ربط شاشة بالـ QR" : "Pair New TV"}</span>
          </Link>

          <a
            href="/preview"
            className="w-full sm:w-auto px-7 py-3.5 bg-[#0B101D] text-white font-semibold text-sm sm:text-base rounded-full border border-white/10 hover:border-cyan-500/40 hover:bg-[#121929] transition-all shadow-lg flex items-center justify-center gap-2 text-cyan-300"
          >
            <Tv className="w-4 h-4 text-cyan-400" />
            <span>{isAr ? "محاكي الريموت والشاشة (PC)" : "Launch Remote Simulator (PC)"}</span>
          </a>
        </div>

        {/* ── DUAL BENTO CARDS (PREMIER ENGINES) ── */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 text-left" dir={isAr ? "rtl" : "ltr"}>
          
          {/* Card 1: TV Overlay Engine */}
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-purple-950/40 via-[#0A101D] to-[#060A14] border border-purple-500/30 hover:border-purple-500/60 shadow-2xl transition-all duration-300 flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                    <Tv className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400">
                      {isAr ? "محرك واجهة الشاشة" : "TV REMOTE OVERLAY ENGINE"}
                    </span>
                    <h3 className="text-xl font-bold text-white">QuazHome Android TV App</h3>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold shrink-0">
                  D-Pad 100%
                </span>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed mb-6">
                {isAr
                  ? "تطبيق أصلي بنظام WindowManager Overlay وخدمة Accessibility للعمل فوق أي فيلم، مع قائمة جانبية زجاجية تفتح بضغطة زرار الريموت المخصص."
                  : "Native Kotlin Android TV app with WindowManager Overlay & Accessibility service to intercept remote buttons globally and slide in without stopping video playback."}
              </p>

              <div className="space-y-2 mb-6 text-xs text-gray-300 font-medium">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <Zap className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>{isAr ? "التقاط أزرار الريموت في أي وقت بدون توقف الفيديو" : "Instant Remote Interception over any foreground app"}</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>{isAr ? "تصميم Frosted Glass بهوية QuazLink و Glow نيون" : "QuazLink Frosted Glass with Neon Cyan Glow focus"}</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <Sliders className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>{isAr ? "ميزة Remote Key Learning لتعيين أي زرار تريده" : "Remote Key Learning to map custom physical buttons"}</span>
                </div>
              </div>
            </div>

            {/* Downloader App URL Box */}
            <div className="bg-[#020617] border border-cyan-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 mt-4">
              <div className="min-w-0">
                <div className="text-[10px] font-mono text-gray-400 mb-1">
                  {isAr ? "رابط تطبيق Downloader على الشاشة:" : "Direct TV Downloader URL:"}
                </div>
                <div className="text-xs font-mono text-cyan-400 truncate direction-ltr text-left">
                  {downloadUrl}
                </div>
              </div>
              <button
                onClick={copyUrl}
                className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? (isAr ? "تم النسخ" : "Copied") : (isAr ? "نسخ" : "Copy")}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Home Assistant Local Gateway */}
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-cyan-950/40 via-[#0A101D] to-[#060A14] border border-cyan-500/30 hover:border-cyan-500/60 shadow-2xl transition-all duration-300 flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                      {isAr ? "بوابة الربط المحلي" : "HOME ASSISTANT LOCAL GATEWAY"}
                    </span>
                    <h3 className="text-xl font-bold text-white">Fastify Ultra-Low Latency Hub</h3>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold shrink-0">
                  1.2ms
                </span>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed mb-6">
                {isAr
                  ? "بوابة وسيطة مبنية بـ Fastify و TypeScript تعمل محلياً لعزل التوكن، وتوفير داتا سريعة ومفلترة لشاشة التلفزيون وتطبيقات React و Flutter."
                  : "High-throughput Fastify + TypeScript Gateway running locally to isolate tokens and provide sub-millisecond cached payloads for TV, React, and Flutter."}
              </p>

              <div className="space-y-2 mb-6 text-xs text-gray-300 font-medium">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{isAr ? "عزل وحماية الـ Long-Lived Access Token" : "Master Token Protection & Local Security Isolation"}</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{isAr ? "استجابة فائقة السرعة للأوامر (Lights & Climate)" : "Ultra-low latency device toggles & temperature dial"}</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{isAr ? "جاهزية كاملة لربط تطبيق React Web والموبايل بنفس الـ APIs" : "Unified Multi-Client APIs ready for React Web & Mobile"}</span>
                </div>
              </div>
            </div>

            {/* Health & Status Box */}
            <div className="bg-[#020617] border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 mt-4">
              <div>
                <div className="text-[10px] font-mono text-gray-400 mb-1">
                  {isAr ? "حالة السيرفر المحلي:" : "Local Gateway Status:"}
                </div>
                <div className="text-xs font-mono text-emerald-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>ONLINE • Listening on 0.0.0.0:3001</span>
                </div>
              </div>
              <a
                href="http://192.168.1.2:3001/api/health"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0"
              >
                <span>{isAr ? "فحص" : "Ping"}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
