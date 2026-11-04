"use client";

import * as React from "react";
import { Laptop, Plus, RefreshCw, Trash2, CheckCircle2, ShieldCheck, Download, Copy, Moon, Zap, Key } from "lucide-react";
import { getDevices, createDevicePairing, updateDevice, deleteDevice, type DeviceItem } from "@/lib/api";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { useLanguage } from "@/context/LanguageContext";

export function DeviceManager() {
  const { isAr } = useLanguage();
  const [devices, setDevices] = React.useState<DeviceItem[]>([]);
  const [isOnline, setIsOnline] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [pairingData, setPairingData] = React.useState<{ pairingToken: string } | null>(null);
  const [creatingPair, setCreatingPair] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const data = await getDevices();
      setDevices(data.devices);
      setIsOnline(data.isOnline);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleGeneratePairing() {
    setCreatingPair(true);
    try {
      const res = await createDevicePairing("My Local PC");
      setPairingData({ pairingToken: res.pairingToken });
      await refresh();
    } catch (e: any) {
      alert(isAr ? "فشل إنشاء رمز الربط: " + e.message : "Failed to create pairing: " + e.message);
    } finally {
      setCreatingPair(false);
    }
  }

  async function handleToggleKeepAwake(device: DeviceItem) {
    try {
      await updateDevice(device.id, { keepAwake: !device.keepAwake });
      await refresh();
      setToastMsg(
        isAr
          ? `تم ${!device.keepAwake ? "تفعيل" : "تعطيل"} وضع اليقظة للجهاز ${device.name}`
          : `Keep-Awake ${!device.keepAwake ? "Enabled" : "Disabled"} for ${device.name}`
      );
      setTimeout(() => setToastMsg(null), 3000);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(isAr ? "هل أنت متأكد من رغبتك في إلغاء ربط هذا الجهاز؟" : "Are you sure you want to unpair this machine?")) return;
    try {
      await deleteDevice(id);
      await refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }

  function handleCopy(token: string) {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 space-x-2 text-cyan-400">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm font-mono">{isAr ? "جاري تحميل أجهزة الرانر..." : "Loading Desktop Runners..."}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Laptop className="w-5 h-5 text-cyan-400" />
            {isAr ? "برامج الرانر للكمبيوتر (Zero-Ban Desktop Runners)" : "Desktop Runners (Zero-Ban Execution)"}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {isAr
              ? "تحويل أجهزة الكمبيوتر المنزلية إلى نقاط أتمتة سكنية حقيقية للواتساب والمنصات بدون أي حظر."
              : "Connect your local desktop PCs as residential nodes to execute tasks from your real home IP safely."}
          </p>
        </div>

        <button
          onClick={handleGeneratePairing}
          disabled={creatingPair}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] flex items-center gap-2 self-start sm:self-auto cursor-pointer disabled:opacity-50"
        >
          {creatingPair ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span>{isAr ? "ربط جهاز جديد" : "Pair New Machine"}</span>
        </button>
      </div>

      {/* Runner Download Spotlight Card */}
      <SpotlightCard className="p-6 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-black to-[#050b14] space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-0.5 flex-shrink-0 shadow-[0_0_20px_rgba(34,211,238,0.4)]">
              <div className="w-full h-full bg-[#0b0f17] rounded-[14px] flex items-center justify-center">
                <img src="/logo.png" alt="QuazLink Runner" className="w-9 h-9 object-contain" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base font-bold text-white">QuazLink Desktop Runner</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  v26.9.5 Official Release
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Windows 10 / 11
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed max-w-xl">
                {isAr
                  ? "برنامج الأتمتة المكتبي الرسمي لمنصة QuazLink. يتم تثبيته على جهازك لتنفيذ مهام الواتساب وفيسبوك وإنستغرام من اتصالك المنزلي الحقيقي بنسبة أمان 100% وبدون أي حظر."
                  : "The official desktop automation daemon for QuazLink. Runs stealth browser tasks directly on your PC from your residential IP with zero cloud ban risk."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto flex-shrink-0">
            <a
              href="/downloads/QuazLink-Runner-Setup.exe"
              download="QuazLink-Runner-Setup.exe"
              className="px-5 py-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-[0_0_25px_rgba(34,211,238,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.6)] transition-all flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isAr ? "تحميل البرنامج للكمبيوتر (Installer .exe)" : "Download Runner (Installer .exe)"}</span>
            </a>

            <a
              href="quazlink://open"
              className="px-4 py-3 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title={isAr ? "فتح البرنامج إذا كان مثبتاً بالفعل على جهازك" : "Launch app if already installed on your PC"}
            >
              <Laptop className="w-4 h-4 text-cyan-400" />
              <span>{isAr ? "تشغيل البرنامج المثبت" : "Launch Installed App"}</span>
            </a>
          </div>
        </div>

        {/* 3 Steps Guide */}
        <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold flex items-center justify-center text-xs flex-shrink-0">
              1
            </span>
            <span className="text-gray-300">
              {isAr ? (
                <>حمّل وشغّل ملف التثبيت <strong>.exe</strong> (تثبيت تلقائي في 5 ثوانٍ)</>
              ) : (
                <>Download and run the <strong>.exe</strong> setup (auto-installs in 5s)</>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold flex items-center justify-center text-xs flex-shrink-0">
              2
            </span>
            <span className="text-gray-300">
              {isAr ? (
                <>اضغط <strong>Open &amp; Auto-Pair</strong> لربط جهازك بحسابك فورياً</>
              ) : (
                <>Click <strong>Open &amp; Auto-Pair</strong> to pair your PC instantly</>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold flex items-center justify-center text-xs flex-shrink-0">
              3
            </span>
            <span className="text-gray-300">
              {isAr ? (
                <>يبدأ الرانر العمل في الخلفية وينفذ مهام الواتساب تلقائياً 🚀</>
              ) : (
                <>Runner runs silently in background executing workflows safely 🚀</>
              )}
            </span>
          </div>
        </div>
      </SpotlightCard>

      {/* Pairing Code Card */}
      {pairingData && (
        <SpotlightCard className="p-5 rounded-2xl border border-cyan-500/40 bg-cyan-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Key className="w-4 h-4" />
              {isAr ? "كود الربط لمرة واحدة (One-Time Pairing Code)" : "Machine Pairing Code (One-Time)"}
            </span>
            <button
              onClick={() => setPairingData(null)}
              className="text-xs text-gray-400 hover:text-white cursor-pointer"
            >
              {isAr ? "إغلاق" : "Dismiss"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2 bg-black/60 border border-white/15 rounded-xl font-mono text-xl font-bold text-white tracking-widest">
              {pairingData.pairingToken}
            </div>
            <button
              onClick={() => handleCopy(pairingData.pairingToken)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              <span>{copied ? (isAr ? "تم النسخ!" : "Copied!") : (isAr ? "نسخ الكود" : "Copy Code")}</span>
            </button>
            <a
              href={`quazlink://pair?token=${pairingData.pairingToken}`}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.4)]"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              <span>{isAr ? "⚡ فتح وتوصيل البرنامج تلقائياً" : "⚡ Open & Auto-Pair App"}</span>
            </a>
          </div>
          <p className="text-[11px] text-gray-400">
            {isAr ? (
              <>اضغط <strong>Open &amp; Auto-Pair</strong> لتشغيل البرنامج والربط بنقرة واحدة، أو الصق الكود داخل تطبيق الرانر يدوياً.</>
            ) : (
              <>Click <strong>Open &amp; Auto-Pair</strong> to launch the Runner app directly on your PC, or copy this code into the desktop app manually.</>
            )}
          </p>
        </SpotlightCard>
      )}

      {/* Devices List */}
      {devices.length === 0 && !pairingData ? (
        <div className="p-10 rounded-2xl border border-dashed border-white/10 text-center flex flex-col items-center justify-center space-y-3">
          <Laptop className="w-10 h-10 text-gray-600" />
          <h4 className="text-sm font-semibold text-white">
            {isAr ? "لا توجد أجهزة كمبيوتر مربوطة حتى الآن" : "No Machines Paired Yet"}
          </h4>
          <p className="text-xs text-gray-500 max-w-sm">
            {isAr
              ? "قم بربط جهاز الكمبيوتر لتنفيذ المهام من اتصالك الحقيقي بأمان تام وبدون أي حظر."
              : "Pair your computer to let QuazLink automate workflows from your residential IP with zero ban risk."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              onClick={handleGeneratePairing}
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl text-xs hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5 text-black" />
              <span>{isAr ? "إنشاء رمز الربط" : "Generate Pairing Code"}</span>
            </button>
            <a
              href="quazlink://open"
              className="px-4 py-2.5 bg-white/10 border border-white/15 text-white rounded-xl text-xs font-semibold hover:bg-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Laptop className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isAr ? "تشغيل برنامج الرانر على الكمبيوتر" : "Open Runner App on PC"}</span>
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((device) => {
            const isDeviceOnline = device.status === "online";
            return (
              <SpotlightCard
                key={device.id}
                className="p-5 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] hover:border-cyan-500/30 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${isDeviceOnline ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-gray-500/10 border-gray-500/30 text-gray-400"}`}>
                        <Laptop className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                          {device.name}
                        </h4>
                        <span className="text-[10px] font-mono text-gray-500">
                          {device.platform.toUpperCase()} Node
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border flex items-center gap-1 ${isDeviceOnline ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-gray-500/10 border-gray-500/30 text-gray-400"}`}>
                        {isDeviceOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                        <span className="capitalize">
                          {isDeviceOnline
                            ? isAr ? "متصل" : "Online"
                            : isAr ? "غير متصل" : "Offline"}
                        </span>
                      </span>
                      <button
                        onClick={() => handleDelete(device.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title={isAr ? "إلغاء ربط الجهاز" : "Unpair machine"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    {device.lastHeartbeat
                      ? isAr
                        ? `آخر ظهور: ${new Date(device.lastHeartbeat).toLocaleTimeString()}`
                        : `Last active: ${new Date(device.lastHeartbeat).toLocaleTimeString()}`
                      : isAr ? "في انتظار الاتصال..." : "Awaiting connection..."}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleToggleKeepAwake(device)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      device.keepAwake
                        ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      {isAr
                        ? `وضع اليقظة: ${device.keepAwake ? "مفعّل" : "معطّل"}`
                        : `Keep Awake: ${device.keepAwake ? "ON" : "OFF"}`}
                    </span>
                  </button>

                  <span className="text-[11px] text-gray-500 font-mono">
                    {isAr ? "حماية Zero-Ban نشطة" : "Zero-Ban Active"}
                  </span>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
