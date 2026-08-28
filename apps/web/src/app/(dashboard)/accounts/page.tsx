"use client";

import * as React from "react";
import { Plus, Loader2, Trash2, RefreshCw, Users, Globe, X, Sparkles, CheckCircle2, Laptop } from "lucide-react";
import { getAccounts, connectAccount, deleteAccount, redetectPages, type Account } from "@/lib/api";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

interface PlatformConfig {
  name: string;
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGradient: string;
  borderClass: string;
  description: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: "facebook",
    name: "Facebook",
    icon: FacebookIcon,
    color: "text-blue-400",
    bgGradient: "from-blue-600/20 to-blue-900/10",
    borderClass: "border-blue-500/30",
    description: "Connect Facebook personal profiles and managed business pages.",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: InstagramIcon,
    color: "text-pink-400",
    bgGradient: "from-pink-600/20 via-purple-600/20 to-orange-500/10",
    borderClass: "border-pink-500/30",
    description: "Automate Instagram carousel posts, reels, and stories.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: TikTokIcon,
    color: "text-cyan-400",
    bgGradient: "from-cyan-500/20 via-black to-pink-500/20",
    borderClass: "border-cyan-500/30",
    description: "Publish video ads, captions, and product promotions to TikTok.",
  },
];

export default function AccountsPage() {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [connectingPlatform, setConnectingPlatform] = React.useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = React.useState(false);
  const [redetectingId, setRedetectingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<string>("all");
  const [showOfflineWarning, setShowOfflineWarning] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      setAccounts(await getAccounts());
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  const anyConnecting = accounts.some((a) => a.status === "connecting");

  async function handleConnect(platformId: string) {
    try {
      const { getDevices } = await import("@/lib/api");
      const data = await getDevices();
      if (!data.isOnline) {
        setShowConnectModal(false);
        setShowOfflineWarning(true);
        return;
      }
    } catch (e: any) {
      setError("Could not verify runner status.");
      return;
    }

    setShowConnectModal(false);
    setError(null);
    setConnectingPlatform(platformId);
    try {
      await connectAccount(platformId);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConnectingPlatform(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to disconnect this account?")) return;
    try {
      await deleteAccount(id);
      await refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleRedetect(id: string) {
    setError(null);
    setRedetectingId(id);
    try {
      await redetectPages(id);
      setTimeout(() => setRedetectingId((cur) => (cur === id ? null : cur)), 22000);
    } catch (e: any) {
      setError(e.message);
      setRedetectingId(null);
    }
  }

  const filteredAccounts = accounts.filter((a) => {
    if (filter === "all") return true;
    return a.platform.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="flex flex-col space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="w-8 h-8 text-[var(--color-quaz-cyan)]" />
            Social Accounts &amp; Channels
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Connect and manage multi-platform sessions for Facebook, Instagram, and TikTok.
          </p>
        </div>
        <button
          onClick={() => setShowConnectModal(true)}
          disabled={connectingPlatform !== null}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
        >
          {connectingPlatform ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Plus className="w-4 h-4 text-black" />}
          <span>+ Connect Social Account</span>
        </button>
      </div>

      {(connectingPlatform || anyConnecting) && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 flex items-center gap-3 text-sm animate-pulse shadow-lg">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400 flex-shrink-0" />
          <span>المتصفح هيفتح — سجّل دخولك على حسابك وسيبه، والمنصة هتكمّل لوحدها وتحفظ الجلسة. الكارت هيتحوّل لـ active أوتوماتيك.</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Platform Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-white/10 pb-3">
        {["all", "facebook", "instagram", "tiktok"].map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              filter === p
                ? "bg-white/10 text-white border border-white/10 shadow-sm"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {p === "all" ? `All Channels (${accounts.length})` : p}
          </button>
        ))}
      </div>

      {filteredAccounts.length === 0 ? (
        <div className="p-16 rounded-2xl border border-dashed border-white/10 text-center flex flex-col items-center justify-center space-y-4">
          <div className="flex -space-x-2">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FacebookIcon className="w-6 h-6" />
            </div>
            <div className="w-12 h-12 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <InstagramIcon className="w-6 h-6" />
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <TikTokIcon className="w-6 h-6" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">No Connected Accounts Found</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
              Connect your Facebook, Instagram, or TikTok account to start automated marketing and posting.
            </p>
          </div>
          <button
            onClick={() => setShowConnectModal(true)}
            className="px-5 py-2.5 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-semibold rounded-xl hover:bg-cyan-500/30 transition-all cursor-pointer"
          >
            Connect First Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAccounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              onDelete={() => handleDelete(a.id)}
              onRedetect={() => handleRedetect(a.id)}
              redetecting={redetectingId === a.id}
            />
          ))}
        </div>
      )}

      {/* Platform Selector Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg flex flex-col bg-[var(--color-quaz-bg)] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                Select Platform to Connect
              </h2>
              <button
                onClick={() => setShowConnectModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {PLATFORMS.map((platform) => {
                const Icon = platform.icon;
                return (
                  <button
                    key={platform.id}
                    onClick={() => handleConnect(platform.id)}
                    className="w-full p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-500/40 transition-all flex items-center justify-between group cursor-pointer text-left"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${platform.bgGradient} border ${platform.borderClass} flex items-center justify-center ${platform.color} group-hover:scale-105 transition-transform`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base group-hover:text-cyan-300 transition-colors">
                          {platform.name}
                        </h4>
                        <p className="text-xs text-gray-400 mt-0.5">{platform.description}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-white/10 text-white group-hover:bg-cyan-500 group-hover:text-black transition-all">
                      Connect
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Offline Runner Warning Modal */}
      {showOfflineWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md flex flex-col bg-[var(--color-quaz-bg)] border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-red-500/20 flex justify-between items-center bg-red-500/10">
              <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                <Laptop className="w-5 h-5" />
                Runner Offline
              </h2>
              <button
                onClick={() => setShowOfflineWarning(false)}
                className="p-1 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-300 text-sm">
                Your QuazLink Desktop Runner is currently offline. You must start the runner on your local computer before connecting a new social account.
              </p>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-2">
                <p className="text-xs text-gray-400 font-semibold">To start the runner, run this in your terminal:</p>
                <code className="block bg-black p-2 rounded text-cyan-400 text-xs font-mono border border-white/10 select-all">
                  cd apps/desktop-agent<br/>npm run dev
                </code>
              </div>
              <button
                onClick={() => setShowOfflineWarning(false)}
                className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-xl transition-colors mt-2 border border-red-500/40 cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  connecting: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  error: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
};

function AccountCard({
  account,
  onDelete,
  onRedetect,
  redetecting,
}: {
  account: Account;
  onDelete: () => void;
  onRedetect: () => void;
  redetecting: boolean;
}) {
  const style = STATUS_STYLES[account.status] || { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/30" };
  const destinations = account.destinations || [];
  const pageCount = Math.max(0, destinations.length - 1);
  const isFb = account.platform.toLowerCase() === "facebook";
  const isIg = account.platform.toLowerCase() === "instagram";
  const isTt = account.platform.toLowerCase() === "tiktok";

  const PlatformIcon = isIg ? InstagramIcon : isTt ? TikTokIcon : FacebookIcon;
  const platformColor = isIg ? "text-pink-400 bg-pink-600/20 border-pink-500/30" : isTt ? "text-cyan-400 bg-cyan-600/20 border-cyan-500/30" : "text-blue-400 bg-blue-600/20 border-blue-500/30";

  return (
    <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] hover:border-cyan-500/30 transition-all flex flex-col justify-between space-y-6 group">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center group-hover:scale-105 transition-transform ${platformColor}`}>
            <PlatformIcon className="w-6 h-6" />
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 text-xs font-semibold rounded-full border flex items-center gap-1.5 ${style.bg} ${style.text} ${style.border}`}>
              {account.status === "active" && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
              {account.status === "connecting" && <Loader2 className="w-3 h-3 animate-spin" />}
              <span className="capitalize">{account.status}</span>
            </span>
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
              title="Disconnect account"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-lg text-white capitalize flex items-center gap-2">
            {account.platform} Profile
          </h3>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            ID: {account.id.slice(0, 12)}...
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {account.lastUsedAt
              ? `Last active: ${new Date(account.lastUsedAt).toLocaleString()}`
              : "Ready for deployment"}
          </p>
        </div>

        {/* Destinations / Targets */}
        {destinations.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
            <span className="text-[11px] font-semibold uppercase text-gray-400 flex items-center gap-1">
              <Globe className="w-3 h-3 text-cyan-400" />
              Connected Targets ({destinations.length})
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {destinations.map((d, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-black/40 text-[11px] text-gray-300 border border-white/5 truncate max-w-full"
                  title={d.url}
                >
                  {d.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {isFb && account.status === "active" && (
        <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400" dir="auto">
            {redetecting
              ? "بيدوّر على الصفحات..."
              : pageCount > 0
              ? `${pageCount} صفحة + البروفايل`
              : "مفيش صفحات لسه"}
          </span>
          <button
            onClick={onRedetect}
            disabled={redetecting}
            title="Re-detect pages using the saved session"
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white hover:bg-cyan-500/20 hover:border-cyan-500/40 hover:text-cyan-300 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${redetecting ? "animate-spin" : ""}`} />
            <span>Re-detect</span>
          </button>
        </div>
      )}
    </SpotlightCard>
  );
}
