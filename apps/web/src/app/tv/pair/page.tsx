"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tv,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Home,
  Key,
  Globe
} from "lucide-react";
import { StarField } from "@/components/effects/StarField";
import { NebulaBackground } from "@/components/effects/NebulaBackground";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useLanguage } from "@/context/LanguageContext";

export default function TvPairingPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#060913] flex items-center justify-center text-cyan-400">Loading pairing portal...</div>}>
      <TvPairingContent />
    </React.Suspense>
  );
}

function TvPairingContent() {
  const { lang, isAr } = useLanguage();
  const searchParams = useSearchParams();

  const [code, setCode] = React.useState("");
  const [haUrl, setHaUrl] = React.useState("");
  const [haToken, setHaToken] = React.useState("");
  const [tvName, setTvName] = React.useState("شاشة الصالة الرئيسية (TV)");

  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [pairedSuccess, setPairedSuccess] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    const queryCode = searchParams.get("code");
    if (queryCode) {
      setCode(queryCode.toUpperCase().trim());
    }
  }, [searchParams]);

  const handleTestConnection = async () => {
    if (!haUrl.trim() || !haToken.trim()) {
      setTestResult({
        success: false,
        message: isAr ? "يرجى كتابة رابط Home Assistant والتوكن أولاً" : "Please enter Home Assistant URL and Token first"
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch("https://api.quazlink.site/api/tv/pair/test-ha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ haUrl, haToken })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: isAr ? "تم الاتصال بنجاح بسيرفر Home Assistant! 🚀" : "Successfully connected to Home Assistant! 🚀"
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || (isAr ? "فشل الاتصال بـ Home Assistant" : "Failed to connect to Home Assistant")
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || (isAr ? "تعذر الوصول إلى الرابط" : "Could not reach domain")
      });
    } finally {
      setTesting(false);
    }
  };

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !haUrl.trim() || !haToken.trim()) {
      setErrorMsg(isAr ? "يرجى استكمال جميع الحقول" : "Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("https://api.quazlink.site/api/tv/pair/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          haUrl: haUrl.trim(),
          haToken: haToken.trim(),
          tvName: tvName.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPairedSuccess(true);
      } else {
        setErrorMsg(data.error || (isAr ? "فشل تأكيد الاقتران. تأكد من صحة كود التلفزيون." : "Pairing failed. Verify TV code."));
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isAr ? "حدث خطأ أثناء الاتصال بالسيرفر" : "Network error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`relative min-h-screen w-full flex flex-col items-center justify-center bg-[#060913] text-white overflow-x-hidden p-4 sm:p-6 selection:bg-cyan-500/20 selection:text-cyan-300 ${isAr ? "font-cairo" : ""}`} dir={isAr ? "rtl" : "ltr"}>
      <NebulaBackground />
      <StarField />
      <LanguageSwitcher variant="floating" />

      {/* Header */}
      <header className="relative z-20 w-full max-w-lg mb-8 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="relative w-9 h-9 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-md group-hover:scale-110 transition-transform"></div>
            <img src="/logo.png" alt="QuazLink" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-base font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
              Quaz<span className="text-cyan-400">Link</span>
            </span>
            <span className="text-[9px] font-mono text-gray-400 uppercase">Smart TV & IoT Hub</span>
          </div>
        </Link>
        <Link href="/tv" className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
          <span>{isAr ? "صفحة التطبيق" : "TV Page"}</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </header>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-lg">
        <AnimatePresence mode="wait">
          {pairedSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-[#0B101D]/90 border border-emerald-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-emerald-500/10 text-center backdrop-blur-xl"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {isAr ? "تم ربط التلفزيون بنجاح! ✨" : "TV Linked Successfully! ✨"}
              </h2>
              <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                {isAr
                  ? "شاشة التلفزيون الخاصة بك متصلة الآن بسيرفر Home Assistant. يمكنك استخدام القائمة العائمة (Overlay) بالريموت للتحكم في الإضاءة والمكيفات والسيناريوهات فوراً!"
                  : "Your TV is now live with Home Assistant OS. You can toggle lights, climate, and scenes directly from your remote overlay!"}
              </p>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 mb-6 font-mono">
                {isAr ? "كود الشاشة:" : "TV Code:"} <span className="text-cyan-300 font-bold text-sm">{code}</span>
              </div>
              <Link
                href="/tv"
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-cyan-500 text-black font-bold text-sm hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
              >
                <span>{isAr ? "العودة لبوابة QuazHome TV" : "Back to TV Portal"}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-[#0B101D]/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-500/5 backdrop-blur-xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white">
                    {isAr ? "ربط شاشة التلفزيون بـ Home Assistant" : "Pair TV with Home Assistant"}
                  </h1>
                  <p className="text-xs text-gray-400">
                    {isAr ? "تحكم في منزلك الذكي من شاشة التلفزيون عبر QuazHome" : "Control your smart home directly from Android TV"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleAuthorize} className="space-y-4">
                {/* TV Code */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isAr ? "كود التلفزيون (Pairing Code)" : "TV Pairing Code"}</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="QL-XXXX"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-cyan-500 uppercase transition-all"
                  />
                </div>

                {/* Home Assistant URL */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isAr ? "عنوان دومين Home Assistant الخاص بك" : "Home Assistant URL / Domain"}</span>
                  </label>
                  <input
                    type="text"
                    value={haUrl}
                    onChange={(e) => setHaUrl(e.target.value)}
                    placeholder="https://ha.yourdomain.com"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-sm focus:outline-none focus:border-cyan-500 font-mono transition-all"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    {isAr ? "الدومين الخارجي الآمن أو الآي بي المحلي لسيرفر Home Assistant" : "External HTTPS domain or local LAN IP"}
                  </span>
                </div>

                {/* Home Assistant Long-Lived Token */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isAr ? "رمز الوصول الدائم (Long-Lived Access Token)" : "Long-Lived Access Token"}</span>
                  </label>
                  <textarea
                    value={haToken}
                    onChange={(e) => setHaToken(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    rows={2}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono transition-all resize-none"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    {isAr ? "من داخل Home Assistant > اضغط على بروفايلك > أنشئ Long-Lived Access Token" : "Create from HA > Profile > Long-Lived Access Tokens"}
                  </span>
                </div>

                {/* Test Connection Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{isAr ? "جاري الفحص والاتصال..." : "Testing connection..."}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isAr ? "فحص الاتصال بـ Home Assistant الآن" : "Test Connection to Home Assistant"}</span>
                      </>
                    )}
                  </button>

                  {testResult && (
                    <div
                      className={`mt-2 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                        testResult.success
                          ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                          : "bg-red-500/10 border border-red-500/30 text-red-300"
                      }`}
                    >
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-sm shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>{isAr ? "جاري ربط وتأكيد التلفزيون..." : "Authorizing TV..."}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>{isAr ? "تأكيد وربط التلفزيون بالمنزل الذكي" : "Authorize & Link TV to Smart Home"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
