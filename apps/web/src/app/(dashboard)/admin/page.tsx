"use client";

import * as React from "react";
import {
  Users,
  Laptop,
  Globe,
  Zap,
  ShieldCheck,
  ShieldAlert,
  Activity,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Radio,
  Sparkles,
  AlertCircle,
  TrendingUp,
  Cpu,
  MonitorCheck,
  ChevronRight,
  UserCheck,
  Signal,
  ArrowUpRight,
  SlidersHorizontal,
  Store,
  HardDrive,
  Copy,
  Check,
} from "lucide-react";
import {
  getAdminAnalytics,
  updateUserRole,
  type AdminAnalyticsData,
  type AdminUserItem,
  type AdminActiveSession,
  type PosTerminalItem,
} from "@/lib/api";

// Curated coordinates for prominent geographic hubs on a 800x400 SVG Map
const COUNTRY_COORDINATES: Record<string, { x: number; y: number; name: string }> = {
  EG: { x: 470, y: 175, name: "Egypt" },
  SA: { x: 505, y: 190, name: "Saudi Arabia" },
  AE: { x: 535, y: 190, name: "United Arab Emirates" },
  KW: { x: 512, y: 178, name: "Kuwait" },
  QA: { x: 525, y: 188, name: "Qatar" },
  OM: { x: 540, y: 205, name: "Oman" },
  BH: { x: 520, y: 186, name: "Bahrain" },
  JO: { x: 480, y: 168, name: "Jordan" },
  IQ: { x: 495, y: 162, name: "Iraq" },
  US: { x: 190, y: 155, name: "United States" },
  GB: { x: 405, y: 120, name: "United Kingdom" },
  DE: { x: 425, y: 125, name: "Germany" },
  FR: { x: 410, y: 135, name: "France" },
  TR: { x: 470, y: 150, name: "Turkey" },
  CA: { x: 180, y: 120, name: "Canada" },
};

export default function AdminDashboardPage() {
  const [data, setData] = React.useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  // Time range for KPI activity trend chart
  const [timeRange, setTimeRange] = React.useState<"24h" | "7d" | "30d">("7d");
  const [chartHoverIndex, setChartHoverIndex] = React.useState<number | null>(null);

  // Ping simulation state for active nodes
  const [pingStates, setPingStates] = React.useState<Record<string, { pinging: boolean; ms?: number }>>({});

  // Search & Filter state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"all" | "active" | "admins" | "with_runners">("all");
  const [selectedCountryFilter, setSelectedCountryFilter] = React.useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = React.useState<string | null>(null);

  // Standalone POS Terminals state
  const [posSearchQuery, setPosSearchQuery] = React.useState("");
  const [posFilterTab, setPosFilterTab] = React.useState<"all" | "online" | "win7" | "win10">("all");
  const [copiedHwId, setCopiedHwId] = React.useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedHwId(text);
      setTimeout(() => setCopiedHwId(null), 2000);
    }
  };

  const fetchData = React.useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await getAdminAnalytics();
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load admin analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();

    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        if (!document.hidden) {
          fetchData(true);
        }
      }, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchData]);

  async function handleToggleRole(user: AdminUserItem) {
    if (user.isMasterAdmin) {
      alert("The Master Super Admin role cannot be modified.");
      return;
    }

    const newRole = user.role === "admin" ? "user" : "admin";
    const confirmMsg =
      newRole === "admin"
        ? `Are you sure you want to promote ${user.email} to Administrator?`
        : `Are you sure you want to demote ${user.email} to regular User?`;

    if (!confirm(confirmMsg)) return;

    setUpdatingUserId(user.id);
    try {
      await updateUserRole(user.id, newRole);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: prev.users.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)),
        };
      });
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    } finally {
      setUpdatingUserId(null);
    }
  }

  function handlePingNode(deviceId: string) {
    setPingStates((prev) => ({ ...prev, [deviceId]: { pinging: true } }));
    setTimeout(() => {
      const simulatedMs = Math.floor(Math.random() * 25) + 18;
      setPingStates((prev) => ({ ...prev, [deviceId]: { pinging: false, ms: simulatedMs } }));
    }, 450);
  }

  // Trend curve generation for Section 4 (KPI Trend Chart)
  const trendPoints = React.useMemo(() => {
    const totalRuns = data?.kpis?.totalJobs || 24;
    const count = timeRange === "24h" ? 12 : timeRange === "7d" ? 7 : 14;
    const points: { label: string; value: number }[] = [];

    for (let i = count - 1; i >= 0; i--) {
      const factor = Math.sin((i / count) * Math.PI) * 0.4 + 0.6;
      const val = Math.max(2, Math.round((totalRuns / count) * factor + (i % 2 === 0 ? 1 : 0)));
      const label =
        timeRange === "24h"
          ? `${(i * 2)}h ago`
          : timeRange === "7d"
          ? `Day -${i}`
          : `Wk ${Math.ceil(i / 3)}`;
      points.push({ label, value: val });
    }
    return points;
  }, [data?.kpis?.totalJobs, timeRange]);

  // Filtered Users computation
  const filteredUsers = React.useMemo(() => {
    if (!data?.users) return [];
    let list = data.users;

    // Country quick filter from map/cards
    if (selectedCountryFilter) {
      list = list.filter((u) => u.location.countryCode === selectedCountryFilter);
    }

    // Tab filter
    if (activeTab === "active") {
      list = list.filter((u) => u.isOnline);
    } else if (activeTab === "admins") {
      list = list.filter((u) => u.role === "admin" || u.isMasterAdmin);
    } else if (activeTab === "with_runners") {
      list = list.filter((u) => u.devices.length > 0);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.name && u.name.toLowerCase().includes(q)) ||
          u.location.country.toLowerCase().includes(q) ||
          u.location.city.toLowerCase().includes(q) ||
          (u.lastLoginIp && u.lastLoginIp.includes(q))
      );
    }

    return list;
  }, [data?.users, activeTab, searchQuery, selectedCountryFilter]);

  // Standalone POS Terminals computation
  const filteredPosTerminals = React.useMemo(() => {
    if (!data?.posTerminals) return [];
    let list = data.posTerminals;

    if (posFilterTab === "online") {
      list = list.filter((t) => t.isOnline);
    } else if (posFilterTab === "win7") {
      list = list.filter(
        (t) =>
          (t.osRelease || "").toLowerCase().includes("6.1") ||
          (t.osRelease || "").toLowerCase().includes("windows 7")
      );
    } else if (posFilterTab === "win10") {
      list = list.filter(
        (t) =>
          !(t.osRelease || "").toLowerCase().includes("6.1") &&
          !(t.osRelease || "").toLowerCase().includes("windows 7")
      );
    }

    if (posSearchQuery.trim()) {
      const q = posSearchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          (t.businessName && t.businessName.toLowerCase().includes(q)) ||
          t.hardwareId.toLowerCase().includes(q) ||
          t.hostname.toLowerCase().includes(q) ||
          t.username.toLowerCase().includes(q) ||
          t.location.country.toLowerCase().includes(q) ||
          t.location.city.toLowerCase().includes(q) ||
          t.ipAddress.includes(q) ||
          t.cpuModel.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data?.posTerminals, posFilterTab, posSearchQuery]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <Radio className="w-6 h-6 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="text-gray-400 text-sm font-medium tracking-wide">
          Connecting to QuazLink Master Telemetry...
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center max-w-xl mx-auto my-12 backdrop-blur-xl">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Access Restricted or Error</h2>
        <p className="text-sm text-red-300 mb-6">{error}</p>
        <button
          onClick={() => fetchData()}
          className="px-5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-white font-medium text-sm border border-red-500/40 transition-all inline-flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  const kpis = data?.kpis;
  const geo = data?.geoDistribution || [];
  const activeSessions = data?.activeSessions || [];

  // SVG Chart points calculation for Activity Trend
  const chartWidth = 650;
  const chartHeight = 130;
  const maxVal = Math.max(...trendPoints.map((p) => p.value), 6);
  const svgPoints = trendPoints.map((p, idx) => {
    const x = 20 + (idx / (trendPoints.length - 1)) * (chartWidth - 40);
    const y = chartHeight - 15 - (p.value / maxVal) * (chartHeight - 35);
    return { x, y, ...p };
  });

  const curvePath = svgPoints.reduce((acc, curr, idx, arr) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`;
    const prev = arr[idx - 1];
    const cx = (prev.x + curr.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }, "");

  const areaGradientPath =
    svgPoints.length > 0
      ? `${curvePath} L ${svgPoints[svgPoints.length - 1].x} ${chartHeight} L ${svgPoints[0].x} ${chartHeight} Z`
      : "";

  return (
    <div className="space-y-8 pb-16">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                  Admin &amp; Operations Center
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  SUPERVISOR
                </span>
              </div>
              <p className="text-xs lg:text-sm text-gray-400 mt-0.5">
                Real-time user intelligence, geographic connection map, and live active desktop runners
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              autoRefresh
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.15)]"
                : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
            }`}
            title={autoRefresh ? "Auto-refreshing live every 10s" : "Auto-refresh paused"}
          >
            <span
              className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`}
            />
            <span>{autoRefresh ? "Live Sync (10s)" : "Sync Paused"}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
            <span>Refresh Now</span>
          </button>
        </div>
      </div>

      {/* ── SECTION 4: KPIs & REAL-TIME ANALYTICS (إحصائيات بيانية سريعة) ────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Platform Vital Metrics &amp; Operations (التحليلات اللحظية)
            </h2>
          </div>
          <span className="text-[11px] text-gray-500 font-mono">Telemetry: Live Stream</span>
        </div>

        {/* 6 Primary Vital KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {/* Total Registered Users */}
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl relative overflow-hidden group hover:border-cyan-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Total Users
              </span>
              <div className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-1.5">
              <span className="text-2xl font-extrabold text-white tracking-tight">
                {kpis?.totalUsers || 0}
              </span>
              <span className="text-[11px] text-gray-400">Accounts</span>
            </div>
            <div className="mt-2 text-[10px] text-cyan-400/90 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Platform Verified</span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Live Active Users Now */}
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Active Users
              </span>
              <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-1.5">
              <span className="text-2xl font-extrabold text-emerald-400 tracking-tight">
                {kpis?.activeUsersNow || 0}
              </span>
              <span className="text-[11px] text-emerald-300/80 font-medium">Online Live</span>
            </div>
            <div className="mt-2 text-[10px] text-gray-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{kpis?.onlineDevicesCount || 0} Runners streaming</span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Desktop Automation Nodes */}
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl relative overflow-hidden group hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Desktop Nodes
              </span>
              <div className="p-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Laptop className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-1.5">
              <span className="text-2xl font-extrabold text-white tracking-tight">
                {kpis?.totalDevices || 0}
              </span>
              <span className="text-[11px] text-gray-400">Runners</span>
            </div>
            <div className="mt-2 text-[10px] text-purple-400/90 flex items-center space-x-1">
              <Cpu className="w-3 h-3" />
              <span>Stealth Local Nodes</span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Standalone POS Terminals (أجهزة الكاشير والمحلات) */}
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl relative overflow-hidden group hover:border-cyan-400/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                POS Terminals
              </span>
              <div className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Store className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-1.5">
              <span className="text-2xl font-extrabold text-cyan-300 tracking-tight">
                {kpis?.totalPosTerminals || 0}
              </span>
              <span className="text-[11px] text-gray-400">Stores</span>
            </div>
            <div className="mt-2 text-[10px] text-cyan-400/80 flex items-center space-x-1 truncate">
              <HardDrive className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Local Desktop POS</span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Active POS Cashiers Online */}
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl relative overflow-hidden group hover:border-emerald-400/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                Online Cashiers
              </span>
              <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <MonitorCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-1.5">
              <span className="text-2xl font-extrabold text-emerald-400 tracking-tight">
                {kpis?.activePosTerminals || 0}
              </span>
              <span className="text-[11px] text-emerald-300/80 font-medium">Active Now</span>
            </div>
            <div className="mt-2 text-[10px] text-emerald-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Transacting Live</span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Automation Operations & Success Rate */}
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Automation
              </span>
              <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-1.5">
              <span className="text-2xl font-extrabold text-white tracking-tight">
                {kpis?.totalJobs || 0}
              </span>
              <span className="text-[11px] text-amber-400 font-semibold">{kpis?.successRate || 100}%</span>
            </div>
            <div className="mt-2 text-[10px] text-gray-400 flex items-center space-x-1">
              <span>{kpis?.completedJobs || 0} Ok</span>
              <span>•</span>
              <span className="text-red-400">{kpis?.failedJobs || 0} Err</span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          </div>
        </div>

        {/* Dynamic Activity Volume Curve Chart */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Automation Activity &amp; Traffic Volume</h3>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Execution throughput across all connected residential runners</p>
            </div>
            <div className="flex items-center space-x-1 bg-white/5 border border-white/10 p-1 rounded-xl text-xs">
              {(["24h", "7d", "30d"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    timeRange === r
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Smooth Curve */}
          <div className="relative w-full h-[130px] overflow-hidden">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="adminChartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="adminLineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>

              {/* Area */}
              {areaGradientPath && <path d={areaGradientPath} fill="url(#adminChartFill)" />}

              {/* Curve Line */}
              {curvePath && (
                <path
                  d={curvePath}
                  fill="none"
                  stroke="url(#adminLineGradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Interactive Dots */}
              {svgPoints.map((pt, i) => (
                <g
                  key={i}
                  onMouseEnter={() => setChartHoverIndex(i)}
                  onMouseLeave={() => setChartHoverIndex(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={chartHoverIndex === i ? "6" : "3.5"}
                    className={`transition-all duration-200 ${
                      chartHoverIndex === i ? "fill-cyan-300 stroke-cyan-500 stroke-2" : "fill-cyan-400"
                    }`}
                  />
                  {chartHoverIndex === i && (
                    <text
                      x={pt.x}
                      y={pt.y - 10}
                      textAnchor="middle"
                      className="fill-white font-mono text-[11px] font-bold"
                    >
                      {pt.value} runs
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* ── SECTION: STANDALONE POS & RETAIL TERMINALS (أجهزة الكاشير والمحلات بدون حساب) ────── */}
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Store className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                <span>Standalone POS &amp; Retail Terminals ({data?.posTerminals?.length || 0})</span>
                <span className="text-sm font-semibold text-cyan-400">
                  (أجهزة الكاشير والمحلات بدون حساب منصة)
                </span>
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">
              أجهزة الكاشير ونظام نقاط البيع التي تم تحميلها وتشغيلها محلياً على أجهزة الكمبيوتر دون إنشاء حساب على المنصة. يتم رصد بصمة العتاد الفريدة (Hardware ID)، مواصفات المعالج، الذاكرة العشوائية، إصدار الويندوز، والموقع الجغرافي الفعلي لحظة بلحظة.
            </p>
          </div>

          {/* Search Input for POS */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={posSearchQuery}
              onChange={(e) => setPosSearchQuery(e.target.value)}
              placeholder="Search store name, hostname, HW-ID, city, CPU..."
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all"
            />
          </div>
        </div>

        {/* Filters bar */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setPosFilterTab("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              posFilterTab === "all"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                : "text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent"
            }`}
          >
            All Machines ({data?.posTerminals?.length || 0})
          </button>
          <button
            onClick={() => setPosFilterTab("online")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              posFilterTab === "online"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent"
            }`}
          >
            🟢 Online Cashiers Now ({data?.posTerminals?.filter((t) => t.isOnline).length || 0})
          </button>
          <button
            onClick={() => setPosFilterTab("win7")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              posFilterTab === "win7"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                : "text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent"
            }`}
          >
            🪟 Windows 7 ({data?.posTerminals?.filter((t) => (t.osRelease || "").includes("6.1") || (t.osRelease || "").toLowerCase().includes("windows 7")).length || 0})
          </button>
          <button
            onClick={() => setPosFilterTab("win10")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              posFilterTab === "win10"
                ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
                : "text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent"
            }`}
          >
            🪟 Windows 10 / 11 ({data?.posTerminals?.filter((t) => !(t.osRelease || "").includes("6.1") && !(t.osRelease || "").toLowerCase().includes("windows 7")).length || 0})
          </button>
        </div>

        {/* Grid of Terminals */}
        {filteredPosTerminals.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm space-y-3 bg-slate-950/40 rounded-xl border border-white/5">
            <Store className="w-10 h-10 text-gray-600 mx-auto" />
            <p className="text-gray-300 font-medium">No Standalone POS Machines Recorded Yet</p>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              بمجرد أن يقوم أي شخص بتحميل وتثبيت برنامج الكاشير وتشغيله على جهازه، ستظهر بيانات المحل والعتاد والموقع هنا تلقائياً دون الحاجة لتسجيل حساب.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPosTerminals.map((terminal) => {
              const isCopied = copiedHwId === terminal.hardwareId;
              const ramGB = terminal.totalMemoryMB ? Math.round(terminal.totalMemoryMB / 1024) : 4;
              const isWin7 = (terminal.osRelease || "").includes("6.1") || (terminal.osRelease || "").toLowerCase().includes("windows 7");

              return (
                <div
                  key={terminal.id}
                  className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/40 hover:bg-white/[0.05] transition-all space-y-4 group relative overflow-hidden"
                >
                  {/* Top Business Name & Online Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center space-x-2">
                        <Store className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <h3 className="font-bold text-white text-sm truncate" title={terminal.businessName}>
                          {terminal.businessName}
                        </h3>
                      </div>
                      <div className="text-[11px] font-mono text-gray-400 truncate flex items-center space-x-1 pl-6">
                        <span>{terminal.hostname}</span>
                        <span>•</span>
                        <span className="text-gray-500">{terminal.username}</span>
                      </div>
                    </div>

                    {terminal.isOnline ? (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>ONLINE</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20 flex-shrink-0">
                        <span>OFFLINE</span>
                      </span>
                    )}
                  </div>

                  {/* Hardware Fingerprint ID (with quick copy) */}
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Hardware ID Fingerprint</div>
                      <div className="text-xs font-mono font-bold text-cyan-300 truncate">
                        {terminal.hardwareId}
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(terminal.hardwareId)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all flex-shrink-0"
                      title="Copy Hardware ID"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Hardware & OS Specs Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {/* OS Spec */}
                    <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                      <div className="text-[9px] text-gray-500 font-mono uppercase">Operating System</div>
                      <div className="font-semibold text-gray-200 truncate flex items-center space-x-1">
                        <span>{isWin7 ? "Windows 7" : "Windows 10/11"}</span>
                        <span className="text-[10px] text-gray-500">({terminal.osArch})</span>
                      </div>
                      <div className="text-[10px] font-mono text-gray-400 truncate">{terminal.osRelease}</div>
                    </div>

                    {/* RAM & CPU */}
                    <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                      <div className="text-[9px] text-gray-500 font-mono uppercase">Memory &amp; CPU</div>
                      <div className="font-semibold text-gray-200 truncate flex items-center space-x-1">
                        <Cpu className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                        <span>{ramGB} GB RAM</span>
                      </div>
                      <div className="text-[10px] font-mono text-gray-400 truncate" title={terminal.cpuModel}>
                        {terminal.cpuModel}
                      </div>
                    </div>
                  </div>

                  {/* Location & IP Section */}
                  <div className="p-2.5 rounded-xl bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl select-none">{terminal.location.flag}</span>
                      <div>
                        <div className="font-semibold text-white">
                          {terminal.location.city}, {terminal.location.country}
                        </div>
                        <div className="text-[10px] font-mono text-cyan-400/90">
                          {terminal.ipAddress}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/5 text-gray-300 border border-white/10">
                        v{terminal.appVersion}
                      </span>
                      <div className="text-[10px] text-gray-500 mt-1 capitalize font-medium">
                        {terminal.licenseType}
                      </div>
                    </div>
                  </div>

                  {/* Footer Timestamps */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500 font-mono">
                    <div>
                      <span>Launches: </span>
                      <span className="text-gray-300 font-bold">{terminal.launchCount}</span>
                    </div>
                    <div>
                      <span>Last Seen: </span>
                      <span className="text-gray-300">
                        {new Date(terminal.lastSeenAt).toLocaleDateString()} {new Date(terminal.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 1: GEOGRAPHIC DISTRIBUTION & LOCATIONS (فاتحين منين) ───── */}
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
          <div className="flex items-center space-x-2.5">
            <Globe className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Geographic Presence &amp; Real-Time Locations (فاتحين منين وأنهي مكان)
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            {selectedCountryFilter && (
              <button
                onClick={() => setSelectedCountryFilter(null)}
                className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30"
              >
                Clear Filter ({selectedCountryFilter}) &times;
              </button>
            )}
            <span className="text-xs text-gray-400">
              Edge GeoIP detection with Cloudflare reverse-proxy telemetry
            </span>
          </div>
        </div>

        {/* Interactive World Map SVG Visualization */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3 text-xs text-gray-400">
            <span className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-semibold text-gray-300">Live Geographic Coordinate Grid</span>
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              Interactive Nodes Map (Click country card below to filter)
            </span>
          </div>

          <div className="relative w-full aspect-[2.2/1] max-h-[220px]">
            <svg viewBox="0 0 800 360" className="w-full h-full select-none">
              {/* World Map Land Outline representation */}
              <g fill="rgba(255, 255, 255, 0.05)" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.8">
                {/* Americas */}
                <path d="M 120 70 Q 180 50 250 80 Q 230 150 190 190 Q 170 230 200 280 Q 220 330 240 350 Q 210 360 190 320 Q 170 260 150 210 Q 110 150 120 70 Z" />
                {/* Europe */}
                <path d="M 390 80 Q 450 70 470 110 Q 450 140 400 150 Q 370 120 390 80 Z" />
                {/* Africa & Middle East */}
                <path d="M 430 150 Q 510 140 560 180 Q 550 260 500 320 Q 460 300 440 240 Q 420 180 430 150 Z" />
                {/* Asia & Pacific */}
                <path d="M 500 90 Q 640 70 710 120 Q 680 200 620 230 Q 560 210 520 150 Z" />
                {/* Australia */}
                <path d="M 640 260 Q 720 250 730 300 Q 670 330 630 300 Z" />
              </g>

              {/* Pulsating Map Markers for active countries */}
              {geo.map((item) => {
                const coords = COUNTRY_COORDINATES[item.countryCode] || { x: 470, y: 175, name: item.country };
                const isSelected = selectedCountryFilter === item.countryCode;

                return (
                  <g
                    key={item.countryCode}
                    className="cursor-pointer group"
                    onClick={() =>
                      setSelectedCountryFilter(
                        selectedCountryFilter === item.countryCode ? null : item.countryCode
                      )
                    }
                  >
                    {/* Pulsing ring */}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r="12"
                      className="fill-cyan-500/20 stroke-cyan-400 stroke-1 animate-ping"
                      style={{ animationDuration: "3s" }}
                    />
                    {/* Core pin */}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={isSelected ? "7" : "5"}
                      className={`transition-all ${
                        isSelected
                          ? "fill-emerald-400 stroke-white stroke-2"
                          : "fill-cyan-400 stroke-slate-900 stroke-2"
                      }`}
                    />
                    {/* Country label pin */}
                    <text
                      x={coords.x}
                      y={coords.y - 10}
                      textAnchor="middle"
                      className="fill-cyan-300 font-bold text-[10px] pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                    >
                      {item.flag} {item.country} ({item.count})
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Country Breakdown Cards */}
        {geo.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            No geographic telemetry recorded yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {geo.map((item) => {
              const isSelected = selectedCountryFilter === item.countryCode;
              return (
                <div
                  key={item.countryCode}
                  onClick={() =>
                    setSelectedCountryFilter(isSelected ? null : item.countryCode)
                  }
                  className={`p-4 rounded-xl border transition-all space-y-3 cursor-pointer ${
                    isSelected
                      ? "bg-cyan-500/15 border-cyan-400 ring-2 ring-cyan-500/30"
                      : "bg-white/5 border-white/10 hover:border-cyan-500/40 hover:bg-white/[0.08]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-2xl select-none">{item.flag}</span>
                      <div>
                        <div className="font-bold text-white text-sm">{item.country}</div>
                        <div className="text-[10px] font-mono text-gray-400">{item.countryCode}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-cyan-400">{item.count}</span>
                      <span className="text-[10px] text-gray-400 block">{item.percentage}%</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, item.percentage)}%` }}
                    />
                  </div>

                  {/* Top Cities */}
                  {item.cities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.cities.map((city) => (
                        <span
                          key={city}
                          className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-gray-300"
                        >
                          {city}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 3: LIVE ACTIVE SESSIONS & RUNNER MONITOR ────────────────── */}
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_#34d399]" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Live Active Desktop Runners ({activeSessions.length}) (المستخدمين النشطين والرانرز)
            </h2>
          </div>
          <span className="text-xs text-emerald-400/90 font-mono">
            ● Streaming real-time WebSocket heartbeats
          </span>
        </div>

        {activeSessions.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm space-y-2">
            <Laptop className="w-8 h-8 text-gray-600 mx-auto" />
            <p>No Desktop Runners are currently streaming live heartbeats.</p>
            <p className="text-xs text-gray-500">Runners automatically appear here once users launch the QuazLink Runner app.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSessions.map((session) => {
              const pingInfo = pingStates[session.deviceId];
              return (
                <div
                  key={session.deviceId}
                  className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 relative overflow-hidden space-y-3 group hover:border-emerald-500/40 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Laptop className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-white text-sm truncate max-w-[150px]">
                        {session.deviceName}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                      ONLINE
                    </span>
                  </div>

                  <div className="text-xs text-gray-300 space-y-1">
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className="text-gray-500">User:</span>
                      <span className="text-white font-medium truncate">{session.user.email}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-gray-500">Location:</span>
                      <span>{session.location.flag}</span>
                      <span className="text-gray-200">
                        {session.location.city}, {session.location.country}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-gray-500">IP:</span>
                      <span className="font-mono text-cyan-400 text-[11px]">
                        {session.ipAddress || "127.0.0.1"}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400 text-[11px] font-mono">{session.appVersion}</span>
                    </div>
                  </div>

                  {/* Interactive Ping & Heartbeat footer */}
                  <div className="text-[10px] text-gray-500 pt-2 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <span>Heartbeat:</span>
                      <span className="text-gray-400 font-mono">
                        {session.lastHeartbeat ? new Date(session.lastHeartbeat).toLocaleTimeString() : "Recent"}
                      </span>
                    </div>

                    <button
                      onClick={() => handlePingNode(session.deviceId)}
                      disabled={pingInfo?.pinging}
                      className="px-2 py-0.5 rounded bg-white/5 hover:bg-emerald-500/20 border border-white/10 text-gray-300 hover:text-emerald-400 transition-all font-mono text-[9px] flex items-center space-x-1"
                    >
                      <Signal className="w-2.5 h-2.5" />
                      <span>{pingInfo?.pinging ? "Pinging..." : pingInfo?.ms ? `${pingInfo.ms}ms` : "Ping"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 2: REGISTERED USERS DIRECTORY ───────────────────────────── */}
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span>Registered Users Directory ({data?.users.length || 0}) (المستخدمين المسجلين)</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Comprehensive registry with location telemetry, connected nodes, and privilege control
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email, name, country, city, IP..."
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all"
            />
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === "all"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                : "text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent"
            }`}
          >
            All Users ({data?.users.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === "active"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent"
            }`}
          >
            🟢 Active Live ({data?.users.filter((u) => u.isOnline).length || 0})
          </button>
          <button
            onClick={() => setActiveTab("admins")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === "admins"
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                : "text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent"
            }`}
          >
            🛡️ Administrators ({data?.users.filter((u) => u.role === "admin" || u.isMasterAdmin).length || 0})
          </button>
          <button
            onClick={() => setActiveTab("with_runners")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === "with_runners"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                : "text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent"
            }`}
          >
            💻 With Desktop Runners ({data?.users.filter((u) => u.devices.length > 0).length || 0})
          </button>
        </div>

        {/* Master Table */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-gray-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3.5">User Profile</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Location (فاتحين منين)</th>
                <th className="px-4 py-3.5">Desktop Runner</th>
                <th className="px-4 py-3.5">Social Accounts</th>
                <th className="px-4 py-3.5">Joined</th>
                <th className="px-4 py-3.5 text-right">Role Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No users match the search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* User profile */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center font-bold text-white text-xs flex-shrink-0">
                          {u.name ? u.name.slice(0, 2).toUpperCase() : u.email.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate flex items-center space-x-1.5">
                            <span>{u.name || u.email.split("@")[0]}</span>
                            {u.isMasterAdmin && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                OWNER
                              </span>
                            )}
                            {!u.isMasterAdmin && u.role === "admin" && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-gray-400 text-[11px] font-mono truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {u.isOnline ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Online Now</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                          <span>
                            {u.lastLoginAt
                              ? `Seen ${new Date(u.lastLoginAt).toLocaleDateString()}`
                              : "Offline"}
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg select-none">{u.location.flag}</span>
                        <div>
                          <div className="text-white font-medium">
                            {u.location.city}, {u.location.country}
                          </div>
                          <div className="text-[10px] font-mono text-cyan-400/90">
                            {u.lastLoginIp || "127.0.0.1"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Desktop Runner */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {u.devices.length === 0 ? (
                        <span className="text-gray-500 text-[11px]">No Runner paired</span>
                      ) : (
                        <div className="space-y-1">
                          {u.devices.map((d) => (
                            <div key={d.id} className="flex items-center space-x-1.5 text-[11px]">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  d.isOnline ? "bg-emerald-400 animate-pulse" : "bg-gray-500"
                                }`}
                              />
                              <span className="text-gray-300 font-medium">{d.name}</span>
                              <span className="text-gray-500 text-[10px]">({d.appVersion})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Social Accounts */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {u.socialAccountsCount === 0 ? (
                        <span className="text-gray-500 text-[11px]">0 connected</span>
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-white">{u.socialAccountsCount}</span>
                          <span className="text-gray-400 text-[11px]">
                            ({u.socialPlatforms.join(", ") || "social"})
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Joined date */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-400 text-[11px] font-mono">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {u.isMasterAdmin ? (
                        <span className="text-[11px] text-gray-500 italic">Super Admin</span>
                      ) : (
                        <button
                          onClick={() => handleToggleRole(u)}
                          disabled={updatingUserId === u.id}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                            u.role === "admin"
                              ? "bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300"
                              : "bg-white/5 border-white/10 text-gray-300 hover:bg-purple-500/20 hover:border-purple-500/30 hover:text-purple-300"
                          }`}
                        >
                          {updatingUserId === u.id ? "Saving..." : u.role === "admin" ? "Demote" : "Make Admin"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
