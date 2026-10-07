"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Aurora } from "@/components/effects/Aurora";
import { GlassCard } from "@/components/effects/GlassCard";
import { Bot, Network, Zap, Store, ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

export default function LandingPage() {
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
    <div className="relative w-full max-w-full flex flex-col items-center overflow-x-hidden">
      <Aurora />

      {/* Hero Section */}
      <section 
        className="relative w-full min-h-screen flex items-center justify-center z-0 overflow-hidden cursor-pointer"
        onClick={handleFinish}
      >
        
        {/* Cinematic Video Intro - Seamless Vignette Mask (Zero Rectangular Edges) */}
        {!videoEnded && (
          <motion.div 
            className="absolute inset-0 z-20 flex flex-col items-center justify-center mix-blend-screen pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
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
              transition={{ delay: 1.5, duration: 0.4 }}
              className="mt-6 pointer-events-auto px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-gray-300 hover:text-white transition-all flex items-center gap-2 shadow-lg"
            >
              <span>تخطي العرض • Skip Intro</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          </motion.div>
        )}

        {/* Text Content & Persistent Glowing Logo */}
        <motion.div
          className="relative flex flex-col items-center justify-center text-center px-6 py-20 z-10 pointer-events-none"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: videoEnded ? 1 : 0, y: videoEnded ? 0 : 20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="flex flex-col items-center space-y-6 pointer-events-auto">
            {/* Persistent Glowing QuazLink Logo */}
            <motion.div 
              className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center cursor-pointer group"
              onClick={handleReplay}
              title="انقر لإعادة تشغيل العرض السينمائي • Click to replay intro"
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

            <div className="inline-flex items-center space-x-2 bg-[#0B101D] border border-white/10 px-4 py-1.5 rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[var(--color-quaz-cyan)] animate-pulse" />
              <span className="text-sm font-medium text-gray-300">Next-Gen Workflow & Retail Automation</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                v{APP_VERSION}
              </span>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-500">
              QuazLink
            </h1>
            
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl">
              Orchestrate complex tasks across apps with intelligent agents & manage your physical retail business with high-speed offline POS.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <Link href="/accounts" className="px-8 py-4 bg-white text-black font-semibold rounded-full hover:bg-gray-200 transition-colors shadow-lg">
                Get Started
              </Link>
              <Link href="/pos" className="px-7 py-4 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-semibold rounded-full border border-emerald-500/40 hover:border-emerald-500/80 transition-colors shadow-lg flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-400" />
                <span>QuazLink POS Portal</span>
              </Link>
              <Link href="/download" className="px-8 py-4 bg-[#0B101D] text-white font-semibold rounded-full border border-white/10 hover:border-white/30 hover:bg-[#121929] transition-colors shadow-lg flex items-center gap-2">
                <Download className="w-4 h-4" />
                <span>Downloads</span>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* POS Spotlight Announcement Card */}
      <section className="relative z-10 w-full max-w-7xl px-6 mb-12">
        <Link href="/pos">
          <div className="p-8 rounded-3xl bg-gradient-to-r from-emerald-950/70 via-[#0C1222] to-cyan-950/70 border border-emerald-500/30 hover:border-emerald-500/70 transition-colors duration-200 shadow-xl group cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                <Store className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold">
                    جديد • NEW
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">
                    نظام الكاشير وإدارة المتاجر والمخازن — QuazLink POS & ERP
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-3xl">
                  يعمل 100% بدون إنترنت، طباعة فورية 1.8ms للطابعات الحرارية بدون تقطيع عربي، تتبع سيريالات وضمان الأجهزة، وجاهز لمنظومة الإيصال الإلكتروني المصري.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm shrink-0 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 group-hover:bg-emerald-500/20 transition-colors duration-200">
              <span>فتح بوابة الكاشير والتحميل</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-200" />
            </div>
          </div>
        </Link>
      </section>

      {/* Features Section */}
      <section className="relative z-10 w-full max-w-7xl px-6 pb-32 grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard interactive={true} className="flex flex-col items-start text-left group">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-quaz-cyan)]/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
            <Bot className="w-6 h-6 text-[var(--color-quaz-cyan)]" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-3">Intelligent Agents</h3>
          <p className="text-gray-400 leading-relaxed">
            AI-powered workers that understand your workflows and execute tasks with human-like precision.
          </p>
        </GlassCard>

        <GlassCard interactive={true} className="flex flex-col items-start text-left group">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-quaz-purple)]/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
            <Network className="w-6 h-6 text-[var(--color-quaz-purple)]" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-3">Visual Builder</h3>
          <p className="text-gray-400 leading-relaxed">
            Connect nodes seamlessly. Drag and drop your automation logic onto the canvas.
          </p>
        </GlassCard>

        <GlassCard interactive={true} className="flex flex-col items-start text-left group">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
            <Zap className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-3">Lightning Fast</h3>
          <p className="text-gray-400 leading-relaxed">
            Built on top of a highly optimized queue system ensuring zero downtime.
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
              v{APP_VERSION} (Production Live)
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/pos" className="hover:text-emerald-400 transition-colors">POS & ERP Portal</Link>
            <Link href="/download" className="hover:text-cyan-400 transition-colors">Downloads</Link>
            <Link href="/accounts" className="hover:text-white transition-colors">Console</Link>
            <a href="/api/version" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 transition-colors font-mono">
              /api/version
            </a>
          </div>
          <div className="text-gray-500 text-center sm:text-right">
            © {new Date().getFullYear()} QuazLink. All systems operational.
          </div>
        </div>
      </footer>
    </div>
  );
}
