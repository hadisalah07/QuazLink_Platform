"use client";

import * as React from "react";
import { Laptop, Plus, RefreshCw, Trash2, CheckCircle2, ShieldCheck, Download, Copy, Moon, Zap, Key } from "lucide-react";
import { getDevices, createDevicePairing, updateDevice, deleteDevice, type DeviceItem } from "@/lib/api";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

export function DeviceManager() {
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
      alert("Failed to create pairing: " + e.message);
    } finally {
      setCreatingPair(false);
    }
  }

  async function handleToggleKeepAwake(device: DeviceItem) {
    try {
      await updateDevice(device.id, { keepAwake: !device.keepAwake });
      await refresh();
      setToastMsg(`Keep-Awake ${!device.keepAwake ? "Enabled" : "Disabled"} for ${device.name}`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to unpair this machine?")) return;
    try {
      await deleteDevice(id);
      await refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Laptop className="w-5 h-5 text-cyan-400" />
            Local Desktop Runners (Zero-Ban Nodes)
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Automate social posting directly from your authentic residential IP and device session without cloud proxies.
          </p>
        </div>

        <button
          onClick={handleGeneratePairing}
          disabled={creatingPair}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl text-xs hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {creatingPair ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" /> : <Plus className="w-3.5 h-3.5 text-black" />}
          <span>+ Pair New Machine</span>
        </button>
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Pairing Code Card */}
      {pairingData && (
        <SpotlightCard className="p-5 rounded-2xl border border-cyan-500/40 bg-cyan-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Key className="w-4 h-4" />
              Machine Pairing Code (One-Time)
            </span>
            <button
              onClick={() => setPairingData(null)}
              className="text-xs text-gray-400 hover:text-white"
            >
              Dismiss
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
              <span>{copied ? "Copied!" : "Copy Code"}</span>
            </button>
            <a
              href={`quazlink://pair?token=${pairingData.pairingToken}`}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.4)]"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              <span>⚡ Open &amp; Auto-Pair App</span>
            </a>
          </div>
          <p className="text-[11px] text-gray-400">
            Click <strong>Open &amp; Auto-Pair</strong> to launch the Runner app directly on your PC, or copy this code into the desktop app manually.
          </p>
        </SpotlightCard>
      )}

      {/* Devices List */}
      {devices.length === 0 && !pairingData ? (
        <div className="p-10 rounded-2xl border border-dashed border-white/10 text-center flex flex-col items-center justify-center space-y-3">
          <Laptop className="w-10 h-10 text-gray-600" />
          <h4 className="text-sm font-semibold text-white">No Machines Paired Yet</h4>
          <p className="text-xs text-gray-500 max-w-sm">
            Pair your computer to let QuazLink automate Facebook, Instagram, and TikTok from your home IP with zero ban risk.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              onClick={handleGeneratePairing}
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl text-xs hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5 text-black" />
              <span>Generate Pairing Code</span>
            </button>
            <a
              href="quazlink://open"
              className="px-4 py-2.5 bg-white/10 border border-white/15 text-white rounded-xl text-xs font-semibold hover:bg-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Laptop className="w-3.5 h-3.5 text-cyan-400" />
              <span>Open Runner App on PC</span>
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
                        <span className="capitalize">{device.status}</span>
                      </span>
                      <button
                        onClick={() => handleDelete(device.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Unpair machine"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    {device.lastHeartbeat
                      ? `Last active: ${new Date(device.lastHeartbeat).toLocaleTimeString()}`
                      : "Awaiting connection..."}
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
                    <span>Keep Awake: {device.keepAwake ? "ON" : "OFF"}</span>
                  </button>

                  <span className="text-[11px] text-gray-500 font-mono">
                    Zero-Ban Active
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
