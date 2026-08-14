"use client";

import * as React from "react";
import { User, Shield, Key, Bell, CheckCircle2, Save, Sparkles, Lock, RefreshCw, Laptop } from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { DeviceManager } from "@/components/settings/DeviceManager";
import { getMe, type AuthUser } from "@/lib/api";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState<"profile" | "devices" | "security" | "api" | "notifications">("profile");
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    getMe().then((u) => {
      if (u) {
        setUser(u);
        setName(u.name || "");
        setEmail(u.email || "");
      }
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setToastMessage("Settings updated successfully!");
      setTimeout(() => setToastMessage(null), 3000);
    }, 800);
  }

  return (
    <div className="flex flex-col space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <User className="w-8 h-8 text-[var(--color-quaz-cyan)]" />
          Account &amp; System Settings
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage your personal profile, security credentials, API keys, and notification preferences.
        </p>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-3 text-sm shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-white/10 pb-4 overflow-x-auto scrollbar-none">
        {[
          { id: "profile", label: "Profile & Identity", icon: User },
          { id: "devices", label: "Desktop Runners (Zero-Ban)", icon: Laptop },
          { id: "security", label: "Security & Password", icon: Shield },
          { id: "api", label: "API Keys & Webhooks", icon: Key },
          { id: "notifications", label: "Notifications", icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === "devices" && (
        <SpotlightCard className="p-6 md:p-8 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-6 shadow-2xl">
          <DeviceManager />
        </SpotlightCard>
      )}

      {activeTab === "profile" && (
        <SpotlightCard className="p-6 md:p-8 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-6 shadow-2xl">
          <div className="flex items-center space-x-4 pb-6 border-b border-white/10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-xl font-bold text-black shadow-lg">
              {name ? name.slice(0, 2).toUpperCase() : "QL"}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{name || "User Profile"}</h3>
              <p className="text-xs text-gray-400">{email || "user@quazlink.local"}</p>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-mono border border-cyan-500/20">
                Administrator
              </span>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-400 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-400 transition-colors"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        </SpotlightCard>
      )}

      {activeTab === "security" && (
        <SpotlightCard className="p-6 md:p-8 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-6 shadow-2xl">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-cyan-400" />
              Password &amp; Security Controls
            </h3>
            <p className="text-xs text-gray-400 mt-1">Update your access password and session timeout settings.</p>
          </div>

          <form onSubmit={handleSave} className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Current Password</label>
              <input
                type="password"
                placeholder="••••••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">New Password</label>
              <input
                type="password"
                placeholder="••••••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-white/10 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all text-sm cursor-pointer"
            >
              Update Password
            </button>
          </form>
        </SpotlightCard>
      )}

      {activeTab === "api" && (
        <SpotlightCard className="p-6 md:p-8 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-6 shadow-2xl">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-400" />
              Developer API Keys
            </h3>
            <p className="text-xs text-gray-400 mt-1">Use these keys to trigger workflows remotely via webhooks or external applications.</p>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs text-gray-500 font-mono">LIVE_KEY_9921_PROD</span>
              <p className="text-sm text-white font-mono mt-0.5">ql_live_883f901192837482910293</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText("ql_live_883f901192837482910293");
                setToastMessage("API Key copied to clipboard!");
                setTimeout(() => setToastMessage(null), 2500);
              }}
              className="px-3.5 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg text-xs font-semibold hover:bg-cyan-500/20 transition-colors cursor-pointer"
            >
              Copy Key
            </button>
          </div>
        </SpotlightCard>
      )}

      {activeTab === "notifications" && (
        <SpotlightCard className="p-6 md:p-8 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-6 shadow-2xl">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-cyan-400" />
              Notification Channels
            </h3>
            <p className="text-xs text-gray-400 mt-1">Choose how and when you receive execution failure alerts.</p>
          </div>

          <div className="space-y-3">
            {[
              { title: "Email Alerts for Failed Runs", desc: "Send an email notification when a browser automation encounters a captcha or error." },
              { title: "Weekly Automation Summary", desc: "Receive a weekly summary of completed posts and active workflows." },
            ].map((item, i) => (
              <label key={i} className="flex items-start space-x-3 p-3.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                <input type="checkbox" defaultChecked={i === 0} className="mt-1 accent-cyan-500 rounded" />
                <div>
                  <span className="text-sm font-semibold text-white">{item.title}</span>
                  <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </SpotlightCard>
      )}
    </div>
  );
}
