"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  MessageSquare,
  CheckCircle2,
  RefreshCw,
  Phone,
  Mail,
  User,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Store,
  Bot,
  Sparkles,
  CreditCard,
  Headphones,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Aurora } from "@/components/effects/Aurora";
import { submitContactMessage } from "@/lib/api";

type CategoryKey = "subscription_renewal" | "pos_support" | "runner_support" | "sales_inquiry" | "general";

export default function ContactPage() {
  const { lang, isAr } = useLanguage();
  const t = translations[lang];

  // Form State
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [category, setCategory] = React.useState<CategoryKey>("subscription_renewal");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successTicketId, setSuccessTicketId] = React.useState<string | null>(null);
  const [copiedTicket, setCopiedTicket] = React.useState(false);

  // Quick categories
  const categories: { key: CategoryKey; label: string; icon: any; defaultSubject: string }[] = [
    {
      key: "subscription_renewal",
      label: t.catSubscriptionRenewal || "Subscription Renewal",
      icon: CreditCard,
      defaultSubject: isAr ? "طلب تجديد اشتراك في منصة QuazLink" : "QuazLink Subscription Renewal Request",
    },
    {
      key: "pos_support",
      label: t.catPosSupport || "POS & Retail System",
      icon: Store,
      defaultSubject: isAr ? "استفسار بخصوص نظام الكاشير وطابعات الفواتير" : "Inquiry regarding QuazLink POS & Thermal Printers",
    },
    {
      key: "runner_support",
      label: t.catRunnerSupport || "Automation Runner",
      icon: Bot,
      defaultSubject: isAr ? "استفسار عن تطبيق الرانر وأتمتة الواتساب" : "Inquiry regarding QuazLink Runner & Automation",
    },
    {
      key: "sales_inquiry",
      label: t.catSalesInquiry || "Enterprise Sales",
      icon: Sparkles,
      defaultSubject: isAr ? "طلب عرض أسعار وتراخيص متعددة" : "Enterprise Sales & Multi-Branch Licensing Inquiry",
    },
    {
      key: "general",
      label: t.catGeneralSupport || "Technical Support",
      icon: Headphones,
      defaultSubject: isAr ? "استفسار عام / دعم فني" : "General Technical Support Inquiry",
    },
  ];

  const handleSelectCategory = (cat: CategoryKey, defSubject: string) => {
    setCategory(cat);
    if (!subject || categories.some((c) => c.defaultSubject === subject)) {
      setSubject(defSubject);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(isAr ? "يرجى كتابة الاسم بالكامل." : "Please enter your full name.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(isAr ? "يرجى كتابة بريد إلكتروني صالح." : "Please enter a valid email address.");
      return;
    }
    if (!subject.trim()) {
      setError(isAr ? "يرجى كتابة موضوع الرسالة." : "Please enter the subject.");
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setError(isAr ? "يرجى توضيح تفاصيل الطلب (10 أحرف على الأقل)." : "Please enter message details (minimum 10 characters).");
      return;
    }

    setLoading(true);
    try {
      const res = await submitContactMessage({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSuccessTicketId(res.messageId);
    } catch (err: any) {
      setError(err.message || (isAr ? "فشل إرسال الطلب، يرجى المحاولة لاحقاً." : "Failed to submit inquiry."));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setSubject("");
    setMessage("");
    setSuccessTicketId(null);
    setError(null);
  };

  const copyTicketId = () => {
    if (successTicketId) {
      navigator.clipboard.writeText(successTicketId);
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 2000);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-between overflow-x-hidden bg-[#060913] text-white">
      <Aurora />

      {/* Floating Language Switcher */}
      <LanguageSwitcher variant="floating" />

      {/* Top Header */}
      <header className="relative z-20 w-full max-w-6xl px-4 sm:px-6 pt-8 pb-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-cyan-500/40 transition-colors">
            <img src="/logo.png" alt="QuazLink Logo" className="w-6 h-6 object-contain" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-cyan-300 transition-colors">
            QuazLink
          </span>
        </Link>

        <Link
          href="/"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
        >
          {isAr ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
          <span>{t.contactBackHome || "Back to Home"}</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-4xl px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center flex-1">
        
        {/* Page Hero Header */}
        <div className="text-center max-w-2xl mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold mb-4 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Direct Platform Inquiries &amp; Support</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
            {t.contactTitle || "Contact & Platform Support"}
          </h1>

          <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
            {t.contactSubtitle || "Have a question, need to renew your subscription, or looking for technical assistance? Send your inquiry directly through the platform and our team will get back to you promptly."}
          </p>
        </div>

        {/* Form Container / Success Ticket State */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            {!successTicketId ? (
              <motion.div
                key="contact-form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="w-full rounded-3xl p-6 sm:p-10 bg-gradient-to-b from-[#0B1120]/90 to-[#070B16]/95 border border-white/10 backdrop-blur-2xl shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

                <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
                  
                  {/* Category Selection Chips */}
                  <div className="flex flex-col gap-2.5">
                    <label className={`text-xs font-bold text-gray-300 uppercase tracking-wider ${isAr ? "text-right" : "text-left"}`}>
                      {t.contactCategoryLabel || "Inquiry Type / Purpose"}
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {categories.map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = category === cat.key;
                        return (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => handleSelectCategory(cat.key, cat.defaultSubject)}
                            className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer ${
                              isSelected
                                ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-500/20 scale-[1.02]"
                                : "bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.06] hover:border-white/20"
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${isSelected ? "text-cyan-300" : "text-gray-400"}`} />
                            <span className="leading-snug">{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Name & Email Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className={`text-xs font-medium text-gray-300 flex items-center gap-1.5 ${isAr ? "flex-row-reverse" : ""}`}>
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{t.contactNameLabel || "Full Name"} *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t.contactNamePlaceholder || "e.g. Mohamed Salah"}
                        className={`w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors ${
                          isAr ? "text-right" : "text-left"
                        }`}
                      />
                    </div>

                    {/* Email */}
                    <div className="flex flex-col gap-1.5">
                      <label className={`text-xs font-medium text-gray-300 flex items-center gap-1.5 ${isAr ? "flex-row-reverse" : ""}`}>
                        <Mail className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{t.contactEmailLabel || "Email Address"} *</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t.contactEmailPlaceholder || "name@company.com"}
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors text-left"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Phone & Subject Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Phone */}
                    <div className="flex flex-col gap-1.5">
                      <label className={`text-xs font-medium text-gray-300 flex items-center gap-1.5 ${isAr ? "flex-row-reverse" : ""}`}>
                        <Phone className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{t.contactPhoneLabel || (isAr ? "رقم الهاتف للتواصل" : "Phone Number")}</span>
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t.contactPhonePlaceholder || "+20 10... or phone number"}
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors text-left"
                        dir="ltr"
                      />
                    </div>

                    {/* Subject */}
                    <div className="flex flex-col gap-1.5">
                      <label className={`text-xs font-medium text-gray-300 flex items-center gap-1.5 ${isAr ? "flex-row-reverse" : ""}`}>
                        <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{t.contactSubjectLabel || "Subject"} *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder={t.contactSubjectPlaceholder || "Brief summary of your request"}
                        className={`w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors ${
                          isAr ? "text-right" : "text-left"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Message Textarea */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className={`text-xs font-medium text-gray-300 flex items-center gap-1.5 ${isAr ? "flex-row-reverse" : ""}`}>
                        <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{t.contactMessageLabel || "Message Details"} *</span>
                      </label>
                      <span className="text-[11px] font-mono text-gray-500">
                        {message.length} / 5000
                      </span>
                    </div>
                    <textarea
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t.contactMessagePlaceholder || "Please describe your question, subscription details, or hardware requirements..."}
                      className={`w-full p-4 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors resize-y min-h-[120px] ${
                        isAr ? "text-right" : "text-left"
                      }`}
                    />
                  </div>

                  {/* Error Alert */}
                  {error && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                    <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{isAr ? "بياناتك مشفرة ومحمية وتصل للإدارة فقط." : "Your data is securely encrypted and delivered to admins only."}</span>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-black font-extrabold text-sm shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-black" />
                          <span>{t.contactSubmitting || "Sending..."}</span>
                        </>
                      ) : (
                        <>
                          <span>{t.contactSubmitBtn || "Send Inquiry"}</span>
                          <Send className={`w-4 h-4 text-black ${isAr ? "rotate-180" : ""}`} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              /* Success Confirmation Ticket Card */
              <motion.div
                key="contact-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="w-full rounded-3xl p-8 sm:p-12 bg-gradient-to-b from-emerald-950/40 via-[#0B1220] to-[#070B16] border border-emerald-500/30 text-center flex flex-col items-center shadow-2xl relative"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6 shadow-lg shadow-emerald-500/20 animate-bounce">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
                  {t.contactSuccessTitle || "Inquiry Submitted Successfully!"}
                </h2>

                <p className="text-sm sm:text-base text-gray-300 max-w-lg mb-8 leading-relaxed">
                  {t.contactSuccessDesc || (isAr ? "تم تسجيل طلبك بنجاح لدى إدارة المنصة. سنقوم بمراجعته والتواصل معك قريباً عبر بيانات التواصل المسجلة." : "Your request has been delivered to the QuazLink administration team. We will review it and reach out to you directly.")}
                </p>

                {/* Reference Ticket Box */}
                <div className="p-4 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md mb-8 max-w-md w-full font-mono text-xs text-gray-300 flex items-center justify-between gap-3">
                  <div className="flex flex-col items-start text-left">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">{t.contactTicketId || "Reference Ticket ID"}</span>
                    <span className="text-sm font-bold text-cyan-300 select-all">{successTicketId}</span>
                  </div>
                  <button
                    onClick={copyTicketId}
                    type="button"
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy Ticket ID"
                  >
                    {copiedTicket ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={handleReset}
                    type="button"
                    className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    {t.contactSendAnother || "Send Another Message"}
                  </button>
                  <Link
                    href="/"
                    className="px-6 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    {t.contactBackHome || "Back to Home"}
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-white/10 bg-[#060913] py-6 px-6 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} QuazLink Platform. All rights reserved.
      </footer>
    </div>
  );
}

