"use client";

import * as React from "react";
import Link from "next/link";
import {
  Smartphone,
  Store,
  Laptop,
  Plus,
  QrCode,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  X,
  Copy,
  Check,
  RefreshCw,
  Globe,
  Activity,
  Receipt,
  Printer,
  ShieldCheck,
  Send,
  Zap,
  Layers,
  Building2,
  Trash2,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { getPosBranches, type PosBranchItem } from "@/lib/api";

interface TerminalItem {
  id: string;
  name: string;
  nameAr: string;
  type: "mobile" | "branch" | "workstation";
  branchCode: string;
  branchName: string;
  cashierName: string;
  status: "active" | "standby" | "offline";
  lastActive: string;
  targets: string[];
  launchUrl: string;
}

export default function PosTerminalsConsolePage() {
  const [branches, setBranches] = React.useState<PosBranchItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<string>("all");
  const [isQrModalOpen, setIsQrModalOpen] = React.useState(false);
  const [isAddTerminalModalOpen, setIsAddTerminalModalOpen] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [mobilePosUrl, setMobilePosUrl] = React.useState<string>("/pos/mobile");

  // Determine full mobile URL on client
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const full = `${window.location.origin}/pos/mobile`;
      setMobilePosUrl(full);
    }

    getPosBranches()
      .then((data) => {
        if (data.branches && data.branches.length > 0) {
          setBranches(data.branches);
        } else {
          setBranches([
            { id: "b-main", branchCode: "main", name: "الفرع الرئيسي (HQ)", city: "القاهرة", isActive: true, createdAt: new Date().toISOString() },
            { id: "b-nasr", branchCode: "branch_nasr", name: "فرع مدينة نصر", city: "القاهرة", isActive: true, createdAt: new Date().toISOString() },
          ]);
        }
      })
      .catch(() => {
        setBranches([
          { id: "b-main", branchCode: "main", name: "الفرع الرئيسي (HQ)", city: "القاهرة", isActive: true, createdAt: new Date().toISOString() },
          { id: "b-nasr", branchCode: "branch_nasr", name: "فرع مدينة نصر", city: "القاهرة", isActive: true, createdAt: new Date().toISOString() },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const copyUrlToClipboard = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(mobilePosUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Terminals catalogue
  const terminals: TerminalItem[] = React.useMemo(() => {
    const list: TerminalItem[] = [
      {
        id: "term-mob-pwa",
        name: "Mobile Cloud Cashier (PWA)",
        nameAr: "كاشير الموبايل السحابي الفوري",
        type: "mobile",
        branchCode: "main",
        branchName: "الفرع الرئيسي (HQ)",
        cashierName: "كاشير الموبايل (Web PWA)",
        status: "active",
        lastActive: "Ready for live checkout & billing",
        targets: [
          "🟢 Camera Barcode Scanner (سكانر الكاميرا)",
          "💬 Instant WhatsApp Receipt (إيصال واتساب)",
          "⚡ Real-time Cloud Monitor Sync (مزامنة المراقبة)",
        ],
        launchUrl: "/pos/mobile",
      },
    ];

    branches.forEach((b) => {
      list.push({
        id: `term-branch-${b.branchCode}`,
        name: `${b.name} Cashier`,
        nameAr: `كاشير ${b.name}`,
        type: "branch",
        branchCode: b.branchCode,
        branchName: b.name,
        cashierName: `محطة فرع ${b.name}`,
        status: "active",
        lastActive: "Connected to live stream",
        targets: [
          `🏢 Branch Code: ${b.branchCode}`,
          `📍 City: ${b.city || "القاهرة"}`,
          "📊 Multi-Branch Enterprise Sync",
        ],
        launchUrl: `/pos/mobile?branch=${encodeURIComponent(b.branchCode)}`,
      });
    });

    list.push({
      id: "term-desktop-win32",
      name: "Desktop Workstation Terminal",
      nameAr: "كاشير الكمبيوتر المكتبي (Windows Offline-First)",
      type: "workstation",
      branchCode: "main",
      branchName: "الفرع الرئيسي",
      cashierName: "Workstation PC",
      status: "active",
      lastActive: "Connected via Local Runner",
      targets: [
        "🖨️ 80mm ESC-POS Thermal Printer",
        "⚡ Local SQLite + Cloud Sync",
      ],
      launchUrl: "/pos",
    });

    return list;
  }, [branches]);

  const filteredTerminals = React.useMemo(() => {
    if (filter === "all") return terminals;
    return terminals.filter((t) => t.type === filter);
  }, [terminals, filter]);

  return (
    <div className="flex flex-col space-y-8 max-w-7xl mx-auto">
      {/* 1. Header (Matching Accounts & Console Design) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Smartphone className="w-8 h-8 text-[var(--color-quaz-cyan)]" />
            POS &amp; Mobile Cashier Terminals
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            إدارة نقاط البيع، فتح كاشير الموبايل، ومسح الباركود لإصدار الفواتير السحابية مباشرة.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Scan QR Code Button */}
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-400 font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer hover:border-emerald-500/40"
            title="مسح رمز الاستجابة السريعة بالهاتف"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>📱 QR Code للموبايل</span>
          </button>

          {/* Direct Launch Web POS Button */}
          <Link
            href="/pos/mobile"
            target="_blank"
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-black stroke-[3]" />
            <span>+ فتح كاشير الموبايل (Open Web POS)</span>
          </Link>
        </div>
      </div>

      {/* 2. Filter Tabs (Identical to Accounts Page Tabs) */}
      <div className="flex items-center space-x-2 border-b border-white/10 pb-3 overflow-x-auto">
        {[
          { id: "all", label: `All Terminals (${terminals.length})` },
          { id: "mobile", label: "Mobile PWA Cashier" },
          { id: "branch", label: "Branch Stations" },
          { id: "workstation", label: "Workstations" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              filter === tab.id
                ? "bg-white/10 text-white border border-white/10 shadow-sm"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Terminals Cards Grid (Matching SpotlightCard layout in Accounts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTerminals.map((item) => {
          const isMobile = item.type === "mobile";
          const isBranch = item.type === "branch";

          const cardIconBg = isMobile
            ? "text-emerald-400 bg-emerald-600/20 border-emerald-500/30"
            : isBranch
            ? "text-cyan-400 bg-cyan-600/20 border-cyan-500/30"
            : "text-blue-400 bg-blue-600/20 border-blue-500/30";

          return (
            <SpotlightCard
              key={item.id}
              className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] hover:border-cyan-500/30 transition-all flex flex-col justify-between space-y-6 group"
            >
              <div>
                {/* Card Header: Icon + Status */}
                <div className="flex justify-between items-start mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center group-hover:scale-105 transition-transform ${cardIconBg}`}
                  >
                    {isMobile ? (
                      <Smartphone className="w-6 h-6" />
                    ) : isBranch ? (
                      <Store className="w-6 h-6" />
                    ) : (
                      <Laptop className="w-6 h-6" />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 text-xs font-semibold rounded-full border flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="capitalize">{item.status}</span>
                    </span>
                  </div>
                </div>

                {/* Card Title & Subtitle */}
                <div>
                  <h3 className="font-bold text-lg text-white capitalize flex items-center gap-2">
                    {item.name}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 font-medium">
                    {item.nameAr}
                  </p>
                  <p className="text-xs text-gray-400 mt-1.5 font-mono">
                    ID: {item.id}
                  </p>
                  <p className="text-xs text-emerald-400/90 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{item.lastActive}</span>
                  </p>
                </div>

                {/* Targets / Capabilities Box */}
                <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase text-gray-400 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-cyan-400" />
                    Connected Capabilities ({item.targets.length})
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {item.targets.map((tgt, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-md bg-black/40 text-[11px] text-gray-200 border border-white/5 truncate"
                      >
                        {tgt}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <Link
                  href={item.launchUrl}
                  target="_blank"
                  className="flex-1 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isMobile ? "افتح الكاشير الآن" : "دخول نقطة البيع"}</span>
                </Link>

                {isMobile && (
                  <button
                    onClick={() => setIsQrModalOpen(true)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
                    title="عرض كود QR للموبايل"
                  >
                    <QrCode className="w-4 h-4 text-emerald-400" />
                  </button>
                )}

                <Link
                  href={`/monitor?branch=${encodeURIComponent(item.branchCode)}`}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
                  title="مراقبة مبيعات هذا الفرع"
                >
                  <Activity className="w-4 h-4 text-cyan-400" />
                </Link>
              </div>
            </SpotlightCard>
          );
        })}
      </div>

      {/* 4. QR CODE MODAL FOR MOBILE SCANNING */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm flex flex-col bg-[var(--color-quaz-bg)] border border-emerald-500/30 rounded-3xl overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  كاشير الموبايل السريع (PWA QR)
                </h3>
              </div>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 text-center space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                وجّه كاميرا هاتفك المحمول (iPhone أو Android) نحو الكود لفتح الكاشير وإصدار الفواتير فوراً:
              </p>

              {/* High-Resolution QR Code */}
              <div className="w-60 h-60 mx-auto p-3 rounded-2xl bg-white flex items-center justify-center shadow-xl border border-white/20">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(
                    mobilePosUrl
                  )}`}
                  alt="QuazLink Mobile POS QR Code"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Direct Link & Copy Option */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/10 text-xs">
                  <span className="flex-1 truncate text-left text-slate-400 font-mono text-[11px]">
                    {mobilePosUrl}
                  </span>
                  <button
                    onClick={copyUrlToClipboard}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[11px] flex items-center gap-1 transition-colors shrink-0"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? "تم النسخ" : "نسخ الرابط"}</span>
                  </button>
                </div>

                <Link
                  href="/pos/mobile"
                  target="_blank"
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-cyan-400 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح في نافذة جديدة الآن</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
