"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tv,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Sliders,
  Lamp,
  Power,
  Fan,
  Film,
  Search,
  Check,
  RotateCcw,
  RefreshCw,
  ArrowRight,
  Eye,
  SlidersHorizontal
} from "lucide-react";
import { StarField } from "@/components/effects/StarField";
import { NebulaBackground } from "@/components/effects/NebulaBackground";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useLanguage } from "@/context/LanguageContext";

interface TvDevice {
  deviceToken: string;
  name: string;
  haUrl: string;
  pairedAt: string;
  lastSeenAt: string;
  ipAddress?: string;
  selectedCount: number;
}

interface HaEntity {
  entityId: string;
  name: string;
  type: string;
  category: "lights" | "switches" | "climate" | "scenes";
  icon: string;
  state: string;
  isOn: boolean;
  selected: boolean;
}

export default function TvPortalDashboard() {
  const { lang, isAr } = useLanguage();

  const [loading, setLoading] = React.useState(true);
  const [devices, setDevices] = React.useState<TvDevice[]>([]);
  const [selectedDeviceToken, setSelectedDeviceToken] = React.useState<string>("");

  const [entities, setEntities] = React.useState<HaEntity[]>([]);
  const [selectedEntityIds, setSelectedEntityIds] = React.useState<Set<string>>(new Set());
  const [loadingEntities, setLoadingEntities] = React.useState(false);

  const [activeTab, setActiveTab] = React.useState<"all" | "lights" | "switches" | "climate" | "scenes">("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [togglingEntity, setTogglingEntity] = React.useState<string | null>(null);

  // 1. Fetch all paired TVs
  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await fetch("https://api.quazlink.site/api/tv/devices");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.devices)) {
        setDevices(data.devices);
        if (data.devices.length > 0 && !selectedDeviceToken) {
          setSelectedDeviceToken(data.devices[0].deviceToken);
        }
      }
    } catch (err) {
      console.error("Failed to load TV devices", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDevices();
  }, []);

  // 2. Fetch Home Assistant entities for the selected TV
  const fetchEntities = async (token: string) => {
    if (!token) return;
    try {
      setLoadingEntities(true);
      const res = await fetch(`https://api.quazlink.site/api/tv/devices/${token}/entities`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.entities)) {
        setEntities(data.entities);
        const sel = new Set<string>(data.selectedEntities || []);
        setSelectedEntityIds(sel);
      }
    } catch (err) {
      console.error("Failed to fetch entities", err);
    } finally {
      setLoadingEntities(false);
    }
  };

  React.useEffect(() => {
    if (selectedDeviceToken) {
      fetchEntities(selectedDeviceToken);
    }
  }, [selectedDeviceToken]);

  // Toggle selection for an entity
  const toggleSelect = (entityId: string) => {
    const next = new Set(selectedEntityIds);
    if (next.has(entityId)) {
      next.delete(entityId);
    } else {
      next.add(entityId);
    }
    setSelectedEntityIds(next);
  };

  // Select all in current tab
  const selectAllCurrent = () => {
    const next = new Set(selectedEntityIds);
    filteredEntities.forEach((e) => next.add(e.entityId));
    setSelectedEntityIds(next);
  };

  // Deselect all in current tab
  const deselectAllCurrent = () => {
    const next = new Set(selectedEntityIds);
    filteredEntities.forEach((e) => next.delete(e.entityId));
    setSelectedEntityIds(next);
  };

  // Save customization to backend
  const handleSave = async () => {
    if (!selectedDeviceToken) return;
    try {
      setSaving(true);
      setSaveSuccess(false);

      const res = await fetch(`https://api.quazlink.site/api/tv/devices/${selectedDeviceToken}/customize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedEntities: Array.from(selectedEntityIds),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        // Refresh devices list to update count
        fetchDevices();
      }
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  };

  // Live test toggle from browser
  const handleTestToggle = async (entity: HaEntity) => {
    setTogglingEntity(entity.entityId);
    try {
      const res = await fetch("https://api.quazlink.site/api/tv/device/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-token": selectedDeviceToken,
        },
        body: JSON.stringify({ entityId: entity.entityId }),
      });
      if (res.ok) {
        // Toggle locally
        setEntities((prev) =>
          prev.map((e) =>
            e.entityId === entity.entityId
              ? { ...e, isOn: !e.isOn, state: !e.isOn ? "on" : "off" }
              : e
          )
        );
      }
    } catch (err) {
      console.error("Test toggle failed", err);
    } finally {
      setTogglingEntity(null);
    }
  };

  // Filtering
  const filteredEntities = entities.filter((item) => {
    const matchesTab = activeTab === "all" || item.category === activeTab;
    const matchesQuery =
      searchQuery.trim() === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.entityId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesQuery;
  });

  const selectedCount = selectedEntityIds.size;
  const currentTv = devices.find((d) => d.deviceToken === selectedDeviceToken);

  return (
    <div
      className={`relative min-h-screen w-full flex flex-col items-center bg-[#060913] text-white overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-300 pb-28 ${
        isAr ? "font-cairo" : ""
      }`}
      dir={isAr ? "rtl" : "ltr"}
    >
      <NebulaBackground />
      <StarField />
      <LanguageSwitcher variant="floating" />

      {/* Header */}
      <header className="relative z-20 w-full max-w-6xl px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/10">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-md group-hover:scale-110 transition-transform"></div>
            <img src="/logo.png" alt="QuazLink" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
              Quaz<span className="text-cyan-400">Link</span>
            </span>
            <span className="text-[10px] font-mono text-gray-400 uppercase">Smart Home & TV Manager</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/tv/pair"
            className="px-3.5 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-semibold text-cyan-300 transition-all flex items-center gap-1.5"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>{isAr ? "ربط شاشة جديدة" : "Pair New TV"}</span>
          </Link>
          <Link
            href="/tv"
            className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <span>{isAr ? "صفحة التطبيق" : "TV Page"}</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-6xl px-4 sm:px-6 pt-8 pb-12">
        {/* Title & Description */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? "بوابة التحكم في واجهة التلفزيون الذكي" : "Smart TV Remote Customization Hub"}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-2">
            {isAr ? "تخصيص أجهزة وأزرار شاشة التلفزيون" : "Customize TV Remote Entities & Buttons"}
          </h1>
          <p className="text-sm sm:text-base text-gray-400 max-w-2xl">
            {isAr
              ? "اختر الأجهزة والمفاتيح والتكييفات التي ترغب بظهورها في القائمة العائمة (Overlay) على شاشة التلفزيون؛ لتحصل على واجهة سريعة وخالية من الفوضى."
              : "Select which lights, switches, AC units, and scenes appear in your TV overlay for a clutter-free 10-foot remote experience."}
          </p>
        </div>

        {/* TV Device Selector Card */}
        {devices.length === 0 && !loading ? (
          <div className="p-8 rounded-2xl bg-[#0B101D]/80 border border-white/10 text-center mb-8">
            <Tv className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">
              {isAr ? "لا توجد شاشات تلفزيون مربوطة حالياً" : "No Paired TVs Found"}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {isAr ? "قم بتثبيت تطبيق QuazHome TV على الشاشة وامسح الـ QR للربط." : "Install QuazHome TV on your TV and scan QR to pair."}
            </p>
            <Link
              href="/tv/pair"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 transition-all"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>{isAr ? "ربط شاشة الآن" : "Pair a TV Now"}</span>
            </Link>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-[#0B101D]/80 border border-white/10 mb-8 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                <Tv className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    {currentTv?.name || (isAr ? "شاشة التلفزيون" : "Smart TV")}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Online
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  Home Assistant: <span className="text-cyan-300">{currentTv?.haUrl}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchEntities(selectedDeviceToken)}
                disabled={loadingEntities}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingEntities ? "animate-spin" : ""}`} />
                <span>{isAr ? "تحديث الأجهزة الحية" : "Refresh States"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter Controls & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#0B101D]/90 border border-white/10 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "all" ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20" : "text-gray-400 hover:text-white"
              }`}
            >
              {isAr ? "الكل" : "All"} ({entities.length})
            </button>
            <button
              onClick={() => setActiveTab("lights")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "lights" ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20" : "text-gray-400 hover:text-white"
              }`}
            >
              <Lamp className="w-3.5 h-3.5" />
              <span>{isAr ? "الإضاءة" : "Lights"}</span>
              <span className="opacity-70">({entities.filter((e) => e.category === "lights").length})</span>
            </button>
            <button
              onClick={() => setActiveTab("switches")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "switches" ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20" : "text-gray-400 hover:text-white"
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isAr ? "المفاتيح والأجهزة" : "Switches"}</span>
              <span className="opacity-70">({entities.filter((e) => e.category === "switches").length})</span>
            </button>
            <button
              onClick={() => setActiveTab("climate")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "climate" ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20" : "text-gray-400 hover:text-white"
              }`}
            >
              <Fan className="w-3.5 h-3.5" />
              <span>{isAr ? "التكييف" : "Climate"}</span>
              <span className="opacity-70">({entities.filter((e) => e.category === "climate").length})</span>
            </button>
            <button
              onClick={() => setActiveTab("scenes")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "scenes" ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20" : "text-gray-400 hover:text-white"
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>{isAr ? "السيناريوهات" : "Scenes"}</span>
              <span className="opacity-70">({entities.filter((e) => e.category === "scenes").length})</span>
            </button>
          </div>

          {/* Search Bar & Quick Select */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? "بحث في الأجهزة..." : "Search entities..."}
                className="w-44 sm:w-56 pl-8 pr-3 rtl:pl-3 rtl:pr-8 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={selectAllCurrent}
              title={isAr ? "تحديد كل المعروض" : "Select all visible"}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-cyan-300 font-semibold cursor-pointer"
            >
              {isAr ? "تحديد الكل" : "Select All"}
            </button>
            <button
              onClick={deselectAllCurrent}
              title={isAr ? "إلغاء تحديد المعروض" : "Deselect visible"}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-400 hover:text-white font-semibold cursor-pointer"
            >
              {isAr ? "إلغاء" : "Clear"}
            </button>
          </div>
        </div>

        {/* Entities Grid */}
        {loadingEntities ? (
          <div className="py-20 flex flex-col items-center justify-center text-cyan-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-xs text-gray-400">
              {isAr ? "جاري جلب أجهزة Home Assistant الحية..." : "Loading live Home Assistant entities..."}
            </p>
          </div>
        ) : filteredEntities.length === 0 ? (
          <div className="py-16 text-center text-gray-500 bg-[#0B101D]/40 rounded-2xl border border-white/5">
            <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">{isAr ? "لا توجد أجهزة مطابقة لخيارات البحث" : "No matching entities found"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEntities.map((entity) => {
              const isChecked = selectedEntityIds.has(entity.entityId);
              return (
                <div
                  key={entity.entityId}
                  onClick={() => toggleSelect(entity.entityId)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isChecked
                      ? "bg-cyan-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/5"
                      : "bg-[#0B101D]/70 border-white/10 hover:border-white/20 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isChecked
                          ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                          : "bg-white/5 text-gray-400"
                      }`}
                    >
                      {entity.category === "lights" ? (
                        <Lamp className="w-4 h-4" />
                      ) : entity.category === "switches" ? (
                        <Power className="w-4 h-4" />
                      ) : entity.category === "climate" ? (
                        <Fan className="w-4 h-4" />
                      ) : (
                        <Film className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{entity.name}</h4>
                      <p className="text-[10px] text-gray-500 font-mono truncate">{entity.entityId}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Live State Badge */}
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase border ${
                        entity.isOn
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                          : "bg-white/5 border-white/10 text-gray-400"
                      }`}
                    >
                      {entity.state}
                    </span>

                    {/* Test Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleTestToggle(entity)}
                      disabled={togglingEntity === entity.entityId}
                      title={isAr ? "تجربة تشغيل/إطفاء الزرار" : "Test Toggle"}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                    >
                      {togglingEntity === entity.entityId ? (
                        <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                      ) : (
                        <Power className="w-3 h-3" />
                      )}
                    </button>

                    {/* Custom Checkbox */}
                    <div
                      onClick={() => toggleSelect(entity.entityId)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all ${
                        isChecked
                          ? "bg-cyan-500 border-cyan-500 text-black"
                          : "border-white/30 hover:border-cyan-400"
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Save Action Bar */}
      <div className="fixed bottom-6 inset-x-0 z-50 flex items-center justify-center px-4 pointer-events-none">
        <div className="w-full max-w-2xl p-3 sm:p-4 rounded-2xl bg-[#0B101D]/95 border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 backdrop-blur-xl flex items-center justify-between gap-4 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                {isAr
                  ? `تم تحديد ${selectedCount} من أصل ${entities.length} جهاز لشاشة التلفزيون`
                  : `${selectedCount} of ${entities.length} entities selected for TV`}
              </p>
              <p className="text-[10px] text-gray-400">
                {isAr ? "ستظهر هذه الأجهزة فقط في القائمة العائمة بالريموت" : "Only these will show on the TV remote overlay"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isAr ? "تم الحفظ!" : "Saved!"}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="py-2.5 px-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>{isAr ? "جاري الحفظ..." : "Saving..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{isAr ? "حفظ التخصيص لشاشة التلفزيون ✨" : "Save for TV ✨"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
