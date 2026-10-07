"use client";

import * as React from "react";
import { APP_VERSION, BUILD_ID, DEPLOY_ENV, RELEASE_DATE } from "@/lib/version";
import { CheckCircle2, RefreshCw, Server, ShieldCheck, X } from "lucide-react";

export function LiveReleaseBadge() {
  const [open, setOpen] = React.useState(false);
  const [reloading, setReloading] = React.useState(false);

  const handleHardReload = () => {
    setReloading(true);
    // Bust browser cache by reloading with cache-clearing URL parameter
    const url = new URL(window.location.href);
    url.searchParams.set("_v", Date.now().toString());
    window.location.replace(url.toString());
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 font-sans select-none print:hidden">
      {/* Floating Pill */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#0A0F1D] hover:bg-[#11182A] border border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_4px_20px_rgba(16,185,129,0.15)] transition-colors duration-200 text-xs text-gray-200 group cursor-pointer"
        title="انقر لعرض تفاصيل الإصدار وتحديث الصفحة"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="font-mono font-semibold tracking-wide text-emerald-400">
          v{APP_VERSION}
        </span>
        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          LIVE
        </span>
      </button>

      {/* Expanded Details Card */}
      {open && (
        <div className="absolute bottom-11 left-0 w-80 p-4 rounded-2xl bg-[#090D1A] border border-white/10 shadow-2xl text-white text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-gray-100">حالة النشر والإنتاج</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 font-mono text-[11px]">
            <div className="flex items-center justify-between text-gray-400">
              <span>الإصدار (Version):</span>
              <span className="text-emerald-400 font-bold">v{APP_VERSION}</span>
            </div>
            <div className="flex items-center justify-between text-gray-400">
              <span>رقم البناء (Build):</span>
              <span className="text-gray-200">{BUILD_ID}</span>
            </div>
            <div className="flex items-center justify-between text-gray-400">
              <span>تاريخ التحديث:</span>
              <span className="text-gray-200">{RELEASE_DATE}</span>
            </div>
            <div className="flex items-center justify-between text-gray-400">
              <span>البيئة (Environment):</span>
              <span className="text-cyan-400 font-bold capitalize">{DEPLOY_ENV}</span>
            </div>
            <div className="flex items-center justify-between text-gray-400">
              <span>السيرفر المستضيف:</span>
              <span className="text-gray-300 flex items-center gap-1">
                <Server className="w-3 h-3 text-cyan-400" />
                Coolify Node
              </span>
            </div>
            <div className="flex items-center justify-between text-gray-400">
              <span>الحالة (Status):</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                متصل ونشط 100%
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-2">
            <button
              onClick={handleHardReload}
              disabled={reloading}
              className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-sans font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reloading ? "animate-spin" : ""}`} />
              <span>{reloading ? "جاري التحديث..." : "تحديث الكاش (Hard Refresh)"}</span>
            </button>
            <p className="text-[10px] text-gray-500 text-center font-sans">
              يضمن تحميل أحدث ملفات JavaScript والـ UI فوراً.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
