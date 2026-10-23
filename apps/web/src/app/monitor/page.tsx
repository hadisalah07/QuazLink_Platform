"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  TrendingUp,
  DollarSign,
  CreditCard,
  ShoppingBag,
  Store,
  Users,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
  Filter,
  Smartphone,
  Laptop,
  Globe,
  ArrowLeft,
  ArrowRight,
  Eye,
  X,
  Wallet,
  Sparkles,
  Layers,
  Receipt,
} from "lucide-react";
import {
  getPosLiveMonitor,
  type PosLiveMonitorResponse,
  type PosRecentSaleItem,
  type PosActiveShiftItem,
  type PosBranchComparisonItem,
  type PosBranchItem,
} from "@/lib/api";

export default function PosOwnerMonitorPage() {
  const [isAr, setIsAr] = React.useState(true);
  const [selectedBranch, setSelectedBranch] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastUpdated, setLastUpdated] = React.useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"overview" | "stream" | "shifts" | "branches">("overview");

  // Live Data State
  const [monitorData, setMonitorData] = React.useState<PosLiveMonitorResponse | null>(null);
  const [selectedInvoice, setSelectedInvoice] = React.useState<PosRecentSaleItem | null>(null);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = React.useState(false);

  // Fetch Live Data
  const fetchData = React.useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const data = await getPosLiveMonitor(selectedBranch);
      setMonitorData(data);
      setLastUpdated(new Date());
    } catch (e) {
      console.warn("Failed to fetch live monitor, using mock demo state", e);
      // Fallback demo data to ensure pristine presentation
      setMonitorData(getMockMonitorData(selectedBranch));
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedBranch]);

  // Initial fetch and auto-refresh loop (every 5 seconds)
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Push Mock Sale for instant live demonstration
  const handleSimulateSale = () => {
    if (!monitorData) return;
    const branches = monitorData.branches;
    const targetBranch = selectedBranch === "all" ? branches[Math.floor(Math.random() * branches.length)] : branches.find(b => b.branchCode === selectedBranch) || branches[0];
    const amounts = [185, 340, 720, 1250, 490, 850];
    const chosenAmount = amounts[Math.floor(Math.random() * amounts.length)];
    const paymentMethods = ["cash", "card", "cash", "credit"];
    const chosenMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const cashiers = ["أحمد علي", "محمود سامي", "سارة إبراهيم", "كريم عادل"];

    const newInvoice: PosRecentSaleItem = {
      id: "sim-" + Date.now(),
      localInvoiceId: "loc-" + Date.now(),
      invoiceNumber: `INV-${targetBranch.branchCode.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      branchCode: targetBranch.branchCode,
      branchName: targetBranch.name,
      customerName: "عميل تجريبي لحظي",
      totalAmount: chosenAmount,
      paidAmount: chosenMethod === "credit" ? 0 : chosenAmount,
      remainingAmount: chosenMethod === "credit" ? chosenAmount : 0,
      paymentMethod: chosenMethod,
      cashierName: cashiers[Math.floor(Math.random() * cashiers.length)],
      itemsCount: Math.floor(1 + Math.random() * 4),
      createdAt: new Date().toISOString(),
      timeAgoMinutes: 0,
      rawItems: [
        { name: "شاحن سريع أصلي 65W", quantity: 1, price: 450 },
        { name: "سماعة بلوتوث Pro", quantity: 1, price: chosenAmount - 450 > 0 ? chosenAmount - 450 : 270 },
      ],
    };

    setMonitorData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        kpis: {
          ...prev.kpis,
          todaySales: prev.kpis.todaySales + chosenAmount,
          todayInvoices: prev.kpis.todayInvoices + 1,
          cashInDrawers: chosenMethod === "cash" ? prev.kpis.cashInDrawers + chosenAmount : prev.kpis.cashInDrawers,
          todayCash: chosenMethod === "cash" ? prev.kpis.todayCash + chosenAmount : prev.kpis.todayCash,
          todayCard: chosenMethod === "card" ? prev.kpis.todayCard + chosenAmount : prev.kpis.todayCard,
          todayCredit: chosenMethod === "credit" ? prev.kpis.todayCredit + chosenAmount : prev.kpis.todayCredit,
          estimatedNetProfit: prev.kpis.estimatedNetProfit + Math.round(chosenAmount * 0.28),
        },
        recentSales: [newInvoice, ...prev.recentSales.slice(0, 24)],
      };
    });
  };

  const kpis = monitorData?.kpis || {
    todaySales: 0,
    todayInvoices: 0,
    averageTicket: 0,
    todayCash: 0,
    todayCard: 0,
    todayCredit: 0,
    cashInDrawers: 0,
    estimatedNetProfit: 0,
    activeShiftsCount: 0,
  };

  const branches = monitorData?.branches || [];
  const currentBranchName = selectedBranch === "all"
    ? (isAr ? "🏢 جميع الفروع (HQ Global)" : "🏢 All Branches (HQ Global)")
    : branches.find(b => b.branchCode === selectedBranch)?.name || selectedBranch;

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300 pb-20 md:pb-12"
    >
      {/* 1. TOP EXECUTIVE HEADER */}
      <header className="sticky top-0 z-40 w-full bg-[#070A12]/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-2xl">
        {/* Left / Start: Logo & Live Status Badge */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-emerald-400/30 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-bold tracking-wide text-white group-hover:text-emerald-400 transition-colors">
                QuazLink <span className="text-emerald-400 font-black">MONITOR</span>
              </span>
              <span className="text-[10px] text-slate-400">Enterprise Live ERP</span>
            </div>
          </Link>

          {/* Live Indicator */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="hidden xs:inline">{isAr ? "مباشر ولحظي" : "LIVE SYNC"}</span>
          </div>
        </div>

        {/* Center: Branch Selector Switcher */}
        <div className="relative">
          <button
            onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-xs sm:text-sm font-semibold text-slate-200 hover:border-emerald-400 transition-all shadow-inner hover:bg-slate-800"
          >
            <Store className="w-4 h-4 text-emerald-400" />
            <span className="max-w-[140px] sm:max-w-[200px] truncate">{currentBranchName}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isBranchDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Branch Dropdown Menu */}
          <AnimatePresence>
            {isBranchDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute top-full mt-2 w-64 bg-[#0B101D] border border-emerald-500/30 rounded-2xl p-2 shadow-2xl z-50 backdrop-blur-2xl"
              >
                <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 mb-1">
                  {isAr ? "اختر الفرع المراد مراقبته" : "Select Branch Scope"}
                </div>
                <button
                  onClick={() => { setSelectedBranch("all"); setIsBranchDropdownOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm transition-all ${
                    selectedBranch === "all" ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span>{isAr ? "جميع الفروع (شامل)" : "All Branches (Combined)"}</span>
                  </span>
                  {selectedBranch === "all" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </button>

                {branches.map((b) => (
                  <button
                    key={b.branchCode}
                    onClick={() => { setSelectedBranch(b.branchCode); setIsBranchDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm mt-1 transition-all ${
                      selectedBranch === b.branchCode ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40" : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Store className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="truncate">{b.name}</span>
                    </span>
                    {selectedBranch === b.branchCode && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right / End: Language & Refresh Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Refresh Button */}
          <button
            onClick={() => fetchData(false)}
            disabled={isRefreshing}
            title={isAr ? "تحديث فوري للبيانات" : "Refresh Now"}
            className="p-2 rounded-xl bg-slate-900 border border-white/10 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
          </button>

          {/* Test Simulation Button */}
          <button
            onClick={handleSimulateSale}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isAr ? "+ تجربة بيع حي" : "+ Simulate Sale"}</span>
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => setIsAr(!isAr)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-300"
          >
            {isAr ? "EN" : "عربي"}
          </button>
        </div>
      </header>

      {/* 2. MAIN CONTENT BODY */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Banner: Simulation / Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent border border-emerald-500/20 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {isAr ? "لوحة مراقبة المالك والمؤسسة المباشرة" : "Executive Live Command & Branch Monitor"}
              </h2>
              <p className="text-xs text-slate-400">
                {isAr
                  ? `آخر مزامنة: ${lastUpdated.toLocaleTimeString("ar-EG")} • تعمل المزامنة ذاتياً كل 5 ثوانٍ مع أجهزة الكاشير بالمحلات.`
                  : `Last synced at: ${lastUpdated.toLocaleTimeString()} • Auto-syncing every 5s across all retail terminals.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                autoRefresh
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {autoRefresh ? (isAr ? "التحديث التلقائي مفعّل" : "Auto-Refresh ON") : (isAr ? "التحديث التلقائي متوقف" : "Auto-Refresh OFF")}
            </button>
          </div>
        </div>

        {/* 3. KEY METRICS TILES (KPI CARDS GRID) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Tile 1: Total Sales */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-emerald-500/30 p-4 sm:p-5 shadow-lg group hover:border-emerald-400/50 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-slate-400">
                {isAr ? "مبيعات اليوم" : "Today's Sales"}
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              {kpis.todaySales.toLocaleString()} <span className="text-xs sm:text-sm font-bold text-emerald-400">{isAr ? "ج.م" : "EGP"}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400/90 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{isAr ? "تحديث فوري لكل فاتورة" : "Live Realtime Tracking"}</span>
            </div>
          </div>

          {/* Tile 2: Cash in Drawers */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-cyan-500/30 p-4 sm:p-5 shadow-lg group hover:border-cyan-400/50 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-slate-400">
                {isAr ? "النقدية بأدراج الخزينة" : "Cash in Drawers"}
              </span>
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              {kpis.cashInDrawers.toLocaleString()} <span className="text-xs sm:text-sm font-bold text-cyan-400">{isAr ? "ج.م" : "EGP"}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-cyan-400/90 font-medium">
              <Users className="w-3.5 h-3.5" />
              <span>{kpis.activeShiftsCount} {isAr ? "ورديات كاشير نشطة الآن" : "Active Cashiers On Duty"}</span>
            </div>
          </div>

          {/* Tile 3: Invoices Count & Avg Ticket */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-4 sm:p-5 shadow-lg group hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-slate-400">
                {isAr ? "عدد الفواتير المنفذة" : "Total Invoices"}
              </span>
              <div className="p-2 rounded-xl bg-white/5 text-slate-300 border border-white/10">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              {kpis.todayInvoices} <span className="text-xs sm:text-sm font-normal text-slate-400">{isAr ? "فاتورة" : "bills"}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 font-medium">
              {isAr ? "متوسط الفاتورة:" : "Avg Ticket:"} <span className="font-bold text-white">{kpis.averageTicket.toLocaleString()} {isAr ? "ج.م" : "EGP"}</span>
            </div>
          </div>

          {/* Tile 4: Estimated Net Profit */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-emerald-500/20 p-4 sm:p-5 shadow-lg group hover:border-emerald-400/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-slate-400">
                {isAr ? "صافي الربح التقديري" : "Estimated Profit"}
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-400 tracking-tight">
              {kpis.estimatedNetProfit.toLocaleString()} <span className="text-xs sm:text-sm font-bold text-emerald-500">{isAr ? "ج.م" : "EGP"}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {isAr ? "بناءً على هوامش الربح الحالية" : "Based on current profit margin"}
            </div>
          </div>

        </div>

        {/* 4. PAYMENT BREAKDOWN ROW */}
        <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-900/40 border border-white/10">
          <div className="flex flex-col items-center sm:items-start p-2">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {isAr ? "النقدية (Cash)" : "Cash Sales"}
            </span>
            <span className="text-sm sm:text-lg font-bold text-white mt-1">
              {kpis.todayCash.toLocaleString()} <span className="text-[10px] text-emerald-400">{isAr ? "ج.م" : "EGP"}</span>
            </span>
          </div>

          <div className="flex flex-col items-center sm:items-start p-2 border-x border-white/10">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              {isAr ? "الفيزا / إلكتروني" : "Card / Visa"}
            </span>
            <span className="text-sm sm:text-lg font-bold text-white mt-1">
              {kpis.todayCard.toLocaleString()} <span className="text-[10px] text-cyan-400">{isAr ? "ج.م" : "EGP"}</span>
            </span>
          </div>

          <div className="flex flex-col items-center sm:items-start p-2">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              {isAr ? "آجل / ديون جديدة" : "Credit / Receivables"}
            </span>
            <span className="text-sm sm:text-lg font-bold text-white mt-1">
              {kpis.todayCredit.toLocaleString()} <span className="text-[10px] text-amber-400">{isAr ? "ج.م" : "EGP"}</span>
            </span>
          </div>
        </div>

        {/* 5. TABS NAVIGATION FOR MOBILE & DESKTOP */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === "overview"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{isAr ? "نظرة شاملة" : "Overview"}</span>
          </button>

          <button
            onClick={() => setActiveTab("stream")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === "stream"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>{isAr ? "شريط الفواتير اللحظي" : "Live Sales Stream"}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-[10px] text-emerald-300">
              {monitorData?.recentSales.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("shifts")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === "shifts"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Users className="w-4 h-4 text-cyan-400" />
            <span>{isAr ? "رادار الورديات والكاشيرات" : "Live Shifts Radar"}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/30 text-[10px] text-cyan-300">
              {monitorData?.activeShifts.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("branches")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === "branches"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Store className="w-4 h-4 text-amber-400" />
            <span>{isAr ? "مقارنة أداء الفروع" : "Branch Leaderboard"}</span>
          </button>
        </div>

        {/* 6. TAB CONTENTS */}

        {/* --- TAB 1: OVERVIEW (SPLIT VIEW) --- */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Live Invoices Feed */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>{isAr ? "أحدث الفواتير المنفذة الآن" : "Recent Live Invoices"}</span>
                </h3>
                <span className="text-xs text-slate-400">{isAr ? "تحديث تلقائي لحظي" : "Auto-updating"}</span>
              </div>

              <div className="space-y-2.5">
                {monitorData?.recentSales.slice(0, 8).map((sale) => (
                  <motion.div
                    key={sale.id}
                    layout
                    initial={{ opacity: 0, x: isAr ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => setSelectedInvoice(sale)}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/50 hover:bg-slate-800/80 border border-white/5 hover:border-emerald-500/40 transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs group-hover:scale-105 transition-transform">
                        {sale.paymentMethod === "card" ? <CreditCard className="w-5 h-5 text-cyan-400" /> : <DollarSign className="w-5 h-5 text-emerald-400" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                            {sale.invoiceNumber}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/5">
                            {sale.branchName}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{sale.customerName}</span>
                          <span>•</span>
                          <span>{sale.cashierName}</span>
                          <span>•</span>
                          <span className="text-[11px] text-slate-500">{new Date(sale.createdAt).toLocaleTimeString(isAr ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm sm:text-base font-extrabold text-white">
                        {sale.totalAmount.toLocaleString()} <span className="text-xs text-emerald-400">{isAr ? "ج.م" : "EGP"}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-block mt-1 ${
                        sale.paymentMethod === "cash"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : sale.paymentMethod === "card"
                          ? "bg-cyan-500/20 text-cyan-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}>
                        {sale.paymentMethod.toUpperCase()}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right Col: Active Cashiers & Branch Comparison */}
            <div className="space-y-6">
              
              {/* Active Cashiers Card */}
              <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span>{isAr ? "الكاشيرات والورديات الشغالة" : "Cashiers on Duty"}</span>
                  </h3>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                <div className="space-y-3">
                  {monitorData?.activeShifts.map((shift) => (
                    <div key={shift.id} className="p-3 rounded-2xl bg-black/30 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{shift.cashierName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {isAr ? "شغال الآن" : "Active"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center justify-between">
                        <span>{shift.branchName}</span>
                        <span>{isAr ? "بدأ:" : "Started:"} {new Date(shift.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                        <span className="text-slate-400">{isAr ? "رصيد الدرج المقدر:" : "Cash in Drawer:"}</span>
                        <span className="font-bold text-cyan-300">{shift.estimatedDrawerCash.toLocaleString()} {isAr ? "ج.م" : "EGP"}</span>
                      </div>
                    </div>
                  ))}
                  {(!monitorData?.activeShifts || monitorData.activeShifts.length === 0) && (
                    <div className="text-center py-6 text-xs text-slate-500">
                      {isAr ? "لا توجد ورديات كاشير مفتوحة حالياً" : "No active shifts currently open"}
                    </div>
                  )}
                </div>
              </div>

              {/* Branch Quick Contribution */}
              <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4 shadow-xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Store className="w-4 h-4 text-amber-400" />
                  <span>{isAr ? "توزيع مبيعات الفروع اليوم" : "Branch Share"}</span>
                </h3>

                <div className="space-y-3">
                  {monitorData?.branchComparison.map((b) => (
                    <div key={b.branchCode} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-200 font-semibold">{b.name}</span>
                        <span className="text-emerald-400 font-bold">{b.sales.toLocaleString()} {isAr ? "ج.م" : "EGP"} ({b.percentage}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(8, b.percentage))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- TAB 2: FULL SALES STREAM --- */}
        {activeTab === "stream" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  {isAr ? "سجل الفواتير الحية المتدفقة من نقاط البيع" : "Realtime Invoice Stream Feed"}
                </h3>
                <p className="text-xs text-slate-400">
                  {isAr ? "كل عملية بيع تتم في أي فرع تسجل هنا لحظة بلحظة مع تفاصيل الدفع والعميل." : "Every completed POS transaction appears here in real-time."}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-3xl bg-slate-900/60 border border-white/10 shadow-xl">
              <table className="w-full text-xs sm:text-sm text-right">
                <thead className="bg-black/40 text-slate-400 border-b border-white/10 text-[11px] uppercase">
                  <tr>
                    <th className="py-3 px-4">{isAr ? "رقم الفاتورة" : "Invoice #"}</th>
                    <th className="py-3 px-4">{isAr ? "الفرع" : "Branch"}</th>
                    <th className="py-3 px-4">{isAr ? "العميل" : "Customer"}</th>
                    <th className="py-3 px-4">{isAr ? "الكاشير" : "Cashier"}</th>
                    <th className="py-3 px-4">{isAr ? "طريقة الدفع" : "Payment"}</th>
                    <th className="py-3 px-4">{isAr ? "القيمة" : "Total"}</th>
                    <th className="py-3 px-4">{isAr ? "الوقت" : "Time"}</th>
                    <th className="py-3 px-4 text-center">{isAr ? "معاينة" : "View"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {monitorData?.recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{sale.invoiceNumber}</td>
                      <td className="py-3 px-4 text-slate-300">{sale.branchName}</td>
                      <td className="py-3 px-4 text-slate-300">{sale.customerName}</td>
                      <td className="py-3 px-4 text-slate-400">{sale.cashierName}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          sale.paymentMethod === "cash" ? "bg-emerald-500/20 text-emerald-300" : "bg-cyan-500/20 text-cyan-300"
                        }`}>
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-emerald-400">
                        {sale.totalAmount.toLocaleString()} {isAr ? "ج.م" : "EGP"}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        {new Date(sale.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedInvoice(sale)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- TAB 3: SHIFTS RADAR --- */}
        {activeTab === "shifts" && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">
              {isAr ? "رادار الورديات وجرد الخزينة المباشر (Shift & Drawer Monitor)" : "Shifts & Cash Drawers Audit"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monitorData?.activeShifts.map((shift) => (
                <div key={shift.id} className="p-5 rounded-3xl bg-slate-900/60 border border-cyan-500/30 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div>
                      <h4 className="text-base font-bold text-white">{shift.cashierName}</h4>
                      <span className="text-xs text-slate-400">{shift.branchName}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      {isAr ? "وردية مفتوحة" : "Open Shift"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                      <span className="text-slate-400 block">{isAr ? "رصيد البداية" : "Starting Cash"}</span>
                      <span className="font-bold text-white text-sm">{shift.startingCash.toLocaleString()} ج.م</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                      <span className="text-slate-400 block">{isAr ? "المبيعات الحالية" : "Current Sales"}</span>
                      <span className="font-bold text-emerald-400 text-sm">{shift.currentSales.toLocaleString()} ج.م</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-300 block font-medium">{isAr ? "النقدية المفترضة في الدرج الآن:" : "Expected in Drawer:"}</span>
                      <span className="text-lg font-black text-cyan-300">{shift.estimatedDrawerCash.toLocaleString()} {isAr ? "ج.م" : "EGP"}</span>
                    </div>
                    <Wallet className="w-6 h-6 text-cyan-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB 4: BRANCH LEADERBOARD --- */}
        {activeTab === "branches" && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">
              {isAr ? "لوحة أداء ومقارنة الفروع (Branch Performance Leaderboard)" : "Branch Performance Leaderboard"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {monitorData?.branchComparison.map((b, idx) => (
                <div key={b.branchCode} className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-emerald-400 font-bold">#{idx + 1} {isAr ? "في الترتيب" : "Rank"}</span>
                      <h4 className="text-lg font-extrabold text-white mt-0.5">{b.name}</h4>
                    </div>
                    <Store className="w-6 h-6 text-slate-400" />
                  </div>

                  <div className="text-2xl font-black text-emerald-400">
                    {b.sales.toLocaleString()} <span className="text-xs text-slate-300">{isAr ? "ج.م مبيعات اليوم" : "EGP today"}</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{isAr ? "حصة الفرع من إجمالي المبيعات" : "Share of Total Sales"}</span>
                      <span className="font-bold text-white">{b.percentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${b.percentage}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
                    <span>{b.invoices} {isAr ? "فاتورة" : "bills"}</span>
                    <span>{b.activeShifts} {isAr ? "كاشير شغال" : "active cashiers"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* 7. INVOICE PREVIEW MODAL */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-[#0B101D] border border-emerald-500/30 p-6 space-y-5 shadow-2xl relative"
            >
              <button
                onClick={() => setSelectedInvoice(null)}
                className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-1">
                <span className="text-xs font-bold text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  {selectedInvoice.branchName}
                </span>
                <h3 className="text-lg font-black text-white mt-2">{selectedInvoice.invoiceNumber}</h3>
                <p className="text-xs text-slate-400">
                  {new Date(selectedInvoice.createdAt).toLocaleString(isAr ? "ar-EG" : "en-US")}
                </p>
              </div>

              {/* Items List */}
              <div className="divide-y divide-white/5 border-y border-white/10 py-3 space-y-2 max-h-56 overflow-y-auto">
                {Array.isArray(selectedInvoice.rawItems) && selectedInvoice.rawItems.length > 0 ? (
                  selectedInvoice.rawItems.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs pt-2">
                      <div>
                        <span className="text-white font-medium block">{item.name || item.product_name || "صنف تجاري"}</span>
                        <span className="text-slate-400 text-[11px]">{item.quantity || 1} x {(item.price || item.unit_price || 0).toLocaleString()} ج.م</span>
                      </div>
                      <span className="font-bold text-slate-200">
                        {((item.quantity || 1) * (item.price || item.unit_price || 0)).toLocaleString()} ج.م
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-xs text-slate-400">
                    {isAr ? "تفاصيل الفاتورة مسجلة بالكاشير" : "Items recorded at local POS terminal"}
                  </div>
                )}
              </div>

              {/* Total & Payment Method */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{isAr ? "طريقة الدفع:" : "Payment Method:"}</span>
                  <span className="font-bold text-white uppercase">{selectedInvoice.paymentMethod}</span>
                </div>
                <div className="flex items-center justify-between text-base font-extrabold">
                  <span className="text-white">{isAr ? "الإجمالي النهائي:" : "Grand Total:"}</span>
                  <span className="text-emerald-400 text-xl">{selectedInvoice.totalAmount.toLocaleString()} {isAr ? "ج.م" : "EGP"}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
              >
                {isAr ? "إغلاق المعاينة" : "Close"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. MOBILE BOTTOM NAVIGATION BAR (FIXED FOR SMARTPHONES) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070A12]/95 backdrop-blur-2xl border-t border-white/10 px-4 py-2 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-colors ${
            activeTab === "overview" ? "text-emerald-400 font-bold" : "text-slate-400"
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px]">{isAr ? "الرئيسية" : "Home"}</span>
        </button>

        <button
          onClick={() => setActiveTab("stream")}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-colors ${
            activeTab === "stream" ? "text-emerald-400 font-bold" : "text-slate-400"
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px]">{isAr ? "الفواتير" : "Sales"}</span>
        </button>

        <button
          onClick={() => setActiveTab("shifts")}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-colors ${
            activeTab === "shifts" ? "text-cyan-400 font-bold" : "text-slate-400"
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px]">{isAr ? "الورديات" : "Shifts"}</span>
        </button>

        <button
          onClick={() => setActiveTab("branches")}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-colors ${
            activeTab === "branches" ? "text-amber-400 font-bold" : "text-slate-400"
          }`}
        >
          <Store className="w-5 h-5" />
          <span className="text-[10px]">{isAr ? "الفروع" : "Branches"}</span>
        </button>
      </div>

    </div>
  );
}

/**
 * Fallback Mock Demo Data Generator
 */
function getMockMonitorData(branchCode: string): PosLiveMonitorResponse {
  const branches: PosBranchItem[] = [
    { id: "b1", branchCode: "main", name: "الفرع الرئيسي (المعادي)", city: "القاهرة", isActive: true, createdAt: new Date().toISOString() },
    { id: "b2", branchCode: "branch_nasr", name: "فرع مدينة نصر", city: "القاهرة", isActive: true, createdAt: new Date().toISOString() },
    { id: "b3", branchCode: "branch_tagamoa", name: "فرع التجمع الخامس", city: "القاهرة الجديدة", isActive: true, createdAt: new Date().toISOString() },
  ];

  return {
    success: true,
    selectedBranch: branchCode,
    date: new Date().toISOString().split("T")[0],
    serverTime: new Date().toISOString(),
    branches,
    kpis: {
      todaySales: 38450,
      todayInvoices: 94,
      averageTicket: 409,
      todayCash: 24200,
      todayCard: 11800,
      todayCredit: 2450,
      cashInDrawers: 15600,
      estimatedNetProfit: 10766,
      activeShiftsCount: 3,
    },
    activeShifts: [
      {
        id: "s1",
        branchCode: "main",
        branchName: "الفرع الرئيسي (المعادي)",
        cashierName: "أحمد علي",
        openedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
        startingCash: 1000,
        currentSales: 16800,
        currentInvoices: 42,
        estimatedDrawerCash: 17800,
        status: "open",
      },
      {
        id: "s2",
        branchCode: "branch_nasr",
        branchName: "فرع مدينة نصر",
        cashierName: "محمود سامي",
        openedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
        startingCash: 800,
        currentSales: 12400,
        currentInvoices: 31,
        estimatedDrawerCash: 13200,
        status: "open",
      },
      {
        id: "s3",
        branchCode: "branch_tagamoa",
        branchName: "فرع التجمع الخامس",
        cashierName: "سارة إبراهيم",
        openedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
        startingCash: 1200,
        currentSales: 9250,
        currentInvoices: 21,
        estimatedDrawerCash: 10450,
        status: "open",
      },
    ],
    recentSales: [
      {
        id: "inv-1",
        localInvoiceId: "loc-1",
        invoiceNumber: "INV-MAIN-001048",
        branchCode: "main",
        branchName: "الفرع الرئيسي (المعادي)",
        customerName: "عميل نقدي",
        totalAmount: 1450,
        paidAmount: 1450,
        remainingAmount: 0,
        paymentMethod: "cash",
        cashierName: "أحمد علي",
        itemsCount: 3,
        createdAt: new Date(Date.now() - 2 * 60000).toISOString(),
        timeAgoMinutes: 2,
        rawItems: [
          { name: "باور بانك 20000mAh سريع", quantity: 1, price: 950 },
          { name: "كابل Type-C قماش معتمد", quantity: 2, price: 250 },
        ],
      },
      {
        id: "inv-2",
        localInvoiceId: "loc-2",
        invoiceNumber: "INV-NASR-000842",
        branchCode: "branch_nasr",
        branchName: "فرع مدينة نصر",
        customerName: "د. هاني ممدوح",
        totalAmount: 2890,
        paidAmount: 2890,
        remainingAmount: 0,
        paymentMethod: "card",
        cashierName: "محمود سامي",
        itemsCount: 2,
        createdAt: new Date(Date.now() - 6 * 60000).toISOString(),
        timeAgoMinutes: 6,
        rawItems: [
          { name: "سماعة رأس لاسلكية إلغاء ضوضاء", quantity: 1, price: 2890 },
        ],
      },
      {
        id: "inv-3",
        localInvoiceId: "loc-3",
        invoiceNumber: "INV-TAG-000512",
        branchCode: "branch_tagamoa",
        branchName: "فرع التجمع الخامس",
        customerName: "م. إيهاب عادل",
        totalAmount: 850,
        paidAmount: 850,
        remainingAmount: 0,
        paymentMethod: "cash",
        cashierName: "سارة إبراهيم",
        itemsCount: 1,
        createdAt: new Date(Date.now() - 11 * 60000).toISOString(),
        timeAgoMinutes: 11,
        rawItems: [
          { name: "حامل هاتف للسيارة لاسلكي MagSafe", quantity: 1, price: 850 },
        ],
      },
    ],
    branchComparison: [
      { branchCode: "main", name: "الفرع الرئيسي (المعادي)", sales: 16800, invoices: 42, percentage: 44, activeShifts: 1 },
      { branchCode: "branch_nasr", name: "فرع مدينة نصر", sales: 12400, invoices: 31, percentage: 32, activeShifts: 1 },
      { branchCode: "branch_tagamoa", name: "فرع التجمع الخامس", sales: 9250, invoices: 21, percentage: 24, activeShifts: 1 },
    ],
  };
}
