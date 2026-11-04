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
  Copy,
  Check,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  X,
  Inbox,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Aurora } from "@/components/effects/Aurora";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import {
  submitContactMessage,
  getMe,
  signup,
  login,
  getMyContactMessages,
  ackContactReply,
  type AuthUser,
  type ContactMessageItem,
} from "@/lib/api";
import { useLiveHub } from "@/lib/useLiveHub";

type CategoryKey = "subscription_renewal" | "pos_support" | "runner_support" | "sales_inquiry" | "general";

export default function ContactPage() {
  const { lang, isAr } = useLanguage();
  const t = translations[lang];

  // Current logged in user (if any)
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = React.useState<"form" | "my_messages">("form");
  const [liveReplyAlert, setLiveReplyAlert] = React.useState<{ title: string; reply: string; ticketId: string } | null>(null);

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

  // Quick Auth Modal State
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<"signup" | "login">("signup");
  const [modalName, setModalName] = React.useState("");
  const [modalEmail, setModalEmail] = React.useState("");
  const [modalPhone, setModalPhone] = React.useState("");
  const [modalPassword, setModalPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  // User's previous inquiries
  const [myInquiries, setMyInquiries] = React.useState<ContactMessageItem[]>([]);
  const [loadingMyInquiries, setLoadingMyInquiries] = React.useState(false);

  // Fetch my inquiries when switching to my_messages tab or on mount
  const fetchMyInquiries = React.useCallback(async () => {
    setLoadingMyInquiries(true);
    try {
      const res = await getMyContactMessages();
      setMyInquiries(res.items || []);
    } catch {
      setMyInquiries([]);
    } finally {
      setLoadingMyInquiries(false);
    }
  }, []);

  // Check login on mount & pre-load inquiries
  React.useEffect(() => {
    getMe()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
          if (user.name) setName(user.name);
          if (user.email) setEmail(user.email);
          if ((user as any).phone) setPhone((user as any).phone);
          // Pre-load user inquiries
          getMyContactMessages()
            .then((res) => {
              if (res.items) setMyInquiries(res.items);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // Real-time live hub listener (instant push without page refresh)
  const { sendAck } = useLiveHub({
    role: "user",
    userId: currentUser?.id,
    contactId: successTicketId || undefined,
    onReply: ({ contactId, data }) => {
      // 1. Instantly ACK delivery and seen status
      sendAck(contactId, "delivered");
      ackContactReply(contactId, "delivered").catch(() => {});
      sendAck(contactId, "read");
      ackContactReply(contactId, "read").catch(() => {});

      // 2. Update list in real-time
      setMyInquiries((prev) => {
        const exists = prev.some((it) => it.id === contactId);
        if (exists) {
          return prev.map((it) => (it.id === contactId ? { ...it, ...data, replyStatus: "read" } : it));
        }
        return [{ ...data, replyStatus: "read" }, ...prev];
      });

      // 3. Show live floating alert
      setLiveReplyAlert({
        title: data.subject || "استفسارك",
        reply: data.adminReply || "قامت إدارة QuazLink بالرد على استفسارك الآن.",
        ticketId: contactId.slice(0, 8),
      });
    },
  });

  React.useEffect(() => {
    if (activeTab === "my_messages" && currentUser) {
      fetchMyInquiries();
    }
  }, [activeTab, currentUser, fetchMyInquiries]);

  // Categories definition
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

  // Perform actual inquiry submission
  const executeSubmitInquiry = async (
    targetUserId?: string,
    subName = name,
    subEmail = email,
    subPhone = phone
  ) => {
    setLoading(true);
    try {
      const res = await submitContactMessage({
        name: subName.trim(),
        email: subEmail.trim(),
        phone: subPhone.trim() || undefined,
        category,
        subject: subject.trim(),
        message: message.trim(),
        userId: targetUserId,
      });
      setSuccessTicketId(res.messageId);
      setShowAuthModal(false);
      return res;
    } catch (err: any) {
      setError(err.message || (isAr ? "فشل إرسال الطلب، يرجى المحاولة لاحقاً." : "Failed to submit inquiry."));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Main form submit trigger
  const handleFormSubmit = async (e: React.FormEvent) => {
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

    // If user is already authenticated, submit immediately
    if (currentUser) {
      await executeSubmitInquiry(currentUser.id);
      return;
    }

    // Otherwise, open the quick signup modal prefilled
    setModalName(name);
    setModalEmail(email);
    setModalPhone(phone);
    setModalPassword("");
    setAuthMode("signup");
    setAuthError(null);
    setShowAuthModal(true);
  };

  // Handle Quick Auth Submit
  const handleQuickAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!modalEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(modalEmail)) {
      setAuthError(isAr ? "يرجى إدخال بريد إلكتروني صالح." : "Please enter a valid email address.");
      return;
    }
    if (!modalPassword || modalPassword.length < 8) {
      setAuthError(isAr ? "كلمة المرور يجب أن لا تقل عن 8 أحرف." : "Password must be at least 8 characters.");
      return;
    }

    setAuthLoading(true);
    try {
      let user: AuthUser;
      if (authMode === "signup") {
        user = await signup({
          name: modalName.trim() || undefined,
          email: modalEmail.trim(),
          phone: modalPhone.trim() || undefined,
          password: modalPassword,
        });
      } else {
        user = await login({
          email: modalEmail.trim(),
          password: modalPassword,
        });
      }

      setCurrentUser(user);
      setName(modalName || user.name || name);
      setEmail(modalEmail || user.email);
      if (modalPhone) setPhone(modalPhone);

      // Now submit the contact inquiry linked to this user
      await executeSubmitInquiry(user.id, modalName || user.name || name, modalEmail, modalPhone || phone);
    } catch (err: any) {
      setAuthError(err.message || (isAr ? "تعذر إتمام التسجيل." : "Authentication failed."));
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Guest bypass submission
  const handleContinueAsGuest = async () => {
    setAuthLoading(true);
    try {
      await executeSubmitInquiry(undefined, modalName || name, modalEmail || email, modalPhone || phone);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleReset = () => {
    setName(currentUser?.name || "");
    setEmail(currentUser?.email || "");
    setPhone((currentUser as any)?.phone || "");
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

        <div className="flex items-center gap-3">
          {currentUser && (
            <NotificationBell variant="header" />
          )}

          {currentUser ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <User className="w-3.5 h-3.5" />
              <span>{currentUser.name || currentUser.email}</span>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            >
              {isAr ? "تسجيل الدخول" : "Sign In"}
            </Link>
          )}

          <Link
            href="/"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
          >
            {isAr ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
            <span>{t.contactBackHome || "Back to Home"}</span>
          </Link>
        </div>
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

          {/* Real-time Live Admin Reply Push Banner */}
          {liveReplyAlert && (
            <div className="w-full max-w-2xl my-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-emerald-500/20 border border-emerald-500/40 text-emerald-200 shadow-2xl flex items-start justify-between gap-3 text-right">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-emerald-300">
                    {isAr ? "⚡ وصلك رد رسمي للتو من الإدارة!" : "⚡ New Official Admin Reply Received!"} (#{liveReplyAlert.ticketId})
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">{liveReplyAlert.title}</div>
                  <p className="text-xs text-gray-200 mt-1 whitespace-pre-wrap">{liveReplyAlert.reply}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLiveReplyAlert(null);
                  setActiveTab("my_messages");
                }}
                className="text-xs font-bold text-emerald-300 hover:text-white underline cursor-pointer shrink-0"
              >
                {isAr ? "عرض في رسائلي" : "View"}
              </button>
            </div>
          )}

          {/* Tab Navigation if user is logged in */}
          {currentUser && (
            <div className="flex items-center justify-center gap-2 mt-6 p-1.5 rounded-2xl bg-white/5 border border-white/10 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "form"
                    ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {isAr ? "📝 إرسال استفسار جديد" : "📝 New Inquiry"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("my_messages");
                  fetchMyInquiries();
                }}
                className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "my_messages"
                    ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>{isAr ? "استفساراتي وردود الإدارة" : "My Inquiries & Replies"}</span>
                {myInquiries.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    activeTab === "my_messages" ? "bg-black text-cyan-300" : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  }`}>
                    {myInquiries.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* View: User's Inquiries & Admin Replies */}
        {activeTab === "my_messages" && currentUser ? (
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Inbox className="w-5 h-5 text-cyan-400" />
                <span>{isAr ? "سجل استفساراتك وردود الإدارة" : "Inquiries & Management Replies"}</span>
              </h2>
              <button
                onClick={fetchMyInquiries}
                disabled={loadingMyInquiries}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingMyInquiries ? "animate-spin text-cyan-400" : ""}`} />
                <span>{isAr ? "تحديث" : "Refresh"}</span>
              </button>
            </div>

            {loadingMyInquiries ? (
              <div className="p-16 rounded-3xl bg-[#0B101D]/40 border border-white/10 text-center flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                <span className="text-xs text-gray-400">{isAr ? "جاري تحميل رسائلك..." : "Loading inquiries..."}</span>
              </div>
            ) : myInquiries.length === 0 ? (
              <div className="p-16 rounded-3xl bg-[#0B101D]/40 border border-white/10 text-center flex flex-col items-center justify-center gap-3">
                <CheckCircle2 className="w-10 h-10 text-gray-500 mb-1" />
                <h3 className="text-base font-bold text-white">{isAr ? "لا توجد استفسارات سابقة" : "No inquiries yet"}</h3>
                <p className="text-xs text-gray-400 max-w-sm">
                  {isAr ? "لم تقم بإرسال أي استفسارات حتى الآن. يمكنك استخدام النموذج لإرسال طلبك فوراً." : "You have not sent any inquiries yet."}
                </p>
                <button
                  onClick={() => setActiveTab("form")}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs transition-all cursor-pointer"
                >
                  {isAr ? "إرسال استفسار الآن" : "Send an inquiry now"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {myInquiries.map((item) => (
                  <div
                    key={item.id}
                    className="p-6 rounded-3xl bg-gradient-to-b from-[#0B1120] to-[#070B16] border border-white/10 flex flex-col gap-4 shadow-xl"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                      <div>
                        <h3 className="font-extrabold text-base text-white">{item.subject}</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-500" />
                            <span>{new Date(item.createdAt).toLocaleString()}</span>
                          </span>
                          <span>التذكرة: #{item.id.slice(0, 8)}</span>
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          item.adminReply
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : item.status === "pending"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                        }`}
                      >
                        {item.adminReply
                          ? (isAr ? "✅ تم الرد من الإدارة" : "✅ Replied")
                          : (isAr ? "⏳ قيد المراجعة" : "⏳ In Review")}
                      </span>
                    </div>

                    {/* Original Message */}
                    <div className="text-xs text-gray-300 leading-relaxed bg-black/30 p-3 rounded-2xl border border-white/5 whitespace-pre-wrap">
                      <span className="text-[11px] font-bold text-gray-400 block mb-1">
                        {isAr ? "نص رسالتك:" : "Your message:"}
                      </span>
                      {item.message}
                    </div>

                    {/* Official Admin Reply Card */}
                    {item.adminReply ? (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-[#0B1528] border border-emerald-500/30 flex flex-col gap-2 shadow-lg">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-emerald-300 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <span>{isAr ? "رد إدارة منصة QuazLink الرسمي:" : "Official QuazLink Response:"}</span>
                          </span>
                          {item.repliedAt && (
                            <span className="text-[11px] text-gray-400 font-mono">
                              {new Date(item.repliedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="text-white text-sm leading-relaxed whitespace-pre-wrap font-sans mt-1">
                          {item.adminReply}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          {isAr
                            ? "استفسارك قيد المتابعة من فريق الإدارة وسيظهر الرد هنا مباشرة فور اعتماده."
                            : "Your inquiry is currently under review. Management response will appear here."}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Form Container / Success Ticket State */
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

                  <form onSubmit={handleFormSubmit} className="flex flex-col gap-6 relative z-10">
                    
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
                    {currentUser && (
                      <button
                        onClick={() => {
                          setSuccessTicketId(null);
                          setActiveTab("my_messages");
                        }}
                        type="button"
                        className="px-6 py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        {isAr ? "عرض رسائلي وردود الإدارة" : "View My Inquiries"}
                      </button>
                    )}
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
        )}
      </main>

      {/* Quick Auth Popup Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-[#0F172A] to-[#070B16] border border-cyan-500/40 shadow-2xl relative overflow-hidden"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-teal-400/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 mb-3 shadow-lg shadow-cyan-500/10">
                  {authMode === "signup" ? <UserPlus className="w-6 h-6" /> : <LogIn className="w-6 h-6" />}
                </div>

                <h3 className="text-xl font-extrabold text-white">
                  {authMode === "signup"
                    ? (isAr ? "تفعيل حسابك ومتابعة الطلب" : "Activate Account & Submit")
                    : (isAr ? "تسجيل الدخول ومتابعة الطلب" : "Sign In & Submit")}
                </h3>

                <p className="text-xs text-gray-300 mt-1.5 leading-relaxed max-w-xs">
                  {isAr
                    ? "أنشئ حسابك في ثوانٍ لتتمكن من متابعة حالة طلبك واستلام رد إدارة المنصة الرسمي مباشرة."
                    : "Create your account to track your request and receive direct in-platform management replies."}
                </p>

                {/* Mode Switcher */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-black/50 border border-white/10 mt-3 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError(null);
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      authMode === "signup"
                        ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {isAr ? "حساب جديد (Quick Signup)" : "New Account"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError(null);
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      authMode === "login"
                        ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {isAr ? "لدي حساب (Sign In)" : "Sign In"}
                  </button>
                </div>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleQuickAuthSubmit} className="flex flex-col gap-3.5">
                {/* Name (Signup only) */}
                {authMode === "signup" && (
                  <div className="flex flex-col gap-1 text-left">
                    <label className={`text-[11px] font-semibold text-gray-300 flex items-center gap-1 ${isAr ? "flex-row-reverse" : ""}`}>
                      <User className="w-3 h-3 text-cyan-400" />
                      <span>{isAr ? "الاسم بالكامل" : "Full Name"}</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={modalName}
                      onChange={(e) => setModalName(e.target.value)}
                      placeholder="e.g. Mohamed Salah"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-400 ${
                        isAr ? "text-right" : "text-left"
                      }`}
                    />
                  </div>
                )}

                {/* Email */}
                <div className="flex flex-col gap-1 text-left">
                  <label className={`text-[11px] font-semibold text-gray-300 flex items-center gap-1 ${isAr ? "flex-row-reverse" : ""}`}>
                    <Mail className="w-3 h-3 text-cyan-400" />
                    <span>{isAr ? "البريد الإلكتروني" : "Email Address"}</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-400 text-left"
                    dir="ltr"
                  />
                </div>

                {/* Phone (Signup only) */}
                {authMode === "signup" && (
                  <div className="flex flex-col gap-1 text-left">
                    <label className={`text-[11px] font-semibold text-gray-300 flex items-center justify-between ${isAr ? "flex-row-reverse" : ""}`}>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-cyan-400" />
                        <span>{isAr ? "رقم الهاتف" : "Phone Number"}</span>
                      </span>
                      {!modalPhone && (
                        <span className="text-[10px] text-amber-300 font-mono">
                          {isAr ? "مطلوب للمتابعة السريعة" : "Recommended"}
                        </span>
                      )}
                    </label>
                    <input
                      type="tel"
                      value={modalPhone}
                      onChange={(e) => setModalPhone(e.target.value)}
                      placeholder="+20 10... or local number"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-400 text-left"
                      dir="ltr"
                    />
                  </div>
                )}

                {/* Password */}
                <div className="flex flex-col gap-1 text-left">
                  <label className={`text-[11px] font-semibold text-gray-300 flex items-center gap-1 ${isAr ? "flex-row-reverse" : ""}`}>
                    <Lock className="w-3 h-3 text-cyan-400" />
                    <span>
                      {authMode === "signup"
                        ? (isAr ? "تعيين كلمة المرور لحسابك (8 أحرف فأكثر)" : "Create Password (min 8 chars)")
                        : (isAr ? "كلمة المرور" : "Password")}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={modalPassword}
                      onChange={(e) => setModalPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-400 pr-10 text-left"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Auth Error */}
                {authError && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-black font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {authLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{isAr ? "جاري الإرسال وتفعيل الحساب..." : "Processing..."}</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {authMode === "signup"
                            ? (isAr ? "إنشاء الحساب وإرسال الطلب فوراً" : "Create Account & Submit")
                            : (isAr ? "تسجيل الدخول وإرسال الطلب" : "Sign In & Submit")}
                        </span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleContinueAsGuest}
                    disabled={authLoading}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isAr ? "المتابعة كزائر دون إنشاء حساب" : "Continue as Guest without Account"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-white/10 bg-[#060913] py-6 px-6 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} QuazLink Platform. All rights reserved.
      </footer>
    </div>
  );
}
