"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  Download,
  ExternalLink,
  MessageCircle,
  PhoneCall,
  Flame,
  Layers,
  ArrowRight,
  HardDrive,
  Printer,
  QrCode,
  Smartphone,
  RefreshCw,
  Clock,
  Laptop,
  CheckCircle2,
  X
} from "lucide-react";
import { StarField } from "@/components/effects/StarField";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export default function PricingPage() {
  const { lang, isAr } = useLanguage();
  const [billingCycle, setBillingCycle] = React.useState<"lifetime" | "annual">("lifetime");
  const [activeFaq, setActiveFaq] = React.useState<number | null>(null);

  const salesPhone = "01019078440";
  const whatsappUrl = (text: string) =>
    `https://wa.me/201019078440?text=${encodeURIComponent(text)}`;

  const faqs = [
    {
      qAr: "هل رخصة كاشير المحلات تدفع لمرة واحدة فعلاً بدون أي اشتراك شهري؟",
      qEn: "Is the retail POS license truly a one-time payment with zero monthly fees?",
      aAr: "نعم 100%! باقات (Starter) و (Business Pro) هي رخص دائمة مدى الحياة (Lifetime License) تدفعها لمرة واحدة فقط لجهازك، وتعمل بكفاءة كاملة أوفلاين بدون أي اشتراكات أو فواتير شهرية إجبارية.",
      aEn: "Yes, 100%! Both Starter and Business Pro are lifetime licenses paid once for your machine. They operate fully offline with zero mandatory recurring monthly fees."
    },
    {
      qAr: "ماذا يحدث إذا احترق الهارد ديسك أو قمت بتغيير جهاز الكمبيوتر؟",
      qEn: "What happens if my hard drive crashes or I replace my computer?",
      aAr: "بياناتك بأمان تام بفضل النسخ الاحتياطي التلقائي المشفر إلى حسابك في Google Drive. كما يتيح لك الدعم الفني إعادة توليد ترخيص جهازك الجديد ونقل بياناتك بسهولة ودون أي رسوم إضافية.",
      aEn: "Your data is completely safe thanks to automatic encrypted backups to your own Google Drive. Our support team will re-link your license to your new device smoothly at no extra cost."
    },
    {
      qAr: "هل البرنامج يدعم جميع طابعات الفواتير وقوارئ الباركود الصينية والمحلية؟",
      qEn: "Does the software support all thermal receipt printers and barcode scanners?",
      aAr: "نعم، النظام مزود بمحرك Canvas-to-Raster مخصص يطبع باللغة العربية بدقة فائقة وبسرعة 1.8ms على جميع طابعات 80mm و 58mm (مثل Xprinter و Rongta) وطابعات A4/A5، بالإضافة لجميع أجهزة قراءة الباركود USB واللاسلكية.",
      aEn: "Yes, our custom Canvas-to-Raster engine prints crisp Arabic receipts in under 1.8ms on all 80mm & 58mm thermal printers (Xprinter, Rongta, etc.), A4/A5 printers, and all barcode scanners."
    },
    {
      qAr: "ما هي طرق الدفع المتاحة لتفعيل التراخيص؟",
      qEn: "What payment methods are supported for license activation?",
      aAr: "نوفر جميع وسائل الدفع المريحة داخل مصر: إنستاباي (InstaPay)، فودافون كاش، التحويل البنكي المباشر، والدفع النقدي مع المندوب الميداني عند تركيب الأجهزة.",
      aEn: "We support all convenient Egyptian payment methods: InstaPay, Vodafone Cash, direct bank transfer, and cash upon delivery when installing hardware bundles."
    },
    {
      qAr: "هل أستطيع تجربة البرنامج قبل دفع أي مبالغ مالية؟",
      qEn: "Can I try the software before paying anything?",
      aAr: "بالتأكيد! نوفر فترة تجربة مجانية كاملة لمدة 30 يوماً بكافة الميزات، يمكنك تحميلها وتثبيتها فوراً وتجربتها داخل محلك قبل اتخاذ قرار الشراء النهائي.",
      aEn: "Absolutely! We offer a full 30-day free trial with all features enabled. Download and test it in your store today before committing."
    }
  ];

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="relative min-h-screen bg-[#070A12] text-white flex flex-col overflow-x-hidden selection:bg-emerald-500/30 selection:text-emerald-200"
    >
      {/* Background Ambience */}
      <StarField interactive={true} />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16, 185, 129, 0.25), transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(34, 211, 238, 0.15), transparent 60%)"
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-[#070A12]/95 backdrop-blur-md border-b border-emerald-500/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/pos" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
              <div className="w-full h-full bg-[#0B101D] rounded-[14px] flex items-center justify-center">
                <Store className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className={`flex flex-col ${isAr ? "text-right" : "text-left"}`}>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-gray-100 to-emerald-200 bg-clip-text text-transparent">
                  QuazLink POS
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {isAr ? "قائمة الأسعار" : "Pricing"}
                </span>
              </div>
              <span className="text-xs text-gray-400 font-medium">
                {isAr ? "خطط وتراخيص نقاط البيع والمحلات" : "Retail Plans & Licenses"}
              </span>
            </div>
          </Link>

          {/* Quick Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-300">
            <Link href="/pos" className="hover:text-emerald-400 transition-colors">
              {isAr ? "بوابة الكاشير" : "POS Portal"}
            </Link>
            <Link href="/pos#downloads" className="hover:text-emerald-400 transition-colors">
              {isAr ? "تحميل النسخة التجريبية" : "Free Trial"}
            </Link>
            <a href="#addons" className="hover:text-emerald-400 transition-colors">
              {isAr ? "باقات الإضافات" : "Add-ons"}
            </a>
            <a href="#bundles" className="hover:text-emerald-400 transition-colors">
              {isAr ? "عروض الأجهزة" : "Hardware"}
            </a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">
              {isAr ? "الأسئلة الشائعة" : "FAQ"}
            </a>
          </nav>

          {/* Action Hub */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="nav" />
            <a
              id="header-call-btn"
              href={`tel:${salesPhone}`}
              className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 transition-all"
            >
              <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
              <span>{salesPhone}</span>
            </a>
            <a
              id="header-whatsapp-btn"
              href={whatsappUrl(
                isAr
                  ? "مرحباً، أود الاستفسار عن باقات وأسعار برنامج QuazLink POS"
                  : "Hello, I want to inquire about QuazLink POS pricing and plans"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5"
            >
              <MessageCircle className="w-4 h-4 fill-black" />
              <span>{isAr ? "طلب تفعيل فوري" : "Order License"}</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-12 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            {isAr
              ? "استثمار لمرة واحدة مدى الحياة — بدون أي اشتراكات شهرية إجبارية"
              : "One-Time Lifetime Investment — Zero Mandatory Monthly Fees"}
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          {isAr ? (
            <>
              امتلك نظام كاشير وإدارة متجرك{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                مدى الحياة
              </span>
            </>
          ) : (
            <>
              Own Your Retail & POS System{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                For Life
              </span>
            </>
          )}
        </h1>

        <p className="text-base sm:text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8">
          {isAr
            ? "وداعاً للاشتراكات الشهرية المرهقة في برامج الكاشير السحابية. اختر الباقة المناسبة لحجم نشاطك وامتلك البرنامج لجهازك مدى الحياة مع سرعة فائقة تعمل 100% بدون إنترنت وأمان كامل لبياناتك."
            : "Say goodbye to costly recurring cloud subscriptions. Choose the right tier for your retail store and get a lifetime license with 100% offline capability, instant thermal printing, and Google Drive backup."}
        </p>

        {/* Guarantee Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto text-xs text-gray-300">
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{isAr ? "30 يوم تجربة مجانية" : "30-Day Free Trial"}</span>
          </div>
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{isAr ? "أوفلاين 100% بدون نت" : "100% Offline Fast"}</span>
          </div>
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{isAr ? "نسخ احتياطي مجاني" : "Free Drive Backups"}</span>
          </div>
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <Printer className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{isAr ? "دعم كافة الطابعات" : "All Thermal Printers"}</span>
          </div>
        </div>
      </section>

      {/* Main Pricing Cards */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          
          {/* Card 1: Starter Lifetime */}
          <div className="relative rounded-3xl bg-[#0B101D]/90 border border-white/10 hover:border-emerald-500/40 p-8 flex flex-col justify-between transition-all duration-300 backdrop-blur-xl group hover:shadow-2xl hover:shadow-emerald-500/10">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-gray-300">
                  {isAr ? "للمحلات الصغيرة" : "Starter Retail"}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {isAr ? "كاونتر واحد" : "1 Counter"}
                </span>
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">
                {isAr ? "باقة البداية (Starter)" : "Starter Lifetime"}
              </h2>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                {isAr
                  ? "مثالية للبقالة، الأكشاك، المغاسل، محلات العطارة والمكتبات الفردية."
                  : "Perfect for single-counter groceries, kiosks, laundromats, and small boutiques."}
              </p>

              <div className="mb-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white">3,499</span>
                  <span className="text-sm font-semibold text-gray-400">
                    {isAr ? "جنيه مصري" : "EGP"}
                  </span>
                </div>
                <div className="text-xs text-emerald-400 font-medium mt-1">
                  {isAr ? "⚡ تدفع لمرة واحدة مدى الحياة (بدون تجديد)" : "⚡ Paid once for life (No recurring fees)"}
                </div>
              </div>

              <div className="space-y-3 mb-8 text-sm text-gray-300">
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "ترخيص مدى الحياة لجهاز كاشير واحد" : "Lifetime license locked to 1 PC (HWID)"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "إصدار فواتير بيع وشراء ومرتجع سريعة بالباركود" : "Fast sales, purchase & return barcode checkout"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "طباعة فورية 1.8ms للطابعات الحرارية (80mm & 58mm) و A4" : "Instant 1.8ms thermal receipt & A4 invoice printing"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "إدارة مخزن واحد وجرد وتنبيهات النواقص" : "Single warehouse inventory & low stock alerts"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "حوكمة الورديات وجرد الخزينة (Z-Report)" : "Shift governance & Z-Report cash drawer audit"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "نسخ احتياطي سحابي لـ Google Drive مجاناً" : "Automatic free backup to your own Google Drive"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "يعمل 100% أوفلاين بدون انقطاع" : "100% Offline-first with zero lag"}</span>
                </div>
              </div>
            </div>

            <a
              id="cta-starter-plan"
              href={whatsappUrl(
                isAr
                  ? "مرحباً، أود طلب باقة Starter Lifetime (3,499 ج) لبرنامج QuazLink POS"
                  : "Hello, I want to order the Starter Lifetime plan (3,499 EGP) for QuazLink POS"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm flex items-center justify-center gap-2 border border-white/10 transition-all hover:border-emerald-500/50"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "اطلب باقة Starter الآن" : "Order Starter License"}</span>
            </a>
          </div>

          {/* Card 2: Business Pro Lifetime (Featured Hero) */}
          <div className="relative rounded-3xl bg-gradient-to-b from-[#0F1B2C] to-[#0B101D] border-2 border-emerald-500/70 p-8 flex flex-col justify-between transition-all duration-300 shadow-2xl shadow-emerald-500/20 transform lg:-translate-y-4">
            {/* Top Featured Ribbon */}
            <div className="absolute -top-4 right-1/2 translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 text-black text-xs font-extrabold uppercase tracking-widest shadow-md flex items-center gap-1.5 whitespace-nowrap">
              <Flame className="w-3.5 h-3.5 fill-black" />
              <span>{isAr ? "الأكثر مبيعاً — عرض الإطلاق" : "Best Seller — Launch Offer"}</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4 mt-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {isAr ? "المحلات المتقدمة" : "Business Pro"}
                </span>
                <span className="text-xs text-emerald-400 font-mono font-bold">
                  {isAr ? "شامل كل المزايا" : "All Features Included"}
                </span>
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">
                {isAr ? "الباقة الاحترافية (Business Pro)" : "Business Pro Lifetime"}
              </h2>
              <p className="text-xs text-gray-300 mb-6 leading-relaxed">
                {isAr
                  ? "الخيار الأمثل لمحلات الموبايل، الكمبيوتر، الأجهزة، والأنشطة التي تحتاج تتبع السيريالات وحسابات الآجل."
                  : "Engineered for phone shops, computer stores, and retail needing IMEI warranty tracking & customer credit."}
              </p>

              <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm text-gray-400 line-through">5,999 ج</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                    {isAr ? "خصم 25% لفترة محدودة" : "Save 25%"}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-emerald-400">4,499</span>
                  <span className="text-sm font-semibold text-gray-200">
                    {isAr ? "جنيه مصري" : "EGP"}
                  </span>
                </div>
                <div className="text-xs text-emerald-300 font-medium mt-1">
                  {isAr ? "⚡ ترخيص دائم مدى الحياة بدون أي رسوم شهرية" : "⚡ Lifetime license with zero monthly fees"}
                </div>
              </div>

              <div className="space-y-3 mb-8 text-sm text-gray-200">
                <div className="flex items-start gap-3 font-semibold text-white">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "جميع مميزات باقة Starter الأساسية بالكامل" : "All Starter Features Included"}</span>
                </div>
                <div className="flex items-start gap-3 text-emerald-300 font-medium">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    {isAr
                      ? "نظام تتبع السيريالات والضمان (IMEI & Serial Numbers)"
                      : "Serial & IMEI Tracking with Warranty Protection"}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    {isAr
                      ? "دفتر حسابات العملاء والموردين وإدارة الآجل والديون"
                      : "Customer & Supplier Ledgers with Credit Tracking"}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    {isAr
                      ? "باركود مصلحة الضرائب المصرية المعتمد (ETA QR Code)"
                      : "Egyptian Tax Authority (ETA) QR Receipt Code"}
                  </span>
                </div>
                <div className="flex items-start gap-3 text-cyan-300 font-medium">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    {isAr
                      ? "🎁 هدية: 200 رسالة فاتورة واتساب مباشرة للعملاء"
                      : "🎁 Gift: 200 WhatsApp Digital Receipts to Customers"}
                  </span>
                </div>
                <div className="flex items-start gap-3 text-cyan-300 font-medium">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    {isAr
                      ? "🎁 هدية: 50 كريديت تسويق وإعلانات بالذكاء الاصطناعي"
                      : "🎁 Gift: 50 AI Marketing Copywriting Credits"}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "أولوية قصوى في الدعم الفني والتحديثات" : "VIP Priority Support & Feature Updates"}</span>
                </div>
              </div>
            </div>

            <a
              id="cta-pro-plan"
              href={whatsappUrl(
                isAr
                  ? "مرحباً، أود الاستفادة من عرض الإطلاق لباقة Business Pro (4,499 ج) لبرنامج QuazLink POS"
                  : "Hello, I want to take advantage of the Business Pro launch offer (4,499 EGP) for QuazLink POS"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all transform hover:scale-[1.02]"
            >
              <MessageCircle className="w-4 h-4 fill-black" />
              <span>{isAr ? "اطلب باقة Pro مع عرض الخصم" : "Get Business Pro with Discount"}</span>
            </a>
          </div>

          {/* Card 3: Enterprise Cloud */}
          <div className="relative rounded-3xl bg-[#0B101D]/90 border border-white/10 hover:border-cyan-500/40 p-8 flex flex-col justify-between transition-all duration-300 backdrop-blur-xl group hover:shadow-2xl hover:shadow-cyan-500/10">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                  {isAr ? "للفروع المتعددة" : "Enterprise"}
                </span>
                <span className="text-xs text-cyan-400 font-mono">
                  {isAr ? "سحابي سريالي" : "Multi-Branch"}
                </span>
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">
                {isAr ? "باقة المؤسسات (Enterprise)" : "Enterprise Cloud"}
              </h2>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                {isAr
                  ? "للشركات والسلاسل التي تمتلك أكثر من فرع وتريد متابعة المبيعات والأرباح من الهاتف."
                  : "For businesses with multi-branch stores wanting real-time phone tracking & sync."}
              </p>

              <div className="mb-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white">4,800</span>
                  <span className="text-sm font-semibold text-gray-400">
                    {isAr ? "جنيه / سنوياً" : "EGP / year"}
                  </span>
                </div>
                <div className="text-xs text-cyan-400 font-medium mt-1">
                  {isAr ? "تعادل 400 جنيه فقط شهرياً (تدفع سنوياً)" : "Equivalent to only 400 EGP/month (Billed annually)"}
                </div>
              </div>

              <div className="space-y-3 mb-8 text-sm text-gray-300">
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "ربط سحابي فوري بين جميع الفروع والمخازن" : "Real-time sync across all branches & central stock"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "لوحة تحكم وتقارير مبيعات لايف على موبايل المالك" : "Live mobile dashboard & sales reports anywhere"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "إرسال تقرير إغلاق الوردية اليومي لواتساب المالك" : "Automated daily closing Z-Report sent to owner's WhatsApp"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "إدارة الصلاحيات والمستخدمين لكل كاشير وفرع" : "Granular roles & cashier permissions per branch"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{isAr ? "دعم فني VIP وتدريب شامل لموظفي الفروع" : "Dedicated VIP onboarding & staff training"}</span>
                </div>
              </div>
            </div>

            <a
              id="cta-enterprise-plan"
              href={whatsappUrl(
                isAr
                  ? "مرحباً، أود الاستفسار عن باقة Enterprise Cloud للفروع المتعددة لبرنامج QuazLink POS"
                  : "Hello, I want to inquire about the Enterprise Cloud multi-branch plan for QuazLink POS"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm flex items-center justify-center gap-2 border border-white/10 transition-all hover:border-cyan-500/50"
            >
              <MessageCircle className="w-4 h-4 text-cyan-400" />
              <span>{isAr ? "استفسر عن باقة المؤسسات" : "Inquire for Enterprise"}</span>
            </a>
          </div>

        </div>
      </section>

      {/* Prepaid Add-ons Section */}
      <section id="addons" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? "باقات مسبقة الدفع حسب استهلاكك" : "Prepaid Pay-As-You-Go Add-ons"}</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-4">
            {isAr ? "شحن رصيد الخدمات الذكية" : "Smart Services Add-on Credits"}
          </h2>
          <p className="text-sm text-gray-400">
            {isAr
              ? "اشحن رصيدك وقتما تشاء بدون أي اشتراكات إجبارية لاستخدام خدمات الواتساب والذكاء الاصطناعي."
              : "Recharge your balance anytime with no monthly commitments for WhatsApp receipts and AI marketing."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* WhatsApp Packs */}
          <div className="rounded-3xl bg-[#0B101D]/80 border border-white/10 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">
                    {isAr ? "باقات فواتير الواتساب" : "WhatsApp Receipt Packs"}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {isAr ? "إرسال الفاتورة للزبون على هاتفه فوراً وتوفير رول الورق" : "Instant digital PDF receipts to customer phone"}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-sm text-gray-200">{isAr ? "باقة 500 رسالة" : "500 Receipts"}</span>
                  <span className="font-bold text-emerald-400">150 ج <span className="text-xs text-gray-400 font-normal">({isAr ? "30 قرش/رسالة" : "0.30 EGP/ea"})</span></span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-emerald-500/20">
                  <span className="text-sm text-gray-100 font-medium">{isAr ? "باقة 1,500 رسالة ⭐" : "1,500 Receipts ⭐"}</span>
                  <span className="font-bold text-emerald-400">350 ج <span className="text-xs text-gray-400 font-normal">({isAr ? "23 قرش/رسالة" : "0.23 EGP/ea"})</span></span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-sm text-gray-200">{isAr ? "باقة 5,000 رسالة" : "5,000 Receipts"}</span>
                  <span className="font-bold text-emerald-400">999 ج <span className="text-xs text-gray-400 font-normal">({isAr ? "20 قرش/رسالة" : "0.20 EGP/ea"})</span></span>
                </div>
              </div>
            </div>

            <a
              href={whatsappUrl(
                isAr
                  ? "أود شحن رصيد باقة فواتير الواتساب لبرنامج QuazLink POS"
                  : "I want to recharge WhatsApp receipt credits for QuazLink POS"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 py-2.5 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <span>{isAr ? "طلب شحن باقة واتساب" : "Order WhatsApp Credits"}</span>
              <ArrowRight className={`w-3.5 h-3.5 ${isAr ? "rotate-180" : ""}`} />
            </a>
          </div>

          {/* AI Marketing Packs */}
          <div className="rounded-3xl bg-[#0B101D]/80 border border-white/10 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">
                    {isAr ? "باقات التسويق بالذكاء الاصطناعي" : "AI Marketing Copywriting"}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {isAr ? "صياغة منشورات وإعلانات احترافية لبضاعة محلك لزيادة المبيعات" : "Generate compelling social ads for your store inventory"}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-sm text-gray-200">{isAr ? "باقة 100 منشور إعلاني ذكي" : "100 AI Ad Posts"}</span>
                  <span className="font-bold text-cyan-400">199 ج</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-cyan-500/20">
                  <span className="text-sm text-gray-100 font-medium">{isAr ? "باقة 300 منشور إعلاني ذكي ⭐" : "300 AI Ad Posts ⭐"}</span>
                  <span className="font-bold text-cyan-400">450 ج</span>
                </div>
              </div>
            </div>

            <a
              href={whatsappUrl(
                isAr
                  ? "أود شحن رصيد التسويق بالذكاء الاصطناعي لبرنامج QuazLink POS"
                  : "I want to recharge AI marketing credits for QuazLink POS"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 py-2.5 px-4 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <span>{isAr ? "طلب شحن كريديت AI" : "Order AI Credits"}</span>
              <ArrowRight className={`w-3.5 h-3.5 ${isAr ? "rotate-180" : ""}`} />
            </a>
          </div>
        </div>
      </section>

      {/* Hardware Bundles Section */}
      <section id="bundles" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="rounded-3xl bg-gradient-to-br from-[#0B101D] via-[#0E1526] to-[#0B101D] border border-white/10 p-8 sm:p-12">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-gray-300">
              {isAr ? "حلول جاهزة متكاملة" : "Complete POS Bundles"}
            </span>
            <h2 className="text-3xl font-extrabold text-white mt-3 mb-3">
              {isAr ? "عروض تجميعات الأجهزة مع البرنامج" : "Hardware + Software Bundles"}
            </h2>
            <p className="text-xs text-gray-400">
              {isAr
                ? "هل تريد استلام محطة كاشير كاملة جاهزة للعمل فوراً؟ نوفر أحدث أجهزة الكاشير مع البرنامج في باقة موحدة."
                : "Need ready-to-run cashier hardware? We provide bundled hardware packages with the software pre-installed."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bundle 1 */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-base text-white mb-1">
                  {isAr ? "عرض الكاشير الاقتصادي" : "Economy POS Bundle"}
                </h3>
                <div className="text-2xl font-extrabold text-emerald-400 my-3">
                  5,999 ج
                </div>
                <ul className="text-xs text-gray-300 space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAr ? "طابعة فواتير حرارية 57mm USB" : "57mm USB Thermal Printer"}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAr ? "قارئ باركود ليزري سريع بقاعدة" : "Laser Barcode Scanner with Stand"}</span>
                  </li>
                  <li className="flex items-center gap-2 font-semibold text-white">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAr ? "رخصة برنامج QuazLink Starter مدى الحياة" : "QuazLink Starter Lifetime License"}</span>
                  </li>
                </ul>
              </div>
              <a
                href={whatsappUrl(
                  isAr
                    ? "أود طلب عرض الكاشير الاقتصادي (5,999 ج) مع الأجهزة والبرنامج"
                    : "I want to order the Economy POS Bundle (5,999 EGP)"
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold text-center transition-all"
              >
                {isAr ? "طلب العرض الاقتصادي" : "Order Economy Bundle"}
              </a>
            </div>

            {/* Bundle 2 (Featured) */}
            <div className="rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 p-6 flex flex-col justify-between">
              <div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase">
                  {isAr ? "الأفضل قيمة للمحلات" : "Best Value"}
                </span>
                <h3 className="font-bold text-base text-white mt-2 mb-1">
                  {isAr ? "عرض الكاشير القياسي" : "Standard Retail Bundle"}
                </h3>
                <div className="text-2xl font-extrabold text-emerald-400 my-3">
                  8,999 ج
                </div>
                <ul className="text-xs text-gray-200 space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAr ? "طابعة حرارية 80mm أوتو كاتر سريعة" : "80mm Auto-Cutter Thermal Printer"}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAr ? "قارئ باركود ليزري فائق الدقة" : "High-speed Barcode Scanner"}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAr ? "درج نقدية معدني ثقيل 5 خانات" : "Heavy-Duty 5-slot Metal Cash Drawer"}</span>
                  </li>
                  <li className="flex items-center gap-2 font-semibold text-white">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAr ? "رخصة برنامج QuazLink Starter مدى الحياة" : "QuazLink Starter Lifetime License"}</span>
                  </li>
                </ul>
              </div>
              <a
                href={whatsappUrl(
                  isAr
                    ? "أود طلب عرض الكاشير القياسي (8,999 ج) مع الطابعة والدرج والباركود والبرنامج"
                    : "I want to order the Standard Retail Bundle (8,999 EGP)"
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs text-center transition-all"
              >
                {isAr ? "طلب العرض القياسي" : "Order Standard Bundle"}
              </a>
            </div>

            {/* Bundle 3 */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-base text-white mb-1">
                  {isAr ? "محطة اللمس الشاملة (Touch POS)" : "All-in-One Touch Terminal"}
                </h3>
                <div className="text-xl font-bold text-cyan-400 my-3">
                  17,500 - 22,000 ج
                </div>
                <ul className="text-xs text-gray-300 space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isAr ? "شاشة لمس تجارية متطورة (Touch Terminal)" : "Commercial POS Touch Screen Terminal"}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isAr ? "طابعة 80mm + درج نقدية + باركود" : "80mm Printer + Cash Drawer + Scanner"}</span>
                  </li>
                  <li className="flex items-center gap-2 font-semibold text-white">
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isAr ? "رخصة Business Pro الاحترافية مدى الحياة" : "QuazLink Business Pro Lifetime License"}</span>
                  </li>
                </ul>
              </div>
              <a
                href={whatsappUrl(
                  isAr
                    ? "أود الاستفسار عن محطة الكاشير الشاملة بشاشة اللمس والبرنامج"
                    : "I want to inquire about the All-in-One Touch POS Terminal bundle"
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold text-center transition-all"
              >
                {isAr ? "طلب معاينة المحطة الشاملة" : "Inquire for Touch Terminal"}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
            {isAr ? "مقارنة الميزات بين الباقات" : "Detailed Feature Comparison"}
          </h2>
          <p className="text-xs text-gray-400">
            {isAr
              ? "تعرف على تفاصيل كل ميزة لاختيار الباقة التي تناسب احتياج نشاطك التجاري بدقة."
              : "Review all capabilities to select the perfect package for your retail requirements."}
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0B101D]/70 backdrop-blur-md">
          <table className="w-full text-xs sm:text-sm text-right">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-gray-300">
                <th className="p-4 font-bold text-white text-start">{isAr ? "الميزة" : "Feature"}</th>
                <th className="p-4 font-bold text-center text-white">{isAr ? "Starter (3,499 ج)" : "Starter"}</th>
                <th className="p-4 font-bold text-center text-emerald-400 bg-emerald-500/10">{isAr ? "Business Pro ⭐ (4,499 ج)" : "Business Pro ⭐"}</th>
                <th className="p-4 font-bold text-center text-cyan-400">{isAr ? "Enterprise (4,800 ج/س)" : "Enterprise"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              <tr>
                <td className="p-4 text-start font-medium text-white">{isAr ? "نوع الترخيص" : "License Type"}</td>
                <td className="p-4 text-center">{isAr ? "مدى الحياة (جهاز واحد)" : "Lifetime (1 PC)"}</td>
                <td className="p-4 text-center bg-emerald-500/5 font-semibold text-emerald-300">{isAr ? "مدى الحياة (جهاز واحد)" : "Lifetime (1 PC)"}</td>
                <td className="p-4 text-center">{isAr ? "سنوي سحابي" : "Annual Cloud"}</td>
              </tr>
              <tr>
                <td className="p-4 text-start font-medium text-white">{isAr ? "العمل أوفلاين بدون إنترنت (100% Offline)" : "100% Offline Capability"}</td>
                <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                <td className="p-4 text-center bg-emerald-500/5"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-4 text-start font-medium text-white">{isAr ? "طباعة فواتير حرارية 1.8ms وطابعات A4" : "Thermal & A4 Invoicing"}</td>
                <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                <td className="p-4 text-center bg-emerald-500/5"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-4 text-start font-medium text-white">{isAr ? "إدارة المخزن وتنبيهات النواقص" : "Inventory & Low Stock Alerts"}</td>
                <td className="p-4 text-center">{isAr ? "مخزن واحد" : "1 Store"}</td>
                <td className="p-4 text-center bg-emerald-500/5 font-semibold text-white">{isAr ? "مخزن واحد" : "1 Store"}</td>
                <td className="p-4 text-center text-cyan-300 font-semibold">{isAr ? "مخازن وفروع متعددة" : "Multi-warehouse"}</td>
              </tr>
              <tr>
                <td className="p-4 text-start font-medium text-white">{isAr ? "حوكمة الورديات والدرج (Z-Report)" : "Shift Audits & Z-Report"}</td>
                <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                <td className="p-4 text-center bg-emerald-500/5"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-4 text-start font-medium text-white">{isAr ? "نسخ احتياطي تلقائي لـ Google Drive" : "Google Drive Cloud Backup"}</td>
                <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                <td className="p-4 text-center bg-emerald-500/5"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-4 text-start font-medium text-white">{isAr ? "تتبع سيريالات الأجهزة والضمان (IMEI)" : "IMEI & Serial Number Warranty"}</td>
                <td className="p-4 text-center"><X className="w-4 h-4 text-gray-600 mx-auto" /></td>
                <td className="p-4 text-center bg-emerald-500/5"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-4 text-start font-medium text-white">{isAr ? "دفتر حسابات العملاء والموردين والآجل" : "Customer/Supplier Credit Ledger"}</td>
                <td className="p-4 text-center"><X className="w-4 h-4 text-gray-600 mx-auto" /></td>
                <td className="p-4 text-center bg-emerald-500/5"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-4 text-start font-medium text-white">{isAr ? "باركود مصلحة الضرائب المصرية (ETA QR)" : "Egyptian Tax Authority QR"}</td>
                <td className="p-4 text-center"><X className="w-4 h-4 text-gray-600 mx-auto" /></td>
                <td className="p-4 text-center bg-emerald-500/5"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-4 text-start font-medium text-white">{isAr ? "متابعة وتقارير مبيعات لايف من الموبايل" : "Live Mobile Reports"}</td>
                <td className="p-4 text-center"><X className="w-4 h-4 text-gray-600 mx-auto" /></td>
                <td className="p-4 text-center bg-emerald-500/5"><X className="w-4 h-4 text-gray-600 mx-auto" /></td>
                <td className="p-4 text-center"><Check className="w-4 h-4 text-cyan-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-4 text-start font-medium text-white">{isAr ? "هدايا رصيد واتساب وذكاء اصطناعي" : "Gift Credits (WhatsApp & AI)"}</td>
                <td className="p-4 text-center">—</td>
                <td className="p-4 text-center bg-emerald-500/5 font-bold text-emerald-400">{isAr ? "200 واتساب + 50 AI" : "200 WA + 50 AI"}</td>
                <td className="p-4 text-center font-bold text-cyan-400">{isAr ? "باقة شهرية مجانية" : "Free Monthly Tier"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs font-semibold mb-3">
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isAr ? "إجابات واضحة وشفافة" : "Transparency & Answers"}</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white">
            {isAr ? "الأسئلة الشائعة حول التراخيص والأسعار" : "Frequently Asked Questions"}
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-[#0B101D]/80 border border-white/10 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-start flex items-center justify-between gap-4 text-sm sm:text-base font-semibold text-white hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  <span>{isAr ? faq.qAr : faq.qEn}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-emerald-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-5 pb-5 text-xs sm:text-sm text-gray-300 leading-relaxed border-t border-white/5 pt-3"
                    >
                      {isAr ? faq.aAr : faq.aEn}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Final CTA */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-cyan-500/20 border-2 border-emerald-500/40 p-8 sm:p-12 relative overflow-hidden backdrop-blur-xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            {isAr ? "جاهز لتطوير متجرك وامتلاك نظام كاشير احترافي؟" : "Ready to Supercharge Your Retail Store?"}
          </h2>
          <p className="text-sm text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            {isAr
              ? "حمّل النسخة التجريبية المجانية لمدة 30 يوماً على جهازك الآن، أو تواصل معنا مباشرة لتفعيل الترخيص والحصول على خصم الإطلاق."
              : "Download the 30-day free trial on your PC now, or reach out to get your official license with the launch discount."}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pos#downloads"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all transform hover:scale-105"
            >
              <Download className="w-4 h-4 fill-black" />
              <span>{isAr ? "تحميل النسخة التجريبية (مجاناً)" : "Download Free 30-Day Trial"}</span>
            </Link>

            <a
              href={whatsappUrl(
                isAr
                  ? "مرحباً، أود التحدث مع المبيعات بخصوص تفعيل ترخيص برنامج QuazLink POS"
                  : "Hello, I want to talk with sales about activating a QuazLink POS license"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm flex items-center justify-center gap-2 border border-white/10 transition-all hover:border-emerald-500/40"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "تحدث مع المبيعات على واتساب" : "Chat with Sales on WhatsApp"}</span>
            </a>
          </div>

          <div className="mt-6 text-xs text-gray-400 flex items-center justify-center gap-4">
            <span>📞 {isAr ? "هاتف المبيعات المباشر:" : "Direct Sales Line:"} <strong className="text-white">{salesPhone}</strong></span>
            <span>•</span>
            <span>⚡ {isAr ? "التفعيل فوري خلال دقائق" : "Instant Activation"}</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#05080E] pt-12 pb-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Store className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="font-bold text-lg text-white">QuazLink POS & ERP</span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-gray-400">
              <Link href="/pos" className="hover:text-emerald-400 transition-colors">
                {isAr ? "بوابة الكاشير" : "POS Portal"}
              </Link>
              <Link href="/pricing" className="text-emerald-400 font-semibold transition-colors">
                {isAr ? "الأسعار والباقات" : "Pricing"}
              </Link>
              <Link href="/pos#downloads" className="hover:text-emerald-400 transition-colors">
                {isAr ? "تحميل البرنامج" : "Downloads"}
              </Link>
              <Link href="/" className="hover:text-emerald-400 transition-colors">
                {isAr ? "المنصة الرئيسية" : "Cloud Platform"}
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-4">
            <p>© 2026 QuazLink Platform. {isAr ? "جميع الحقوق محفوظة." : "All rights reserved."}</p>
            <p className="font-mono text-emerald-400/80">QuazCode CoWork Architecture • v1.3.7</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
