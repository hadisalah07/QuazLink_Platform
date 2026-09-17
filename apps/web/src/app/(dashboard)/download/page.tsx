"use client";

import * as React from "react";
import {
  Download,
  Laptop,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Sparkles,
  Smartphone,
  ExternalLink,
  Lock,
  ArrowRight,
  HardDrive,
  Cpu,
  Key,
  Copy,
  Check
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { createDevicePairing, getDevices, type DeviceItem } from "@/lib/api";
import { PLATFORM_VERSION } from "@/lib/version";

export default function DownloadPage() {
  const [pairingToken, setPairingToken] = React.useState<string | null>(null);
  const [loadingPair, setLoadingPair] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleGenerateCode = async () => {
    setLoadingPair(true);
    try {
      const res = await createDevicePairing("My Desktop Machine");
      setPairingToken(res.pairingToken);
    } catch (e: any) {
      alert("Failed to create pairing: " + e.message);
    } finally {
      setLoadingPair(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col space-y-10 max-w-5xl mx-auto pb-16">
      {/* Hero Banner */}
      <div className="relative rounded-3xl p-8 md:p-12 border border-cyan-500/30 bg-gradient-to-b from-cyan-950/40 via-[var(--color-quaz-bg)] to-black/60 shadow-2xl overflow-hidden text-center space-y-6">
        {/* Glow Effects */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          OFFICIAL DESKTOP RUNNER • {PLATFORM_VERSION}
        </div>

        <div className="space-y-3 max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
            تحميل برنامج <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">QuazLink Runner</span> للكمبيوتر
          </h1>
          <p className="text-sm md:text-base text-gray-300 leading-relaxed">
            محرك الأتمتة المكتبي الخفيف والموثوق. يقوم بتنفيذ مهام رسائل وفواتير الواتساب، ونشر الحالات، ومنشورات فيسبوك وإنستغرام تلقائياً من جهازك وعنوان الـ IP المنزلي الحقيقي لمنع الحظر بنسبة 100%.
          </p>
        </div>

        {/* Primary Download CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <a
            href="https://github.com/hadisalah07/QuazLink_Platform/releases/download/v26.9.5/QuazLink-Runner-Setup.exe"
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold rounded-2xl text-base shadow-[0_0_35px_rgba(34,211,238,0.5)] hover:shadow-[0_0_45px_rgba(34,211,238,0.8)] transition-all flex items-center justify-center gap-3 cursor-pointer group"
          >
            <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
            <span>تحميل برنامج التثبيت (Windows .exe)</span>
          </a>

          <a
            href="quazlink://open"
            className="w-full sm:w-auto px-6 py-4 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Laptop className="w-4 h-4 text-cyan-400" />
            <span>فتح البرنامج المثبت بالفعل</span>
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400 pt-2 font-mono">
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            الحجم: ~76 ميجابايت
          </span>
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            الأنظمة: Windows 10 / 11 (64-bit)
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            تثبيت بنقرة واحدة (One-Click Setup)
          </span>
        </div>
      </div>

      {/* 3 Step Setup Guide */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">طريقة التثبيت والربط في دقيقة واحدة</h2>
          <p className="text-xs text-gray-400 mt-1">خطوات سريعة وسهلة لتشغيل الرانر وربطه بحسابك</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold font-mono text-lg flex items-center justify-center">
              1
            </div>
            <h3 className="text-sm font-bold text-white">حمّل وثبّت البرنامج</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              اضغط على زر التحميل، وافتح ملف <code className="text-cyan-300 font-mono">QuazLink-Runner-Setup.exe</code>. سيتم التثبيت فورياً وإنشاء اختصار رسمي على سطح المكتب.
            </p>
          </SpotlightCard>

          <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold font-mono text-lg flex items-center justify-center">
              2
            </div>
            <h3 className="text-sm font-bold text-white">اربط جهازك بحسابك</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              افتح البرنامج واضغط زر <strong>⚡ Open &amp; Auto-Pair</strong> في الموقع، أو ولّد رمز ربط من الأسفل والصقه في البرنامج لربطه بحسابك الشخصي.
            </p>
          </SpotlightCard>

          <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold font-mono text-lg flex items-center justify-center">
              3
            </div>
            <h3 className="text-sm font-bold text-white">جاهز لتنفيذ الأتمتة!</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              يظل الرانر يعمل بهدوء في الخلفية بجوار الساعة (System Tray). يستقبل فواتير الواتساب والمهام وينفذها بدقة وثبات تام.
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
              توليد رمز ربط فوري (Machine Pairing Code)
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              إذا قمت بتثبيت البرنامج وتريد ربط هذا الكمبيوتر بحسابك، اضغط لتوليد رمز الربط المباشر.
            </p>
          </div>

          <button
            onClick={handleGenerateCode}
            disabled={loadingPair}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl text-xs hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Key className="w-4 h-4 text-black" />
            <span>{loadingPair ? "جاري التوليد..." : "توليد كود الربط الآن"}</span>
          </button>
        </div>

        {pairingToken ? (
          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">رمز الربط المتاح:</span>
              <span className="px-3.5 py-1.5 bg-black/60 border border-white/20 rounded-lg text-white font-mono font-bold text-lg tracking-widest">
                {pairingToken}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(pairingToken)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "تم النسخ" : "نسخ الكود"}</span>
              </button>
              <a
                href={`quazlink://pair?token=${pairingToken}`}
                className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.4)]"
              >
                <Zap className="w-3.5 h-3.5 fill-black" />
                <span>⚡ ربط تلقائي فوري</span>
              </a>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 font-mono">
            اضغط على &quot;توليد كود الربط الآن&quot; لإنشاء رمز صالح لجهاز الكمبيوتر الخاص بك.
          </p>
        )}
      </SpotlightCard>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: ShieldCheck,
            title: "Zero-Ban Residential",
            desc: "أمان بنسبة 100% بدون حظر لأنه يستخدم جلستك الطبيعية واتصالك المنزلي الحقيقي."
          },
          {
            icon: Smartphone,
            title: "WhatsApp Invoicing",
            desc: "إرسال تلقائي ويدوي لرسائل الشكر والفواتير للعملاء عبر شات واتساب مباشرة."
          },
          {
            icon: Zap,
            title: "Instant WebSocket Link",
            desc: "استقبال المهام وتوجيهها في أجزاء من الثانية (0ms) فور إنشائها في الموقع."
          },
          {
            icon: Lock,
            title: "Local Sessions Encryption",
            desc: "بيانات تسجيل الدخول وجلسات المتصفح مشفرة بالكامل محلياً على جهازك فقط."
          }
        ].map((feat, i) => (
          <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
            <feat.icon className="w-6 h-6 text-cyan-400" />
            <h4 className="text-xs font-bold text-white">{feat.title}</h4>
            <p className="text-[11px] text-gray-400 leading-relaxed">{feat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
