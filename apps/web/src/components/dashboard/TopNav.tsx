"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Laptop, Download } from "lucide-react";
import { getDevices } from "@/lib/api";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";
import { useLanguage } from "@/context/LanguageContext";

export function TopNav() {
  const { isAr } = useLanguage();
  const [isOnline, setIsOnline] = React.useState(false);
  const [activeDeviceName, setActiveDeviceName] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function check() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const data = await getDevices();
        setIsOnline(data.isOnline);
        const onlineDev = data.devices.find((d) => d.status === "online");
        setActiveDeviceName(onlineDev ? onlineDev.name : null);
      } catch {}
    }

    check();
    const interval = setInterval(check, 20000);

    const onVisibilityChange = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <header className="h-16 border-b border-white/10 bg-[var(--color-quaz-bg)] flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center flex-1">
        <div className="relative w-full max-w-md hidden md:flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-gray-500" />
          <input 
            type="text" 
            placeholder={isAr ? "بحث في سير العمل، الحسابات..." : "Search workflows, accounts..."}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--color-quaz-cyan)] transition-shadow"
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        {/* Language Switcher */}
        <LanguageSwitcher variant="nav" />

        {/* Runner Status Indicator */}
        <Link
          href="/settings"
          title={isAr ? "حالة اتصال برنامج الرانر (اضغط للإدارة)" : "Desktop Runner Connection Status (Click to manage)"}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
            isOnline
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
              : "bg-gray-500/10 border-gray-500/20 text-gray-400 hover:bg-white/5"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
          <Laptop className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {isOnline
              ? activeDeviceName
                ? isAr ? `${activeDeviceName} (متصل)` : `${activeDeviceName} (Active)`
                : isAr ? "الرانر (متصل)" : "Runner (Online)"
              : isAr ? "الرانر (غير متصل)" : "Runner (Offline)"}
          </span>
        </Link>

        {/* Quick Download Button */}
        <Link
          href="/download"
          title={isAr ? "تحميل برنامج QuazLink للكمبيوتر لنظام Windows (.exe)" : "Download QuazLink Runner App for Windows (.exe)"}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-xs font-semibold transition-all shadow-[0_0_15px_rgba(34,211,238,0.15)] cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{isAr ? "تحميل البرنامج" : "Download App"}</span>
        </Link>

        {/* Live Notifications (Admins & Users) */}
        <NotificationBell />
      </div>
    </header>
  );
}
