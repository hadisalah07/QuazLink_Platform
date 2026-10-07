"use client";

import * as React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "floating" | "nav" | "minimal";
}

export function LanguageSwitcher({ className = "", variant = "floating" }: LanguageSwitcherProps) {
  const { lang, isAr, toggleLang } = useLanguage();

  if (variant === "nav") {
    return (
      <button
        onClick={toggleLang}
        type="button"
        title={isAr ? "Switch to English" : "التبديل إلى العربية"}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer ${
          isAr
            ? "bg-purple-950/60 border-purple-500/40 text-purple-200 hover:bg-purple-900/60 hover:border-purple-400"
            : "bg-cyan-950/60 border-cyan-500/40 text-cyan-200 hover:bg-cyan-900/60 hover:border-cyan-400"
        } ${className}`}
      >
        <Globe className="w-3.5 h-3.5 text-current animate-pulse" />
        <span className="font-mono tracking-wider font-bold">
          {isAr ? "EN • English" : "AR • العربية"}
        </span>
      </button>
    );
  }

  if (variant === "minimal") {
    return (
      <button
        onClick={toggleLang}
        type="button"
        title={isAr ? "Switch to English" : "التبديل إلى العربية"}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer ${className}`}
      >
        <Globe className="w-3 h-3 text-cyan-400" />
        <span className="font-mono">{isAr ? "EN" : "عربي"}</span>
      </button>
    );
  }

  // Floating variant - fixed at the top corner of the page
  return (
    <div className={`fixed top-5 ${isAr ? "left-6" : "right-6"} z-50 ${className}`}>
      <button
        onClick={toggleLang}
        type="button"
        title={isAr ? "Switch to English" : "التبديل إلى العربية"}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0B101D]/90 hover:bg-[#141B2D] border border-white/15 hover:border-cyan-500/50 shadow-xl shadow-black/40 text-xs font-bold text-gray-200 hover:text-white transition-all transform hover:scale-105 cursor-pointer backdrop-none"
      >
        <Globe className="w-3.5 h-3.5 text-cyan-400" />
        <span className="font-mono font-semibold">
          {isAr ? "English" : "العربية"}
        </span>
        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
          {lang.toUpperCase()}
        </span>
      </button>
    </div>
  );
}
