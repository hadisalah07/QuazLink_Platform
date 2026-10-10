"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Aurora } from "@/components/effects/Aurora";
import { GlassCard } from "@/components/effects/GlassCard";
import { Bot, Network, Zap, Store, ArrowRight, Download } from "lucide-react";
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
            {/* POS Spotlight Announcement Card */}
            <section className="relative z-10 w-full max-w-6xl px-4 sm:px-6 mb-10">
              <Link href="/pos">
                <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-emerald-950/70 via-[#0C1222] to-cyan-950/70 border border-emerald-500/30 hover:border-emerald-500/70 transition-colors duration-200 shadow-xl group cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                      <Store className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-400" />
                    </div>
                    <div className={isAr ? "text-right" : "text-left"}>
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 mb-1.5">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold whitespace-nowrap shrink-0 border border-emerald-500/30">
                          {t.posCardTag}
                        </span>
                        <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                          {t.posCardTitle}
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-3xl">
                        {t.posCardDesc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 group-hover:bg-emerald-500/20 transition-colors duration-200 whitespace-nowrap">
                    <span>{t.posCardCta}</span>
                    <ArrowRight className={`w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-200 ${isAr ? "rotate-180 group-hover:-translate-x-1" : ""}`} />
                  </div>
                </div>
              </Link>
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
