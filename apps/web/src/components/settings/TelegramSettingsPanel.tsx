"use client";

import * as React from "react";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Check,
  Radio,
  HelpCircle,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import {
  getTelegramSettings,
  updateTelegramSettings,
  testTelegramSettings,
  type TelegramSettingsData,
} from "@/lib/api";

export function TelegramSettingsPanel() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [settings, setSettings] = React.useState<TelegramSettingsData | null>(null);

  const [botToken, setBotToken] = React.useState("");
  const [chatId, setChatId] = React.useState("");
  const [isEnabled, setIsEnabled] = React.useState(false);
  const [notifyOnNew, setNotifyOnNew] = React.useState(true);
  const [showToken, setShowToken] = React.useState(false);

  const [toast, setToast] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  React.useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await getTelegramSettings();
      if (res.settings) {
        setSettings(res.settings);
        setBotToken(res.settings.botToken || "");
        setChatId(res.settings.chatId || "");
        setIsEnabled(res.settings.isEnabled);
        setNotifyOnNew(res.settings.notifyOnNew);
      }
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Failed to load Telegram settings." });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToast(null);

    try {
      const res = await updateTelegramSettings({
        botToken: botToken.trim() || undefined,
        chatId: chatId.trim(),
        isEnabled,
        notifyOnNew,
        setupWebhook: true,
      });

      if (res.settings) {
        setSettings((prev) => ({ ...prev, ...res.settings } as any));
      }
      setToast({
        type: "success",
        message: "تم حفظ إعدادات تيليجرام وتفعيل الـ Webhook بنجاح! جاهز لاستقبال الرسائل والرد عليها.",
      });
      setTimeout(() => setToast(null), 5000);
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "تعذر حفظ إعدادات تيليجرام." });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!chatId.trim()) {
      setToast({ type: "error", message: "يرجى كتابة الـ Chat ID أولاً لإرسال رسالة الاختبار." });
      return;
    }
    setTesting(true);
    setToast(null);

    try {
      const res = await testTelegramSettings({
        botToken: botToken.trim() || undefined,
        chatId: chatId.trim(),
      });
      setToast({
        type: "success",
        message: res.message || "تم إرسال رسالة الاختبار بنجاح إلى التيليجرام الخاص بك!",
      });
      setTimeout(() => setToast(null), 5000);
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "فشل إرسال رسالة الاختبار، تأكد من صحة التوكن ورقم الشات." });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <SpotlightCard className="p-8 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3 text-cyan-400">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-xs font-mono">Loading Telegram Integration...</span>
        </div>
      </SpotlightCard>
    );
  }

  return (
    <SpotlightCard className="p-6 md:p-8 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] space-y-6 shadow-2xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#229ED9]/20 border border-[#229ED9]/40 flex items-center justify-center text-[#229ED9] shadow-[0_0_15px_rgba(34,158,217,0.25)] shrink-0">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">
                Telegram Bot Integration &amp; Instant Mobile Reply
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                isEnabled
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-gray-500/15 border-gray-500/30 text-gray-400"
              }`}>
                {isEnabled ? "ACTIVE" : "DISABLED"}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              استقبل كافة رسائل واستفسارات العملاء فورياً على هاتفك عبر تيليجرام مع إمكانية الرد المباشر بنظام الـ Reply.
            </p>
          </div>
        </div>

        {/* Live Webhook Endpoint status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-[11px] font-mono text-gray-400 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Webhook Ready</span>
        </div>
      </div>

      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-semibold shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
              : "bg-red-500/15 border-red-500/40 text-red-300"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-5">
        
        {/* Toggle Integrations Switch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#229ED9] rounded cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>تفعيل ربط تيليجرام (Enable Integration)</span>
              </span>
              <p className="text-[11px] text-gray-400 mt-0.5">
                تفعيل استقبال الرسائل والردود عبر بوت تيليجرام دون الحاجة لتسجيل الدخول للمنصة.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={notifyOnNew}
              onChange={(e) => setNotifyOnNew(e.target.checked)}
              className="mt-1 w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>إرسال إشعار فوري عند كل استفسار جديد</span>
              </span>
              <p className="text-[11px] text-gray-400 mt-0.5">
                يصلك إشعار فوري باسم العميل ورقمه وبريده ونص رسالته فور إرسالها من صفحة الـ Contact.
              </p>
            </div>
          </label>
        </div>

        {/* Inputs Section */}
        <div className="space-y-4">
          
          {/* Bot Token Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <span>Telegram Bot Token (توكن البوت)</span>
                <span className="text-red-400">*</span>
              </label>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#229ED9] hover:underline flex items-center gap-1 font-mono"
              >
                <span>احصل عليه من @BotFather</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                placeholder="123456789:ABCdefGhIjkLmNoPqRsTuVwXyZ..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 focus:border-[#229ED9] text-xs text-white placeholder-gray-500 font-mono focus:outline-none transition-colors pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-3 text-gray-400 hover:text-white transition-colors cursor-pointer"
                title={showToken ? "Hide Token" : "Show Token"}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              أنشئ بوتاً جديداً في تيليجرام عبر إرسال الأمر <code>/newbot</code> لحساب <strong>@BotFather</strong> ثم الصق التوكن هنا.
            </p>
          </div>

          {/* Admin Chat ID Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <span>Admin Chat ID (رقم الشات أو القناة الخاصة بك)</span>
                <span className="text-red-400">*</span>
              </label>
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#229ED9] hover:underline flex items-center gap-1 font-mono"
              >
                <span>معرفة رقمك عبر @userinfobot</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="text"
              placeholder="مثال: 987654321 أو -1001234567890"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 focus:border-[#229ED9] text-xs text-white placeholder-gray-500 font-mono focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              رقم الـ Chat ID الخاص بحسابك أو مجموعتك لاستقبال الإشعارات والرد منها.
            </p>
          </div>

          {/* Webhook URL Display (Read-Only) */}
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1.5 font-mono">
              Production Webhook Endpoint (يتم ربطه تلقائياً)
            </label>
            <input
              type="text"
              readOnly
              value={settings?.webhookUrl || "https://api.quazlink.site/api/telegram/webhook"}
              className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/5 text-[11px] text-gray-400 font-mono select-all focus:outline-none cursor-default"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || saving || !chatId.trim()}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-gray-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {testing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري إرسال الاختبار...</span>
              </>
            ) : (
              <>
                <Radio className="w-3.5 h-3.5 text-[#229ED9]" />
                <span>إرسال رسالة اختبار (Test Connection)</span>
              </>
            )}
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#229ED9] to-cyan-400 hover:from-[#1b8bc2] hover:to-cyan-300 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-[#229ED9]/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري الحفظ وتفعيل الويب هوك...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>حفظ وتفعيل بوت تيليجرام</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* How it Works / Instructions Box */}
      <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-gray-300 space-y-2.5">
        <div className="flex items-center gap-2 font-bold text-cyan-300">
          <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>كيف ترد على العملاء مباشرة من تيليجرام دون فتح المنصة؟</span>
        </div>
        <ol className="list-decimal list-inside space-y-1.5 text-gray-300 leading-relaxed font-sans pr-2">
          <li>
            عندما يقوم أي عميل بإرسال استفسار على المنصة، يرسل البوت رسالة فورية إلى شات تيليجرام تتضمن بياناته ورقم التذكرة.
          </li>
          <li>
            <strong>طريقة الرد السريع:</strong> ببساطة اسحب الرسالة واضغط <strong>Reply</strong> واكتب ردك.
          </li>
          <li>
            <strong>طريقة الأمر البديل:</strong> يمكنك إرسال <code>/reply &lt;ticket_id&gt; نص ردك هنا</code>.
          </li>
          <li>
            يقوم النظام فورياً بتسليم الرد لشاشة العميل في المنصة عبر الـ WebSocket بدون ريفريش، ويُسجل لك إشعار تأكيد الاستلام والمشاهدة!
          </li>
        </ol>
      </div>
    </SpotlightCard>
  );
}
