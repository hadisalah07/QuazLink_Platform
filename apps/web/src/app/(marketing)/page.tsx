"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Aurora } from "@/components/effects/Aurora";
import { GlassCard } from "@/components/effects/GlassCard";
import {
  Bot,
  Network,
  Zap,
  Store,
  ArrowRight,
  Download,
  Printer,
  QrCode,
  ShieldCheck,
  Building2,
  Activity,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { APP_VERSION } from "@/lib/version";
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export default function LandingPage() {
  const { lang, isAr } = useLanguage();
  const t = translations[lang];

  const [videoEnded, setVideoEnded] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const handleFinish = React.useCallback(() => {
    setVideoEnded(true);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  const handleReplay = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setVideoEnded(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  React.useEffect(() => {
    // Skip intro on wheel scroll or escape key
    const handleScroll = (e: WheelEvent) => {
      if (e.deltaY > 20 && !videoEnded) {
        handleFinish();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if ((e.key === "Escape" || e.key === " " || e.key === "Enter") && !videoEnded) {
        handleFinish();
      }
    };

    window.addEventListener("wheel", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKey);

    // Fallback: allow full 8.5s cinematic playthrough
    const safetyTimer = setTimeout(() => {
      handleFinish();
    }, 8500);

    return () => {
      window.removeEventListener("wheel", handleScroll);
      window.removeEventListener("keydown", handleKey);
      clearTimeout(safetyTimer);
    };
  }, [handleFinish, videoEnded]);

  return (
    <div className={`relative w-full max-w-full flex flex-col items-center overflow-x-hidden ${!videoEnded ? "h-screen overflow-hidden" : ""}`}>
      <Aurora />

      {/* Floating Language Switcher Button (Top Corner) */}
      <LanguageSwitcher variant="floating" />

      {/* Hero Section */}
      <section 
        className={`relative w-full ${videoEnded ? "min-h-[82vh] sm:min-h-[85vh]" : "min-h-screen h-screen"} flex items-center justify-center z-0 overflow-hidden cursor-pointer transition-[min-height] duration-700`}
        onClick={!videoEnded ? handleFinish : undefined}
      >
        
        {/* Cinematic Video Intro - Seamless Vignette Mask (Zero Rectangular Edges) */}
        <AnimatePresence>
          {!videoEnded && (
            <motion.div 
              key="hero-video-intro"
              className="absolute inset-0 z-20 flex flex-col items-center justify-center mix-blend-screen pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div 
                className="w-full max-w-5xl flex items-center justify-center overflow-hidden"
                style={{
                  maskImage: "radial-gradient(ellipse 65% 60% at 50% 50%, black 30%, transparent 82%)",
                  WebkitMaskImage: "radial-gradient(ellipse 65% 60% at 50% 50%, black 30%, transparent 82%)",
                }}
              >
                <video
                  ref={videoRef}
                  src="/videos/hero-animation.mp4"
                  autoPlay
                  muted
                  playsInline
                  preload="auto"
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                  onEnded={handleFinish}
                  onError={handleFinish}
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    video.defaultPlaybackRate = 1.1;
                    video.playbackRate = 1.1;
                  }}
                  className="w-full object-contain filter contrast-105 brightness-105"
                />
              </div>

              {/* Subtle Skip Prompt */}
              <motion.button
                type="button"
                onClick={handleFinish}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.4 }}
                className="mt-6 pointer-events-auto px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-gray-300 hover:text-white transition-all flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <span>{t.skipIntro}</span>
                <ArrowRight className={`w-3.5 h-3.5 ${isAr ? "rotate-180" : ""}`} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text Content & Persistent Glowing Logo */}
        {videoEnded && (
          <motion.div
            key="hero-text-content"
            className="relative flex flex-col items-center justify-center text-center px-4 sm:px-6 py-12 md:py-16 z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="flex flex-col items-center space-y-4 sm:space-y-5 pointer-events-auto max-w-4xl mx-auto">
              {/* Persistent Glowing QuazLink Logo */}
              <motion.div 
                className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center cursor-pointer group"
                onClick={handleReplay}
                title={t.replayTooltip}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-emerald-500/15 blur-2xl opacity-75 group-hover:opacity-100 transition-opacity" />
                <img 
                  src="/logo.png" 
                  alt="QuazLink Logo" 
                  className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_25px_rgba(34,211,238,0.45)]"
                />
              </motion.div>

              <div className="inline-flex items-center space-x-2 bg-[#0B101D] border border-white/10 px-3.5 py-1.5 rounded-full shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[var(--color-quaz-cyan)] animate-pulse" />
                <span className="text-xs sm:text-sm font-medium text-gray-300">{t.heroBadge}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  v{APP_VERSION}
                </span>
              </div>
              
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-500">
                QuazLink
              </h1>
              
              <p className="text-sm sm:text-base md:text-lg text-gray-400 max-w-xl">
                {t.heroSubtitle}
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 pt-1">
                <Link href="/accounts" className="px-6 py-3 sm:px-7 sm:py-3.5 bg-white text-black font-semibold text-sm sm:text-base rounded-full hover:bg-gray-200 transition-colors shadow-lg">
                  {t.getStarted}
                </Link>
                <Link href="/pos" className="px-6 py-3 sm:px-7 sm:py-3.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-semibold text-sm sm:text-base rounded-full border border-emerald-500/40 hover:border-emerald-500/80 transition-colors shadow-lg flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-400" />
                  <span>{t.posPortal}</span>
                </Link>
                <Link href="/download" className="px-6 py-3 sm:px-7 sm:py-3.5 bg-[#0B101D] text-white font-semibold text-sm sm:text-base rounded-full border border-white/10 hover:border-white/30 hover:bg-[#121929] transition-colors shadow-lg flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>{t.downloads}</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </section>

      {/* Below-Hero Content (Only revealed after intro finishes) */}
      <AnimatePresence>
        {videoEnded && (
          <motion.div
            key="below-hero-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-full flex flex-col items-center"
          >
            {/* ── DUAL PREMIER ENGINES (THE 2 CARDS) ───────────────────── */}
            <section className="relative z-10 w-full max-w-6xl px-4 sm:px-6 mb-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* 🏪 BENTO CARD 1: IN-STORE RETAIL POS & ERP */}
              <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-emerald-950/60 via-[#0A101D] to-[#060A14] border border-emerald-500/30 hover:border-emerald-500/60 shadow-2xl transition-all duration-300 group flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div>
                  {/* Card Header & Badge */}
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                        <Store className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                          {t.bentoTagRetail || "IN-STORE RETAIL ENGINE"}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-bold text-white">
                          {t.bentoTitleRetail || "QuazLink POS & Warehouse ERP"}
                        </h3>
                      </div>
                    </div>
                    <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold shrink-0">
                      v1.4.0 Live
                    </span>
                  </div>

                  <p className="text-sm text-gray-300 leading-relaxed mb-6">
                    {t.bentoDescRetail || "Engineered for supermarkets, retail chains, and electronics stores. 100% offline-capable, 1.8ms Arabic thermal printing, and compliant with Egyptian ETA mandates."}
                  </p>

                  {/* Feature Highlights Tags */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6 text-xs text-gray-300 font-medium">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <Printer className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>1.8ms Canvas Thermal Printing</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>ETA e-Receipt TLV Base64 QR</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Serial &amp; IMEI Warranty Tracking</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Multi-Branch Inventory Sync</span>
                    </div>
                  </div>

                  {/* Stylized Mini Live Transaction Preview Mockup */}
                  <div className="rounded-2xl p-4 bg-black/50 border border-emerald-500/20 backdrop-blur-sm mb-6 font-mono text-xs text-gray-300">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                      <span className="text-emerald-400 font-bold">{t.bentoLiveMockupReceipt || "Transaction #INV-CAI-POS-01"}</span>
                      <span className="text-[10px] text-gray-400">Offline SQLite Buffer</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-400 text-[11px] mb-1">
                      <span>Subtotal (3 items)</span>
                      <span>1,271.93 EGP</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-400 text-[11px] mb-2">
                      <span>VAT (14% ETA separated)</span>
                      <span>178.07 EGP</span>
                    </div>
                    <div className="flex items-center justify-between font-bold text-sm text-white pt-2 border-t border-white/10">
                      <span>Total Invoice</span>
                      <span className="text-emerald-400">{t.bentoLiveMockupTotal || "EGP 1,450.00"}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Link */}
                <Link
                  href="/pos"
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 font-bold text-sm transition-colors group/btn"
                >
                  <span>Explore Retail POS Portal &amp; Downloads</span>
                  <ArrowRight className={`w-4 h-4 transition-transform group-hover/btn:translate-x-1 ${isAr ? "rotate-180 group-hover/btn:-translate-x-1" : ""}`} />
                </Link>
              </div>

              {/* 🤖 BENTO CARD 2: AUTONOMOUS AUTOMATION RUNNER */}
              <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-cyan-950/60 via-[#0A101D] to-[#060A14] border border-cyan-500/30 hover:border-cyan-500/60 shadow-2xl transition-all duration-300 group flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                <div>
                  {/* Card Header & Badge */}
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                        <Bot className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                          {t.bentoTagAutomation || "AUTONOMOUS AUTOMATION ENGINE"}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-bold text-white">
                          {t.bentoTitleAutomation || "Desktop Automation Runner"}
                        </h3>
                      </div>
                    </div>
                    <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold shrink-0">
                      v26.10.16 Live
                    </span>
                  </div>

                  <p className="text-sm text-gray-300 leading-relaxed mb-6">
                    {t.bentoDescAutomation || "Turn local PCs into zero-ban residential automation nodes. Auto-launch with Windows startup, silent background execution, anti-sleep keep-awake, and multi-channel scheduling."}
                  </p>

                  {/* Feature Highlights Tags */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6 text-xs text-gray-300 font-medium">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Windows Boot Auto-Launch</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Keep-System-Awake Daemon</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Zero-Trust TLS Cloud Gateway</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Stealth Multi-Account Publishing</span>
                    </div>
                  </div>

                  {/* Stylized Mini Live Runner Terminal Mockup */}
                  <div className="rounded-2xl p-4 bg-[#04060A]/90 border border-cyan-500/20 backdrop-blur-sm mb-6 font-mono text-xs text-gray-300">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 font-bold text-xs">{t.bentoLiveMockupRunnerStatus || "ONLINE & READY"}</span>
                      </div>
                      <span className="text-[10px] text-cyan-400 font-bold">ZERO-BAN RESIDENTIAL NODE</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-400 text-[11px] mb-1">
                      <span>Node Identity</span>
                      <span className="text-white">{t.bentoLiveMockupRunnerTitle || "Local Residential Node"}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-400 text-[11px]">
                      <span>Cloud Gateway</span>
                      <span className="text-cyan-300 font-mono text-[10px]">wss://api.quazlink.site</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Link */}
                <Link
                  href="/download"
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 font-bold text-sm transition-colors group/btn"
                >
                  <span>Download Desktop Runner v26.10.16</span>
                  <ArrowRight className={`w-4 h-4 transition-transform group-hover/btn:translate-x-1 ${isAr ? "rotate-180 group-hover/btn:-translate-x-1" : ""}`} />
                </Link>
              </div>

            </section>

            {/* Features Section */}
            <section className="relative z-10 w-full max-w-6xl px-4 sm:px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-5">
              <GlassCard interactive={true} className={`flex flex-col items-start group ${isAr ? "text-right" : "text-left"}`}>
                <div className="w-12 h-12 rounded-xl bg-[var(--color-quaz-cyan)]/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                  <Bot className="w-6 h-6 text-[var(--color-quaz-cyan)]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{t.feat1Title}</h3>
                <p className="text-gray-400 leading-relaxed">
                  {t.feat1Desc}
                </p>
              </GlassCard>

              <GlassCard interactive={true} className={`flex flex-col items-start group ${isAr ? "text-right" : "text-left"}`}>
                <div className="w-12 h-12 rounded-xl bg-[var(--color-quaz-purple)]/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                  <Network className="w-6 h-6 text-[var(--color-quaz-purple)]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{t.feat2Title}</h3>
                <p className="text-gray-400 leading-relaxed">
                  {t.feat2Desc}
                </p>
              </GlassCard>

              <GlassCard interactive={true} className={`flex flex-col items-start group ${isAr ? "text-right" : "text-left"}`}>
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{t.feat3Title}</h3>
                <p className="text-gray-400 leading-relaxed">
                  {t.feat3Desc}
                </p>
              </GlassCard>
            </section>

            {/* Footer Section with Live Production Indicator */}
            <footer className="relative z-10 w-full border-t border-white/10 bg-[#060A14] py-8 px-6">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-white">QuazLink Platform</span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 font-mono text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    v{APP_VERSION} ({t.productionLive})
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <Link href="/pos" className="hover:text-emerald-400 transition-colors">{t.posPortal}</Link>
                  <Link href="/download" className="hover:text-cyan-400 transition-colors">{t.downloads}</Link>
                  <Link href="/contact" className="hover:text-amber-400 transition-colors">{t.contactTitle || (isAr ? "تواصل معنا والدعم" : "Contact & Support")}</Link>
                  <Link href="/accounts" className="hover:text-white transition-colors">{t.console}</Link>
                  <a href="/api/version" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 transition-colors font-mono">
                    /api/version
                  </a>
                </div>
                <div className={`text-gray-500 ${isAr ? "text-center sm:text-left" : "text-center sm:text-right"}`}>
                  © {new Date().getFullYear()} QuazLink. {t.allSystemsOperational}
                </div>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
