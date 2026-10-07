"use client";

import * as React from "react";
import Link from "next/link";
import { 
  Store, 
  Download, 
  ExternalLink, 
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { StarField } from "@/components/effects/StarField";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lang, isAr } = useLanguage();

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

      {/* Standalone POS Header */}
      <header className="sticky top-0 z-50 w-full bg-[#070A12]/95 border-b border-emerald-500/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo & Tag */}
          <Link href="/pos" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
              <div className="w-full h-full bg-[#0B101D] rounded-[14px] flex items-center justify-center">
                <Store className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className={`flex flex-col ${isAr ? "text-right" : "text-left"}`}>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-gray-100 to-emerald-200 bg-clip-text text-transparent">
                  QuazLink POS
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Retail OS
                </span>
              </div>
              <span className="text-xs text-gray-400 font-medium">
                {isAr ? "نظام الكاشير وإدارة المتاجر المستقل" : "Standalone Retail POS & Store Management"}
              </span>
            </div>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-gray-300">
            <a href="#features" className="hover:text-emerald-400 transition-colors">
              {isAr ? "المميزات" : "Features"}
            </a>
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

          {/* Action Hub & Language Toggle */}
          <div className="flex items-center gap-3">
            {/* Language Switcher Button */}
            <LanguageSwitcher variant="nav" />

            <Link
              href="/"
              className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              <span>{isAr ? "المنصة الرئيسية" : "Cloud Platform"}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <a
              href="#downloads"
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5"
            >
              <Download className="w-4 h-4" />
              <span>{isAr ? "تحميل البرنامج" : "Download App"}</span>
            </a>
          </div>

        </div>
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
