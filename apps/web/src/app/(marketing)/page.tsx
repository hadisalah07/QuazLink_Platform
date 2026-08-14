"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Aurora } from "@/components/effects/Aurora";
import { GlassCard } from "@/components/effects/GlassCard";
import { Bot, Network, Zap } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const [videoEnded, setVideoEnded] = React.useState(false);

  return (
    <div className="relative w-full flex flex-col items-center">
      <Aurora />

      {/* Hero Section */}
      <section className="relative w-full h-screen flex items-center justify-center z-0">
        
        {/* Video Background */}
        <motion.div 
          className="absolute inset-0 z-0 flex items-center justify-center mix-blend-screen pointer-events-none"
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: videoEnded ? 0 : 1, scale: videoEnded ? 1.05 : 1 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        >
          <video
            src="/videos/hero-animation.mp4"
            autoPlay
            muted
            playsInline
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
            onEnded={() => setVideoEnded(true)}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              video.defaultPlaybackRate = 4.0;
              video.playbackRate = 4.0;
            }}
            className="w-full max-w-5xl object-contain opacity-90"
            style={{ 
              maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 70%)'
            }}
          />
        </motion.div>

        {/* Text Content - Fades in AFTER video fades out */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10 pointer-events-none"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: videoEnded ? 1 : 0, y: videoEnded ? 0 : 30 }}
          transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
        >
          <div className="flex flex-col items-center space-y-8 pointer-events-auto">
            <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[var(--color-quaz-cyan)] animate-pulse" />
              <span className="text-sm font-medium text-gray-300">Next-Gen Workflow Automation</span>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-500">
              QuazLink
            </h1>
            
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl">
              Orchestrate complex tasks across apps with intelligent agents. 
              Connect the nodes, automate the future.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <Link href="/accounts" className="px-8 py-4 bg-white text-black font-semibold rounded-full hover:bg-gray-200 transition-colors">
                Get Started
              </Link>
              <button className="px-8 py-4 bg-white/5 text-white font-semibold rounded-full border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-md">
                View Documentation
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 w-full max-w-7xl px-6 pb-32 grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard interactive={true} className="flex flex-col items-start text-left group">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-quaz-cyan)]/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Bot className="w-6 h-6 text-[var(--color-quaz-cyan)]" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-3">Intelligent Agents</h3>
          <p className="text-gray-400 leading-relaxed">
            AI-powered workers that understand your workflows and execute tasks with human-like precision.
          </p>
        </GlassCard>

        <GlassCard interactive={true} className="flex flex-col items-start text-left group">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-quaz-purple)]/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Network className="w-6 h-6 text-[var(--color-quaz-purple)]" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-3">Visual Builder</h3>
          <p className="text-gray-400 leading-relaxed">
            Connect nodes seamlessly. Drag and drop your automation logic onto the canvas.
          </p>
        </GlassCard>

        <GlassCard interactive={true} className="flex flex-col items-start text-left group">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-3">Lightning Fast</h3>
          <p className="text-gray-400 leading-relaxed">
            Built on top of a highly optimized queue system ensuring zero downtime.
          </p>
        </GlassCard>
      </section>
    </div>
  );
}
