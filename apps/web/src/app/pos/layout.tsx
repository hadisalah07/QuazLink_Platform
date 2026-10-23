"use client";

import * as React from "react";
import Link from "next/link";
import { 
  Store, 
  Download, 
  ExternalLink, 
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { StarField } from "@/components/effects/StarField";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lang, isAr } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div 
      dir={isAr ? "rtl" : "ltr"} 
      className="relative min-h-screen bg-[#070A12] text-white flex flex-col overflow-x-hidden selection:bg-emerald-500/30 selection:text-emerald-200"
    >
      {/* Background Ambience */}
      <StarField interactive={true} />
      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16, 185, 129, 0.25), transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(34, 211, 238, 0.15), transparent 60%)"
        }}
      />

      {/* Sleek, Enterprise-Grade POS Header */}
      <header className="sticky top-0 z-50 w-full bg-[#070A12]/85 backdrop-blur-xl border-b border-white/[0.08] shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo & Tag */}
          <Link href="/pos" className="flex items-center gap-3 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 p-0.5 shadow-md shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
              <div className="w-full h-full bg-[#0B101D] rounded-[10px] flex items-center justify-center">
                <Store className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-white via-gray-100 to-emerald-200 bg-clip-text text-transparent whitespace-nowrap">
                QuazLink POS
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                Retail OS
              </span>
            </div>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-medium text-gray-300 whitespace-nowrap">
            <a href="#features" className="hover:text-emerald-400 transition-colors">
              {isAr ? "المميزات" : "Features"}
            </a>
            <Link href="/pricing" className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 font-semibold text-emerald-300">
              <span>{isAr ? "الأسعار والباقات" : "Pricing"}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                {isAr ? "جديد" : "New"}
              </span>
            </Link>
            <Link href="/monitor" className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 font-medium text-gray-300 group">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{isAr ? "برج المراقبة" : "Live Monitor"}</span>
            </Link>
            <a href="#downloads" className="hover:text-emerald-400 transition-colors">
              {isAr ? "التحميل المباشر" : "Downloads"}
            </a>
            <a href="#activation" className="hover:text-emerald-400 transition-colors">
              {isAr ? "تفعيل الأجهزة" : "Activation"}
            </a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">
              {isAr ? "الأسئلة الشائعة" : "FAQ"}
            </a>
          </nav>

          {/* Action Hub */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Language Switcher */}
            <LanguageSwitcher variant="nav" />

            {/* Cloud Platform Hub */}
            <Link
              href="/"
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all whitespace-nowrap shrink-0"
              title={isAr ? "العودة للمنصة السحابية" : "Cloud Platform"}
            >
              <span>{isAr ? "المنصة السحابية" : "Cloud Platform"}</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>

            {/* Primary Action Button */}
            <a
              href="#downloads"
              className="flex items-center gap-2 text-xs sm:text-sm font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:from-emerald-400 hover:to-cyan-400 shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all transform hover:-translate-y-0.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span>{isAr ? "تحميل البرنامج" : "Download App"}</span>
            </a>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden bg-[#070A12]/98 backdrop-blur-2xl border-b border-white/10 px-4 py-4 space-y-3"
            >
              <nav className="flex flex-col space-y-2.5 text-sm font-medium">
                <a 
                  href="#features" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-300 hover:text-emerald-400 py-1 transition-colors"
                >
                  {isAr ? "المميزات" : "Features"}
                </a>
                <Link 
                  href="/pricing" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between text-emerald-300 font-semibold py-1 hover:text-emerald-200 transition-colors"
                >
                  <span>{isAr ? "الأسعار والباقات" : "Pricing"}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    {isAr ? "جديد" : "New"}
                  </span>
                </Link>
                <Link 
                  href="/monitor" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 text-gray-300 hover:text-emerald-400 py-1 transition-colors"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>{isAr ? "برج المراقبة الحية (Live Monitor)" : "Live POS Monitor"}</span>
                </Link>
                <a 
                  href="#downloads" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-300 hover:text-emerald-400 py-1 transition-colors"
                >
                  {isAr ? "التحميل المباشر" : "Downloads"}
                </a>
                <a 
                  href="#activation" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-300 hover:text-emerald-400 py-1 transition-colors"
                >
                  {isAr ? "تفعيل الأجهزة" : "Activation"}
                </a>
                <a 
                  href="#faq" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-300 hover:text-emerald-400 py-1 transition-colors"
                >
                  {isAr ? "الأسئلة الشائعة" : "FAQ"}
                </a>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white"
                  >
                    <span>{isAr ? "المنصة السحابية الرئيسية" : "Main Cloud Platform"}</span>
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                  </Link>
                  <span className="text-[10px] text-gray-500 font-mono">v1.3.7</span>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 w-full max-w-full">
        {children}
      </main>

      {/* Standalone POS Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#05080E] pt-12 pb-8 mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            
            <div className="space-y-4 md:col-span-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Store className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="font-bold text-base text-white">QuazLink POS & ERP</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                {isAr 
                  ? "نظام إدارة نقاط البيع والمخازن فائق السرعة، مصمم لخدمة متاجر التجزئة ومحلات الإلكترونيات والكمبيوتر والأنشطة التجارية في الشرق الأوسط."
                  : "High-speed offline point-of-sale and warehouse management system designed for retail stores, electronics, and commercial businesses."}
              </p>
              <div className="text-[11px] text-emerald-400/80 font-mono">
                Version 1.0.0 Standalone Desktop Edition
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">
                {isAr ? "روابط سريعة" : "Quick Links"}
              </h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><Link href="/pricing" className="text-emerald-400 font-medium hover:underline flex items-center gap-1"><span>{isAr ? "💎 قائمة الأسعار والباقات الرسمية" : "💎 Official Pricing & Plans"}</span></Link></li>
                <li><a href="#downloads" className="hover:text-emerald-400 transition-colors">{isAr ? "تحميل النسخة التنفيذية (.exe)" : "Download Installer (.exe)"}</a></li>
                <li><a href="#downloads" className="hover:text-emerald-400 transition-colors">{isAr ? "تحميل النسخة المحمولة (.zip)" : "Download Portable (.zip)"}</a></li>
                <li><a href="#activation" className="hover:text-emerald-400 transition-colors">{isAr ? "تفعيل ترخيص الجهاز الفوري" : "Instant License Activation"}</a></li>
                <li><a href="#features" className="hover:text-emerald-400 transition-colors">{isAr ? "المميزات والعتاد" : "Features & Hardware"}</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">
                {isAr ? "المعايير الهندسية" : "Engineering Highlights"}
              </h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li>🛡️ {isAr ? "تشغيل كامل بدون إنترنت (Offline-First)" : "100% Offline-First Architecture"}</li>
                <li>🖨️ {isAr ? "طباعة نقطية سريعة 1.8ms (Canvas-to-Raster)" : "1.8ms Direct Raster Thermal Printing"}</li>
                <li>🧾 {isAr ? "جاهزية منظومة الضرائب المصرية ETA" : "Egyptian Tax Authority (ETA) Compliant"}</li>
                <li>📱 {isAr ? "تكامل إرسال الفواتير عبر الواتساب" : "One-Click WhatsApp Digital Invoices"}</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">
                {isAr ? "منظومة كويزلينك" : "QuazLink Ecosystem"}
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                {isAr
                  ? "جزء من منصة QuazLink المتكاملة لأتمتة الأعمال ونمو التجارة."
                  : "Part of the integrated QuazLink platform for intelligent business automation."}
              </p>
              <Link 
                href="/dashboard" 
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                <span>{isAr ? "الدخول للوحة التحكم السحابية" : "Go to Cloud Console"}</span>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </Link>
            </div>

          </div>

          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
            <p>© {new Date().getFullYear()} QuazLink Retail Engine. {isAr ? "جميع الحقوق محفوظة." : "All rights reserved."}</p>
            <div className="flex items-center gap-4 text-gray-400">
              <span>{isAr ? "نظام تشغيل محلي معزول 100%" : "100% Isolated Local Runtime"}</span>
              <span>•</span>
              <span>{isAr ? "الأداء والاستقرار أولاً" : "Performance & Stability First"}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
