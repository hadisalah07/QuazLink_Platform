"use client";

import * as React from "react";
import {
  Receipt,
  Copy,
  Check,
  Code2,
  Send,
  Eye,
  EyeOff,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  User,
  Hash,
  Coins,
  FileText,
  Image as ImageIcon,
  Users,
  History,
  ExternalLink,
  RefreshCw,
  Zap,
  CheckCheck
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface IntegrationConfig {
  apiKey: string;
  endpoint: string;
  activeWhatsApp: { id: string; platform: string; status: string } | null;
  defaultTemplate: string;
}

interface DispatchedHistoryItem {
  id: string;
  phone: string | null;
  targetUrl: string;
  status: string;
  createdAt: string;
  content: string;
  mediaUrls: string[];
  result?: string | null;
}

const PRESET_TEMPLATES = [
  {
    id: "invoice_thanks",
    label: "🧾 فاتورة وشكر على الشراء",
    content: `أهلاً بك يا {customerName}، شرفتنا ونورتنا بشرائك من عندنا! ❤️
📄 رقم الفاتورة: #{invoiceNumber}
💰 الإجمالي: {amount} {currency}
شكراً جزيلاً لثقتك بنا ونراك قريباً إن شاء الله! ✨`
  },
  {
    id: "order_shipping",
    label: "📦 تأكيد الطلب وجاري الشحن",
    content: `مرحباً بك {customerName} 🌸
تم تأكيد طلبك رقم #{invoiceNumber} بنجاح وجاري تجهيزه للشحن الآن 🚚
💰 إجمالي المبلغ عند الاستلام: {amount} {currency}
سيتواصل معك مندوب الشحن فور وصول الشحنة لمنطقتك. شكراً لاختيارك لنا! ❤️`
  },
  {
    id: "vip_greeting",
    label: "🌟 رسالة ترحيبية خاصة (VIP)",
    content: `أهلاً وسهلاً بك يا {customerName}! 🌟
سعداء جداً بانضمامك لعائلة عملائنا المميزين.
📄 مرجع حسابك/الطلب: #{invoiceNumber}
إذا كان لديك أي استفسار أو طلب، نحن دائماً في خدمتك على هذا الرقم! 🤝`
  },
  {
    id: "custom",
    label: "✏️ رسالة حرة مخصصة",
    content: ""
  }
];

export default function IntegrationsPage() {
  const [activeMainTab, setActiveMainTab] = React.useState<"manual" | "bulk" | "api" | "history">("manual");
  const [config, setConfig] = React.useState<IntegrationConfig | null>(null);
  const [historyItems, setHistoryItems] = React.useState<DispatchedHistoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Copy state
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [showKey, setShowKey] = React.useState(false);
  const [activeSnippet, setActiveSnippet] = React.useState<"nextjs" | "curl" | "nodejs" | "php">("nextjs");

  // Manual Form State
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("invoice_thanks");
  const [form, setForm] = React.useState({
    phone: "01012345678",
    customerName: "أحمد مصطفى",
    invoiceNumber: "INV-4029",
    amount: "1,750",
    currency: "ج.م",
    customMessage: PRESET_TEMPLATES[0].content,
    mediaUrl: "",
  });
  const [isSending, setIsSending] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string; jobId?: string; normalizedPhone?: string } | null>(null);

  // Bulk Form State
  const [bulkNumbers, setBulkNumbers] = React.useState("01012345678\n01123456789\n01234567890");
  const [bulkCustomerName, setBulkCustomerName] = React.useState("عميلنا العزيز");
  const [bulkMessage, setBulkMessage] = React.useState(PRESET_TEMPLATES[0].content);
  const [isBulkSending, setIsBulkSending] = React.useState(false);
  const [bulkResult, setBulkResult] = React.useState<{ total: number; dispatched: number } | null>(null);

  // Load configuration
  const loadConfig = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/integrations/config");
      if (!res.ok) throw new Error("Failed to load integration settings");
      const data = await res.json();
      setConfig(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load history
  const loadHistory = React.useCallback(async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch("/api/integrations/history");
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data.jobs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  React.useEffect(() => {
    if (activeMainTab === "history") {
      loadHistory();
    }
  }, [activeMainTab, loadHistory]);

  const handleCopy = (text: string, type: "key" | "url" | "code") => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Generate random invoice number
  const handleGenerateInvoice = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setForm(prev => ({ ...prev, invoiceNumber: `INV-${randomNum}` }));
  };

  // Handle template selection
  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const found = PRESET_TEMPLATES.find(t => t.id === tplId);
    if (found && found.content) {
      setForm(prev => ({ ...prev, customMessage: found.content }));
    }
  };

  // Live Phone Normalization Preview
  const phoneValidation = React.useMemo(() => {
    const raw = form.phone.replace(/\D/g, "");
    if (!raw) return { isValid: false, normalized: "", isEgypt: false, formatted: "" };

    let clean = raw;
    if (clean.startsWith("00")) clean = clean.slice(2);
    const isEgyptLocal = clean.length === 11 && clean.startsWith("01");
    const isEgyptIntl = clean.startsWith("20") && clean.length === 12;

    if (isEgyptLocal) {
      return {
        isValid: true,
        normalized: "20" + clean.slice(1),
        formatted: `+20 ${clean.slice(1, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`,
        isEgypt: true
      };
    }
    if (isEgyptIntl) {
      return {
        isValid: true,
        normalized: clean,
        formatted: `+${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`,
        isEgypt: true
      };
    }

    if (clean.length >= 8 && clean.length <= 15) {
      return {
        isValid: true,
        normalized: clean,
        formatted: `+${clean}`,
        isEgypt: false
      };
    }

    return { isValid: false, normalized: clean, isEgypt: false, formatted: raw };
  }, [form.phone]);

  // Preview message formatting
  const previewText = React.useMemo(() => {
    const template = form.customMessage.trim() || config?.defaultTemplate || PRESET_TEMPLATES[0].content;
    return template
      .replace(/\{customerName\}/gi, form.customerName || "عميلنا العزيز")
      .replace(/\{invoiceNumber\}/gi, form.invoiceNumber || "INV-000")
      .replace(/\{amount\}/gi, form.amount || "0")
      .replace(/\{currency\}/gi, form.currency || "ج.م")
      .replace(/\{phone\}/gi, phoneValidation.normalized || form.phone || "");
  }, [form, config, phoneValidation]);

  // Insert tag into message textarea
  const handleInsertTag = (tag: string) => {
    setForm(prev => ({ ...prev, customMessage: prev.customMessage + " " + tag }));
  };

  // Handle manual single send
  const handleManualSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/integrations/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config?.apiKey ? { "X-API-Key": config.apiKey } : {}),
        },
        body: JSON.stringify({
          phone: form.phone,
          customerName: form.customerName,
          invoiceNumber: form.invoiceNumber,
          amount: form.amount,
          currency: form.currency,
          message: form.customMessage || undefined,
          mediaUrls: form.mediaUrl ? [form.mediaUrl] : [],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل إرسال الفاتورة عبر واتساب");
      }

      setTestResult({
        success: true,
        message: `تم إرسال الفاتورة بنجاح! تم توجيه المهمة لحظياً للـ Desktop Runner (Job #${data.jobId?.slice(-6)})`,
        jobId: data.jobId,
        normalizedPhone: data.recipient?.cleanPhone,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "حدث خطأ غير متوقع أثناء إرسال الفاتورة",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle manual bulk send
  const handleBulkSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawList = bulkNumbers.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    if (rawList.length === 0) return;

    setIsBulkSending(true);
    setBulkResult(null);

    try {
      const items = rawList.map(phone => ({
        phone,
        customerName: bulkCustomerName,
        message: bulkMessage,
      }));

      const res = await fetch("/api/integrations/whatsapp/send-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config?.apiKey ? { "X-API-Key": config.apiKey } : {}),
        },
        body: JSON.stringify({ items, messageTemplate: bulkMessage }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إرسال الدفعة");

      setBulkResult({
        total: data.totalCount,
        dispatched: data.dispatchedCount,
      });
    } catch (err: any) {
      alert("خطأ: " + err.message);
    } finally {
      setIsBulkSending(false);
    }
  };

  const endpointUrl = config?.endpoint || "https://api.quazlink.site/api/integrations/whatsapp/send";

  const codeSnippets = {
    nextjs: `// In your Next.js project (e.g. Gallary NextJS - src/lib/server/quazlink-server.js)
import { sendQuazLinkInvoiceWhatsApp } from '@/lib/server/quazlink-server';

// Call it in after() when a new order is placed:
await sendQuazLinkInvoiceWhatsApp({
  phoneNumber: order.customer.phone,
  customerName: order.customer.name,
  invoiceNumber: order.id,
  amount: order.totalAmount,
  currency: 'ج.م',
});`,
    curl: `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${config?.apiKey || "ql_live_YOUR_KEY"}" \\
  -d '{
    "phone": "01012345678",
    "customerName": "أحمد مصطفى",
    "invoiceNumber": "INV-1024",
    "amount": "1,750",
    "currency": "ج.م"
  }'`,
    nodejs: `const fetch = require('node-fetch');

async function sendWhatsAppInvoice() {
  const response = await fetch("${endpointUrl}", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "${config?.apiKey || "ql_live_YOUR_KEY"}"
    },
    body: JSON.stringify({
      phone: "01012345678",
      customerName: "أحمد مصطفى",
      invoiceNumber: "INV-1024",
      amount: "1750",
      currency: "ج.م"
    })
  });
  const data = await response.json();
  console.log("Invoice dispatched:", data);
}

sendWhatsAppInvoice();`,
    php: `<?php
$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => "${endpointUrl}",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => "POST",
  CURLOPT_POSTFIELDS => json_encode([
    "phone" => "01012345678",
    "customerName" => "أحمد مصطفى",
    "invoiceNumber" => "INV-1024",
    "amount" => "1750",
    "currency" => "ج.م"
  ]),
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "X-API-Key: ${config?.apiKey || "ql_live_YOUR_KEY"}"
  ],
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;`
  };

  return (
    <div className="flex flex-col space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              DIRECT PORTAL &amp; API
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Desktop Runner Ready
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Receipt className="w-8 h-8 text-[var(--color-quaz-cyan)]" />
            WhatsApp Invoicing &amp; Messaging Portal
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            أرسل فواتير ورسائل ترحيب وشكر لعملائك عبر واتساب يدوياً بنقرة واحدة، أو اربط متجرك الإلكتروني تلقائياً عبر الـ Webhook &amp; API.
          </p>
        </div>

        {/* WhatsApp Account Status Badge */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-xl">
          <Smartphone className="w-5 h-5 text-emerald-400" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400">WhatsApp Engine</span>
            <span className="text-xs font-semibold text-white flex items-center gap-1">
              {config?.activeWhatsApp ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  حساب واتساب نشط ومتصل
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  جاهز عبر جلسة Desktop Runner
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveMainTab("manual")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeMainTab === "manual"
              ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)] font-bold"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Send className="w-4 h-4" />
          الإرسال اليدوي المباشر (Manual Sender)
        </button>

        <button
          onClick={() => setActiveMainTab("bulk")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeMainTab === "bulk"
              ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)] font-bold"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Users className="w-4 h-4" />
          إرسال يدوي لعدة أرقام (Bulk Numbers)
        </button>

        <button
          onClick={() => setActiveMainTab("api")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeMainTab === "api"
              ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)] font-bold"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Code2 className="w-4 h-4" />
          الربط التلقائي والـ API (Integration &amp; Keys)
        </button>

        <button
          onClick={() => setActiveMainTab("history")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeMainTab === "history"
              ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)] font-bold"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <History className="w-4 h-4" />
          سجل الرسائل المرسلة (Delivery Logs)
        </button>
      </div>

      {/* TAB 1: MANUAL DIRECT SENDER */}
      {activeMainTab === "manual" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Column */}
          <div className="lg:col-span-7 space-y-6">
            <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] shadow-xl">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Send className="w-5 h-5 text-cyan-400" />
                    بيانات العميل والفاتورة (إرسال يدوي فوري)
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    اكتب بيانات العميل، وسيفتح المحرك شات الواتساب مباشرة لإرسال الرسالة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateInvoice}
                  className="px-3 py-1.5 text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  رقم فاتورة عشوائي
                </button>
              </div>

              <form onSubmit={handleManualSend} className="space-y-5">
                {/* Phone & Customer Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      رقم واتساب العميل *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="01012345678 أو 2010..."
                        dir="ltr"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                      />
                    </div>
                    {/* Live Egyptian / Intl phone indicator */}
                    <div className="mt-1.5">
                      {phoneValidation.isValid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          <Check className="w-3 h-3" />
                          {phoneValidation.isEgypt ? "🇪🇬 مصر:" : "🌐 دولي:"} {phoneValidation.formatted}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-500 font-mono">
                          يقبل 010... محلي مصري أو رقم دولي كامل
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      اسم العميل
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.customerName}
                        onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                        placeholder="مثال: أحمد مصطفى"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Invoice Number & Amount & Currency */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      رقم الفاتورة / المرجع
                    </label>
                    <input
                      type="text"
                      value={form.invoiceNumber}
                      onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                      placeholder="INV-4029"
                      dir="ltr"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      إجمالي المبلغ
                    </label>
                    <input
                      type="text"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="1,750"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      العملة
                    </label>
                    <select
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                    >
                      <option value="ج.م">ج.م (EGP)</option>
                      <option value="SAR">ر.س (SAR)</option>
                      <option value="AED">د.إ (AED)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>

                {/* Preset Templates Selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-2">
                    اختيار نموذج الرسالة السريع
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                    {PRESET_TEMPLATES.map((tpl) => (
                      <button
                        type="button"
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl.id)}
                        className={`p-2.5 rounded-xl text-xs text-right border transition-all cursor-pointer ${
                          selectedTemplateId === tpl.id
                            ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)] font-semibold"
                            : "bg-black/30 border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                        }`}
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Message Box */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-gray-300">
                      نص الرسالة المرسلة
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">إدراج متغير:</span>
                      {["{customerName}", "{invoiceNumber}", "{amount}", "{currency}"].map((tag) => (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => handleInsertTag(tag)}
                          className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-cyan-400 border border-white/5 transition-colors cursor-pointer"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={form.customMessage}
                    onChange={(e) => setForm({ ...form, customMessage: e.target.value })}
                    placeholder="اكتب نص الرسالة هنا..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors leading-relaxed"
                  />
                </div>

                {/* Optional Media URL */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                    رابط صورة الفاتورة أو المنتج (اختياري)
                  </label>
                  <input
                    type="url"
                    value={form.mediaUrl}
                    onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
                    placeholder="https://example.com/invoices/inv-4029.jpg"
                    dir="ltr"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={isSending || !phoneValidation.isValid}
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_25px_rgba(34,211,238,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جاري توجيه الفاتورة إلى واتساب...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      إرسال الفاتورة عبر واتساب الآن (Send WhatsApp Now)
                    </>
                  )}
                </button>

                {/* Result Alert */}
                {testResult && (
                  <div
                    className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${
                      testResult.success
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{testResult.message}</p>
                      {testResult.normalizedPhone && (
                        <p className="text-xs text-emerald-400/80 mt-1 font-mono">
                          الرقم المستهدف في واتساب: +{testResult.normalizedPhone}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </SpotlightCard>
          </div>

          {/* WhatsApp Live Preview Column */}
          <div className="lg:col-span-5 space-y-6">
            <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[#0b141a] shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                    {form.customerName ? form.customerName.slice(0, 1) : "ع"}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {form.customerName || "عميلنا العزيز"}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {phoneValidation.isValid ? phoneValidation.formatted : form.phone}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-1 rounded-md">
                  معاينة مباشرة (Live WhatsApp)
                </span>
              </div>

              {/* WhatsApp Chat Background Wallpaper */}
              <div className="p-4 rounded-xl bg-[#0b141a] min-h-[300px] flex flex-col justify-end relative">
                {/* Bubble Container */}
                <div className="self-end max-w-[92%] bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-sm p-3.5 shadow-md relative text-sm leading-relaxed border border-emerald-500/20">
                  {/* Media image preview if provided */}
                  {form.mediaUrl && (
                    <div className="mb-2.5 rounded-lg overflow-hidden border border-white/10 bg-black/40">
                      <img
                        src={form.mediaUrl}
                        alt="Invoice preview"
                        className="w-full max-h-48 object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {/* Message Text */}
                  <div className="whitespace-pre-wrap font-sans text-[13px] text-right" dir="rtl">
                    {previewText}
                  </div>

                  {/* Bubble Timestamp & Ticks */}
                  <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-emerald-200/60 font-mono">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <CheckCheck className="w-3.5 h-3.5 text-cyan-300 inline-block" />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-cyan-400" />
                  يتم الإرسال مباشرة من الـ Desktop Runner
                </span>
                <span className="text-emerald-400 font-mono font-semibold">تشفير تام 100%</span>
              </div>
            </SpotlightCard>

            {/* Quick Steps Info Card */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                كيف تتم الأتمتة اليدوية؟
              </h3>
              <ol className="text-xs text-gray-400 space-y-2 list-decimal list-inside leading-relaxed">
                <li>عند الضغط على <strong className="text-white">إرسال الفاتورة</strong>، يتم إنشاء أمر الإرسال فوراً.</li>
                <li>يستقبل الـ <strong className="text-cyan-300">Desktop Runner</strong> الأمر عبر الـ WebSocket في 0 ثانية.</li>
                <li>يفتح المتصفح محادثة الرقم مباشرة ويكتب الرسالة ويرفق الصورة إن وجدت.</li>
                <li>ينتظر اكتمال تسليم الرسالة، ويلتقط لقطة شاشة لإثبات التسليم.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BULK MANUAL SENDER */}
      {activeMainTab === "bulk" && (
        <div className="max-w-3xl mx-auto space-y-6">
          <SpotlightCard className="p-6 md:p-8 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                إرسال يدوي جماعي لعدة أرقام (Bulk Recipients)
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                الصق قائمة بأرقام العملاء (رقم في كل سطر أو مفصولة بفواصل)، وسيتم إرسال الرسالة لكل رقم تباعاً وبأمان.
              </p>
            </div>

            <form onSubmit={handleBulkSend} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  قائمة أرقام الهواتف (رقم في كل سطر)
                </label>
                <textarea
                  rows={6}
                  required
                  value={bulkNumbers}
                  onChange={(e) => setBulkNumbers(e.target.value)}
                  placeholder="01012345678&#10;01123456789&#10;+201234567890"
                  dir="ltr"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 transition-colors leading-relaxed"
                />
                <div className="mt-1 text-[11px] text-gray-400">
                  الأرقام المكتوبة: {bulkNumbers.split(/[\n,;]+/).filter(s => s.trim()).length} رقم
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  اسم العميل الافتراضي (إذا لم يُحدد)
                </label>
                <input
                  type="text"
                  value={bulkCustomerName}
                  onChange={(e) => setBulkCustomerName(e.target.value)}
                  placeholder="عميلنا العزيز"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  نص الرسالة الموحدة
                </label>
                <textarea
                  rows={4}
                  required
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isBulkSending}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_25px_rgba(34,211,238,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isBulkSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري إرسال الدفعة...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    إرسال إلى جميع الأرقام المحددة (Send to All)
                  </>
                )}
              </button>

              {bulkResult && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>
                    تم توجيه <strong>{bulkResult.dispatched}</strong> من أصل <strong>{bulkResult.total}</strong> للـ Desktop Runner بنجاح!
                  </span>
                </div>
              )}
            </form>
          </SpotlightCard>
        </div>
      )}

      {/* TAB 3: API & WEBHOOK INTEGRATION */}
      {activeMainTab === "api" && (
        <div className="space-y-6">
          {/* API Key & Endpoint Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* API Key Card */}
            <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-purple-400" />
                    <h3 className="text-base font-bold text-white">مفتاح الربط البرمجي (Integration Key)</h3>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-md">
                    Permanent API Key
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                  استخدم هذا المفتاح في هيدر الطلبات (`X-API-Key`) لربط متجر Gallary NextJS أو أي تطبيق خارجي.
                </p>

                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-3 font-mono text-xs">
                  <span className="truncate text-gray-300">
                    {showKey
                      ? config?.apiKey || "ql_live_..."
                      : (config?.apiKey ? config.apiKey.slice(0, 14) + "••••••••••••••••••••••••" : "جاري التحميل...")}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
                      title={showKey ? "Hide key" : "Show key"}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleCopy(config?.apiKey || "", "key")}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-colors flex items-center gap-1 text-xs cursor-pointer"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? "تم النسخ" : "نسخ"}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                <span>تشفير HS256 متطابق</span>
                <span className="text-purple-400">Zero-DB Overhead</span>
              </div>
            </SpotlightCard>

            {/* Inbound Webhook Endpoint Card */}
            <SpotlightCard className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-base font-bold text-white">رابط استقبال الفواتير (Inbound Webhook)</h3>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded-md">
                    POST Webhook
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                  أرسل طلبات الـ POST المحتوية على رقم الهاتف واسم العميل إلى هذا المسار:
                </p>

                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-3 font-mono text-xs">
                  <span className="truncate text-cyan-300">{endpointUrl}</span>
                  <button
                    onClick={() => handleCopy(endpointUrl, "url")}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-colors flex items-center gap-1 text-xs flex-shrink-0 cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? "تم النسخ" : "نسخ الرابط"}</span>
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                <span>JSON Payload Support</span>
                <span className="text-cyan-400">E.164 Auto Normalization</span>
              </div>
            </SpotlightCard>
          </div>

          {/* Code Snippets Section */}
          <SpotlightCard className="p-6 md:p-8 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">كود الربط الجاهز (Ready Code Snippets)</h3>
              </div>

              <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                {[
                  { key: "nextjs", label: "Next.js (Gallary)" },
                  { key: "curl", label: "cURL" },
                  { key: "nodejs", label: "Node.js" },
                  { key: "php", label: "PHP" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSnippet(tab.key as any)}
                    className={`px-3 py-1 text-xs font-mono rounded-lg transition-all cursor-pointer ${
                      activeSnippet === tab.key
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <pre className="p-4 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed max-h-[280px]">
                <code>{codeSnippets[activeSnippet]}</code>
              </pre>
              <button
                onClick={() => handleCopy(codeSnippets[activeSnippet], "code")}
                className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? "تم النسخ" : "نسخ الكود"}</span>
              </button>
            </div>
          </SpotlightCard>
        </div>
      )}

      {/* TAB 4: DISPATCHED HISTORY & LOGS */}
      {activeMainTab === "history" && (
        <div className="space-y-6">
          <SpotlightCard className="p-6 md:p-8 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">سجل العمليات والفواتير المرسلة (Recent Logs)</h3>
              </div>
              <button
                onClick={loadHistory}
                disabled={historyLoading}
                className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin" : ""}`} />
                تحديث السجل
              </button>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                جاري تحميل سجل الرسائل...
              </div>
            ) : historyItems.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                لا توجد رسائل مرسلة بعد. جرّب إرسال أول فاتورة من تبويب <strong className="text-cyan-400 cursor-pointer" onClick={() => setActiveMainTab("manual")}>الإرسال اليدوي المباشر</strong>!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 font-mono">
                      <th className="py-3 px-4">رقم المهمة</th>
                      <th className="py-3 px-4">رقم الواتساب</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4">تاريخ الإرسال</th>
                      <th className="py-3 px-4">محتوى الرسالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {historyItems.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono text-gray-400">#{item.id.slice(-6)}</td>
                        <td className="py-3 px-4 font-mono text-cyan-300" dir="ltr">
                          {item.phone ? `+${item.phone}` : "مباشر"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              item.status === "completed" || item.status === "success"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : item.status === "failed"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {item.status === "completed" || item.status === "success" ? "تم التسليم بنجاح ✅" : item.status === "failed" ? "فشل ❌" : "جاري التنفيذ ⏳"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400 font-mono">
                          {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 text-gray-300 max-w-xs truncate">
                          {item.content}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SpotlightCard>
        </div>
      )}
    </div>
  );
}
