"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Smartphone,
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  CreditCard,
  Banknote,
  CheckCircle2,
  Printer,
  Share2,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Camera,
  Sparkles,
  Clock,
  ArrowLeft,
  ArrowRight,
  Tag,
  Sliders,
  User,
  Phone,
  ShieldCheck,
  Wifi,
  WifiOff,
  FileText,
  Zap,
  ExternalLink,
  Volume2,
  VolumeX,
  BadgeCheck,
  Calculator,
  Receipt,
  Layers,
  Percent,
} from "lucide-react";
import {
  pushPosSync,
  getPosBranches,
  getMe,
  type PosBranchItem,
  type PosSyncInvoicePayload,
  type AuthUser,
} from "@/lib/api";

// --- Types ---

export interface ProductItem {
  id: string;
  nameAr: string;
  nameEn: string;
  category: string;
  price: number;
  cost?: number;
  barcode: string;
  stock: number;
  emoji: string;
  badge?: string;
}

export interface CartItem {
  product: ProductItem;
  quantity: number;
  customPrice?: number;
  discount?: number;
}

// Built-in high-quality retail catalog (Egypt Market ready)
const INITIAL_PRODUCTS: ProductItem[] = [
  {
    id: "prod-1",
    nameAr: "كابل شاحن سريع Type-C إلى Type-C بقوة 60W (مقاوم للقطع 1.2M)",
    nameEn: "Type-C to Type-C 60W Fast Charging Braided Cable",
    category: "chargers",
    price: 180,
    cost: 95,
    barcode: "6221001001",
    stock: 45,
    emoji: "⚡",
    badge: "الأكثر طلباً",
  },
  {
    id: "prod-2",
    nameAr: "رأس شاحن سريع Anker Nano 3 بقوة 30W شحن فائق",
    nameEn: "Anker Nano 3 30W Fast Wall Charger PIQ 3.0",
    category: "chargers",
    price: 650,
    cost: 440,
    barcode: "6221001002",
    stock: 18,
    emoji: "🔌",
    badge: "ضمان 18 شهر",
  },
  {
    id: "prod-3",
    nameAr: "لاصقة حماية 9D سيراميك مضادة للبصمات (آيفون 15 / 16)",
    nameEn: "Ceramic 9D Matte Screen Protector iPhone 15/16",
    category: "cases",
    price: 120,
    cost: 35,
    barcode: "6221001003",
    stock: 90,
    emoji: "🛡️",
    badge: "خصم كمية",
  },
  {
    id: "prod-4",
    nameAr: "جراب سيليكون أصلي ماج سيف مغناطيسي MagSafe (كحلي ملكي)",
    nameEn: "Liquid Silicone Case with MagSafe Magnetic Ring",
    category: "cases",
    price: 290,
    cost: 130,
    barcode: "6221001004",
    stock: 32,
    emoji: "📱",
  },
  {
    id: "prod-5",
    nameAr: "سماعة بلوتوث لاسلكية Earbuds Pro مع خاصية إلغاء الضوضاء ANC",
    nameEn: "Wireless Earbuds Pro with Active Noise Cancellation",
    category: "audio",
    price: 850,
    cost: 520,
    barcode: "6221001005",
    stock: 14,
    emoji: "🎧",
    badge: "صوت نقي",
  },
  {
    id: "prod-6",
    nameAr: "باور بانك 20,000 مللي أمبير بقوة 22.5W مدخل ومخرج سريع",
    nameEn: "PowerBank 20,000mAh 22.5W Fast Charge PD+QC",
    category: "chargers",
    price: 990,
    cost: 680,
    barcode: "6221001006",
    stock: 22,
    emoji: "🔋",
  },
  {
    id: "prod-7",
    nameAr: "ساعة ذكية Ultra Smart Watch مقاس 49mm مع 3 أحزمة مختلفة",
    nameEn: "Smart Watch Ultra 49mm with 3 Straps and Health Tracker",
    category: "gadgets",
    price: 1450,
    cost: 950,
    barcode: "6221001007",
    stock: 11,
    emoji: "⌚",
    badge: "عرض خاص",
  },
  {
    id: "prod-8",
    nameAr: "حامل هاتف للسيارة مغناطيسي يثبت على فتحات المكيف",
    nameEn: "Magnetic Car Air Vent Phone Mount Holder",
    category: "cases",
    price: 160,
    cost: 75,
    barcode: "6221001008",
    stock: 26,
    emoji: "🚗",
  },
  {
    id: "prod-9",
    nameAr: "هاتف Xiaomi Redmi 13C سعة 128GB رام 6GB (ضمان محلي)",
    nameEn: "Xiaomi Redmi 13C 128GB 6GB RAM (Official Warranty)",
    category: "phones",
    price: 5850,
    cost: 5400,
    barcode: "6221001009",
    stock: 6,
    emoji: "📲",
    badge: "سعر حصري",
  },
  {
    id: "prod-10",
    nameAr: "خدمة تنظيف وصيانة فتحات الشحن والسماعات وتغيير بطارية",
    nameEn: "Mobile Deep Cleaning & Battery Replacement Service",
    category: "services",
    price: 250,
    cost: 50,
    barcode: "6221001010",
    stock: 999,
    emoji: "🔧",
  },
];

const CATEGORIES = [
  { id: "all", labelAr: "الكل", labelEn: "All", emoji: "🌟" },
  { id: "chargers", labelAr: "شواحن وكابلات", labelEn: "Chargers", emoji: "⚡" },
  { id: "cases", labelAr: "جرابات وحماية", labelEn: "Cases & Glass", emoji: "🛡️" },
  { id: "audio", labelAr: "سماعات وصوتيات", labelEn: "Audio", emoji: "🎧" },
  { id: "phones", labelAr: "هواتف ذكية", labelEn: "Smartphones", emoji: "📱" },
  { id: "gadgets", labelAr: "ساعات وإلكترونيات", labelEn: "Gadgets", emoji: "⌚" },
  { id: "services", labelAr: "صيانة وخدمات", labelEn: "Services", emoji: "🔧" },
];

export default function MobilePosPage() {
  // Locale & direction
  const [isAr, setIsAr] = React.useState(true);

  // Authentication & Branch Context
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(null);
  const [branches, setBranches] = React.useState<PosBranchItem[]>([]);
  const [selectedBranch, setSelectedBranch] = React.useState<string>("main");
  const [cashierName, setCashierName] = React.useState<string>("كاشير الموبايل");
  const [hardwareId, setHardwareId] = React.useState<string>("");
  const [isOnline, setIsOnline] = React.useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = React.useState<boolean>(true);

  // Catalog & Search State
  const [products, setProducts] = React.useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [activeCategory, setActiveCategory] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Cart State
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = React.useState<boolean>(false);
  const [customerName, setCustomerName] = React.useState<string>("عميل نقدي");
  const [customerPhone, setCustomerPhone] = React.useState<string>("");
  const [paymentMethod, setPaymentMethod] = React.useState<"cash" | "card" | "credit">("cash");
  const [cashPaidAmount, setCashPaidAmount] = React.useState<string>("");
  const [applyVat, setApplyVat] = React.useState<boolean>(false);
  const [orderDiscount, setOrderDiscount] = React.useState<number>(0);

  // Checkout & Modals
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [completedInvoice, setCompletedInvoice] = React.useState<PosSyncInvoicePayload | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = React.useState<boolean>(false);
  const [isCustomItemModalOpen, setIsCustomItemModalOpen] = React.useState<boolean>(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = React.useState<boolean>(false);
  const [customItemName, setCustomItemName] = React.useState<string>("");
  const [customItemPrice, setCustomItemPrice] = React.useState<string>("");
  const [customItemQty, setCustomItemQty] = React.useState<number>(1);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Camera Barcode Scanning
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = React.useState<boolean>(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  // Audio synthesizer
  const playSound = React.useCallback(
    (type: "beep" | "success" | "delete") => {
      if (!soundEnabled || typeof window === "undefined") return;
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "beep") {
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
          osc.start();
          osc.stop(ctx.currentTime + 0.08);
        } else if (type === "success") {
          osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
          osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
          osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        } else if (type === "delete") {
          osc.frequency.setValueAtTime(260, ctx.currentTime);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
          osc.start();
          osc.stop(ctx.currentTime + 0.08);
        }
      } catch {}
    },
    [soundEnabled]
  );

  const triggerHaptic = (ms = 15) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  // 1. Initial Setup: Load hardware ID, branches, user profile
  React.useEffect(() => {
    // Generate or retrieve persistent Mobile Hardware ID
    let hw = localStorage.getItem("quazlink_mobile_hw_id");
    if (!hw) {
      hw = "MOB-PWA-" + Math.random().toString(36).substring(2, 9).toUpperCase();
      localStorage.setItem("quazlink_mobile_hw_id", hw);
    }
    setHardwareId(hw);

    // Network status listener
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    setIsOnline(navigator.onLine);

    // Fetch user and branches
    getMe()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
          if (user.name) setCashierName(user.name);
        }
      })
      .catch(() => {});

    getPosBranches()
      .then((data) => {
        if (data.branches && data.branches.length > 0) {
          setBranches(data.branches);
          setSelectedBranch(data.branches[0].branchCode);
        }
      })
      .catch(() => {
        // Fallback default branches
        setBranches([
          { id: "b-main", branchCode: "main", name: "الفرع الرئيسي (HQ)", city: "القاهرة", isActive: true, createdAt: new Date().toISOString() },
          { id: "b-nasr", branchCode: "branch_nasr", name: "فرع مدينة نصر", city: "القاهرة", isActive: true, createdAt: new Date().toISOString() },
        ]);
      });

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  // 2. Filter Products
  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = activeCategory === "all" || p.category === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesCategory;
      const matchesSearch =
        p.nameAr.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchQuery]);

  // 3. Cart Calculations
  const subtotal = React.useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.customPrice ?? item.product.price;
      const itemDiscount = item.discount ?? 0;
      return sum + (price - itemDiscount) * item.quantity;
    }, 0);
  }, [cart]);

  const vatAmount = React.useMemo(() => {
    return applyVat ? subtotal * 0.14 : 0;
  }, [subtotal, applyVat]);

  const totalAmount = React.useMemo(() => {
    const afterDiscount = Math.max(0, subtotal + vatAmount - orderDiscount);
    return Math.round(afterDiscount * 100) / 100;
  }, [subtotal, vatAmount, orderDiscount]);

  const totalItemsCount = React.useMemo(() => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  }, [cart]);

  // Quick cash change calculations
  const parsedCashPaid = parseFloat(cashPaidAmount) || 0;
  const cashChange = paymentMethod === "cash" && parsedCashPaid >= totalAmount ? parsedCashPaid - totalAmount : 0;

  // Add Product to Cart
  const handleAddToCart = (product: ProductItem) => {
    playSound("beep");
    triggerHaptic(20);
    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.product.id === product.id);
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + 1,
        };
        return next;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  // Modify Quantity
  const handleUpdateQuantity = (productId: string, delta: number) => {
    triggerHaptic(15);
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) {
              playSound("delete");
              return null;
            }
            playSound("beep");
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remove Item
  const handleRemoveItem = (productId: string) => {
    playSound("delete");
    triggerHaptic(30);
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  // Clear Cart
  const handleClearCart = () => {
    playSound("delete");
    triggerHaptic(40);
    setCart([]);
    setCashPaidAmount("");
    setCustomerPhone("");
    setCustomerName("عميل نقدي");
    setOrderDiscount(0);
    setIsCartOpen(false);
  };

  // Add Quick Custom Item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(customItemPrice);
    if (!customItemName.trim() || isNaN(priceNum) || priceNum <= 0) {
      showToast(isAr ? "يرجى إدخال اسم وسعر صالح للصنف" : "Please enter valid item name and price");
      return;
    }

    const customProd: ProductItem = {
      id: "custom-" + Date.now(),
      nameAr: customItemName.trim(),
      nameEn: customItemName.trim(),
      category: "services",
      price: priceNum,
      barcode: "CUST-" + Math.floor(1000 + Math.random() * 9000),
      stock: 999,
      emoji: "✨",
      badge: "صنف يدوي",
    };

    setCart((prev) => [...prev, { product: customProd, quantity: customItemQty }]);
    playSound("success");
    triggerHaptic(25);
    setIsCustomItemModalOpen(false);
    setCustomItemName("");
    setCustomItemPrice("");
    setCustomItemQty(1);
    showToast(isAr ? "تمت إضافة الصنف للسلة بنجاح" : "Custom item added to cart");
  };

  // Camera Barcode Scanning Handler
  const startCameraScan = async () => {
    setCameraError(null);
    setIsScannerModalOpen(true);
    setCameraActive(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("الكاميرا غير مدعومة على هذا المتصفح");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError(err.message || "تعذر فتح الكاميرا");
    }
  };

  const stopCameraScan = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsScannerModalOpen(false);
  };

  // Simulate scanning a barcode or manual barcode submission
  const handleBarcodeScanned = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    const matched = products.find(
      (p) => p.barcode === cleanCode || p.barcode.endsWith(cleanCode) || p.id === cleanCode
    );

    if (matched) {
      handleAddToCart(matched);
      showToast(`✅ ${isAr ? matched.nameAr : matched.nameEn}`);
      stopCameraScan();
    } else {
      playSound("delete");
      showToast(isAr ? `الباركود [${cleanCode}] غير مسجل` : `Barcode [${cleanCode}] not found`);
    }
  };

  // Execute Order Submission & Push to Cloud API
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setIsSubmitting(true);
    triggerHaptic(40);

    const invoiceTimestamp = new Date();
    const shortRandom = Math.floor(10000 + Math.random() * 90000);
    const invoiceNum = `INV-M-${selectedBranch.toUpperCase()}-${shortRandom}`;
    const localId = `mob-${Date.now()}`;

    let paid = totalAmount;
    let remaining = 0;

    if (paymentMethod === "cash") {
      paid = parsedCashPaid > 0 ? Math.min(totalAmount, parsedCashPaid) : totalAmount;
      remaining = Math.max(0, totalAmount - paid);
    } else if (paymentMethod === "credit") {
      paid = 0;
      remaining = totalAmount;
    }

    const invoicePayload: PosSyncInvoicePayload = {
      id: localId,
      invoiceNumber: invoiceNum,
      customerName: customerName.trim() || (isAr ? "عميل نقدي" : "Cash Customer"),
      customerPhone: customerPhone.trim() || null,
      totalAmount,
      paidAmount: paid,
      remainingAmount: remaining,
      paymentMethod,
      cashierName: cashierName.trim(),
      itemsCount: totalItemsCount,
      status: "completed",
      created_at: invoiceTimestamp.toISOString(),
      rawItems: cart.map((i) => ({
        id: i.product.id,
        name: isAr ? i.product.nameAr : i.product.nameEn,
        barcode: i.product.barcode,
        price: i.customPrice ?? i.product.price,
        quantity: i.quantity,
        total: (i.customPrice ?? i.product.price) * i.quantity,
      })),
    };

    try {
      // Direct high-speed atomic push to Cloud Multi-Branch Monitor
      await pushPosSync({
        branchCode: selectedBranch,
        hardwareId,
        invoices: [invoicePayload],
      });

      playSound("success");
      setCompletedInvoice(invoicePayload);
      setIsSuccessModalOpen(true);
      setIsCartOpen(false);
      setCart([]);
      setCashPaidAmount("");
    } catch (err: any) {
      console.warn("Offline or sync delay, queued locally:", err);
      // Even if network fails, preserve invoice offline & confirm to cashier
      try {
        const offlineQueue = JSON.parse(localStorage.getItem("pos_offline_invoices") || "[]");
        offlineQueue.push(invoicePayload);
        localStorage.setItem("pos_offline_invoices", JSON.stringify(offlineQueue));
      } catch {}

      playSound("success");
      setCompletedInvoice(invoicePayload);
      setIsSuccessModalOpen(true);
      setIsCartOpen(false);
      setCart([]);
      setCashPaidAmount("");
      showToast(isAr ? "تم حفظ الفاتورة محلياً وسيتم مزامنتها فور عودة الاتصال" : "Invoice saved locally (Offline Ready)");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate WhatsApp formatted receipt message
  const handleSendWhatsApp = () => {
    if (!completedInvoice) return;
    const phone = completedInvoice.customerPhone || "";
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.startsWith("0") ? "2" + cleanPhone : cleanPhone;

    const branchObj = branches.find((b) => b.branchCode === selectedBranch);
    const branchTitle = branchObj?.name || selectedBranch.toUpperCase();

    const dateStr = new Date(completedInvoice.created_at || Date.now()).toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    let itemsText = "";
    if (Array.isArray(completedInvoice.rawItems)) {
      itemsText = completedInvoice.rawItems
        .map((it: any) => `• ${it.name} (×${it.quantity}) - ${it.total} ج.م`)
        .join("\n");
    }

    const message = `🧾 *فاتورة إلكترونية - QuazLink Retail*
━━━━━━━━━━━━━━━━━━━
📍 *الفرع:* ${branchTitle}
🔢 *رقم الفاتورة:* #${completedInvoice.invoiceNumber}
📅 *التاريخ:* ${dateStr}
👤 *العميل:* ${completedInvoice.customerName || "عميل نقدي"}
👨‍💼 *الكاشير:* ${completedInvoice.cashierName || cashierName}
━━━━━━━━━━━━━━━━━━━
🛍️ *تفاصيل المشتريات:*
${itemsText}
━━━━━━━━━━━━━━━━━━━
💰 *الإجمالي:* ${completedInvoice.totalAmount.toFixed(2)} ج.م
💵 *المدفوع:* ${completedInvoice.paidAmount.toFixed(2)} ج.م
${completedInvoice.remainingAmount > 0 ? `⚠️ *المتبقي (آجل):* ${completedInvoice.remainingAmount.toFixed(2)} ج.م\n` : ""}💳 *طريقة الدفع:* ${
      completedInvoice.paymentMethod === "cash"
        ? "نقداً (كاش)"
        : completedInvoice.paymentMethod === "card"
        ? "فيزا / بطاقة إلكترونية"
        : "حساب آجل (دين)"
    }
━━━━━━━━━━━━━━━━━━━
✨ شكراً لتعاملكم معنا ونرحب بكم دائماً!
🔗 *نظام كاشير QuazLink السحابي*`;

    const encoded = encodeURIComponent(message);
    const waUrl = formattedPhone ? `https://wa.me/${formattedPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, "_blank");
  };

  // Print Thermal 80mm Receipt
  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col select-none relative overflow-x-hidden font-sans pb-28 md:pb-6"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-xs sm:text-sm shadow-2xl shadow-emerald-500/40 flex items-center gap-2 border border-emerald-300"
          >
            <Sparkles className="w-4 h-4" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP COMPACT APP BAR */}
      <header className="sticky top-0 z-40 bg-[#070A12]/95 backdrop-blur-xl border-b border-white/[0.08] px-3.5 sm:px-6 py-2.5 flex items-center justify-between gap-2">
        {/* Brand & Branch Selector */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/pos"
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 p-0.5 shadow-md shadow-emerald-500/20 shrink-0"
            title={isAr ? "العودة لبوابة POS" : "Back to POS Portal"}
          >
            <div className="w-full h-full bg-[#0B101D] rounded-[10px] flex items-center justify-center">
              <Store className="w-4 h-4 text-emerald-400" />
            </div>
          </Link>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-white tracking-tight truncate">
                QuazLink Mobile
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                POS
              </span>
            </div>

            {/* Branch Switcher Dropdown */}
            <div className="flex items-center gap-1">
              <label htmlFor="branch-select" className="sr-only">
                {isAr ? "اختيار الفرع" : "Select Branch"}
              </label>
              <select
                id="branch-select"
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  showToast(
                    isAr
                      ? `تم تحويل الكاشير إلى: ${e.target.options[e.target.selectedIndex].text}`
                      : `Switched branch`
                  );
                }}
                className="bg-transparent text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 border-none outline-none cursor-pointer pr-1 truncate max-w-[140px] sm:max-w-[200px]"
              >
                {branches.map((b) => (
                  <option key={b.branchCode} value={b.branchCode} className="bg-[#0B101D] text-slate-200">
                    📍 {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Online/Offline Status */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold border transition-colors ${
              isOnline
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-rose-500/15 text-rose-300 border-rose-500/30"
            }`}
          >
            {isOnline ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-rose-400" />}
            <span className="hidden sm:inline">{isOnline ? (isAr ? "متصل سحابياً" : "Online") : (isAr ? "غير متصل" : "Offline")}</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
            title={soundEnabled ? "كتم الصوت" : "تشغيل الصوت"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Live Monitor Link */}
          <Link
            href="/monitor"
            target="_blank"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition-colors"
            title={isAr ? "فتح برج المراقبة" : "Live Monitor"}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px]">{isAr ? "المراقبة" : "Monitor"}</span>
          </Link>

          {/* Language Switch */}
          <button
            onClick={() => setIsAr(!isAr)}
            className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-300"
          >
            {isAr ? "EN" : "عربي"}
          </button>
        </div>
      </header>

      {/* SEARCH & RAPID ACTION BAR */}
      <section className="px-3.5 sm:px-6 pt-3 pb-2 space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Instant Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? "بحث بالاسم أو الباركود..." : "Search product or barcode..."}
              className="w-full h-11 pr-9 pl-9 rounded-2xl bg-[#0B101D] border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 -translate-y-1/2 left-3 p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Camera Barcode Scanner Button */}
          <button
            onClick={startCameraScan}
            className="h-11 px-3 sm:px-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all active:scale-95 shadow-sm"
            title={isAr ? "مسح الباركود بالكاميرا" : "Camera Barcode Scanner"}
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span className="hidden xs:inline">{isAr ? "سكانر" : "Scan"}</span>
          </button>

          {/* Quick Custom Item Button */}
          <button
            onClick={() => setIsCustomItemModalOpen(true)}
            className="h-11 px-3 sm:px-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all active:scale-95"
            title={isAr ? "إضافة صنف سريع غير مسجل" : "Add Custom Item"}
          >
            <Plus className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
            <span className="hidden sm:inline">{isAr ? "صنف يدوي" : "Custom"}</span>
          </button>
        </div>

        {/* HORIZONTAL CATEGORY CHIPS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {CATEGORIES.map((cat) => {
            const count =
              cat.id === "all"
                ? products.length
                : products.filter((p) => p.category === cat.id).length;
            const isActive = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => {
                  triggerHaptic(10);
                  setActiveCategory(cat.id);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-md shadow-emerald-500/20 font-extrabold"
                    : "bg-[#0B101D] text-slate-400 hover:text-white border border-white/5 hover:border-white/10"
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{isAr ? cat.labelAr : cat.labelEn}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-black/20 text-slate-950" : "bg-white/10 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* PRODUCT CATALOG GRID */}
      <main className="flex-1 px-3.5 sm:px-6 py-2 overflow-y-auto">
        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
              🔍
            </div>
            <h3 className="text-base font-bold text-white">
              {isAr ? "لم يتم العثور على أصناف مطابقة" : "No matching products found"}
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {isAr
                ? "يمكنك كتابة اسم آخر أو إضافة صنف يدوي سريع بالسعر الذي تريده"
                : "Try a different search term or add a custom item"}
            </p>
            <button
              onClick={() => setIsCustomItemModalOpen(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold"
            >
              + {isAr ? "إضافة صنف سريع الآن" : "Add Custom Item"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
            {filteredProducts.map((prod) => {
              const inCartItem = cart.find((i) => i.product.id === prod.id);
              const inCartCount = inCartItem?.quantity || 0;

              return (
                <motion.div
                  key={prod.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleAddToCart(prod)}
                  className={`group relative p-3 rounded-2xl bg-[#0B101D] border transition-all cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-lg ${
                    inCartCount > 0
                      ? "border-emerald-500/60 ring-1 ring-emerald-500/30 bg-emerald-950/15"
                      : "border-white/[0.07] hover:border-white/20"
                  }`}
                >
                  {/* Badge & In-Cart Counter */}
                  <div className="flex items-center justify-between gap-1 w-full mb-1.5">
                    {prod.badge ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 truncate max-w-[90px]">
                        {prod.badge}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">
                        {prod.barcode.slice(-4)}
                      </span>
                    )}

                    {inCartCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center shadow-md animate-bounce">
                        {inCartCount}
                      </span>
                    )}
                  </div>

                  {/* Icon & Title */}
                  <div className="space-y-1.5 my-1">
                    <div className="text-3xl text-center py-1 group-hover:scale-110 transition-transform">
                      {prod.emoji}
                    </div>
                    <h4 className="text-xs font-bold text-white leading-snug line-clamp-2 h-8">
                      {isAr ? prod.nameAr : prod.nameEn}
                    </h4>
                  </div>

                  {/* Price & Add Touch Button */}
                  <div className="pt-2 mt-auto border-t border-white/5 flex items-center justify-between gap-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block -mb-0.5">
                        {isAr ? "السعر" : "Price"}
                      </span>
                      <span className="text-sm font-black text-emerald-400">
                        {prod.price.toFixed(0)}{" "}
                        <span className="text-[10px] font-normal text-slate-400">ج.م</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(prod);
                      }}
                      className="w-7 h-7 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 flex items-center justify-center transition-colors border border-emerald-500/30 active:scale-90"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* BOTTOM FLOATING SUMMARY & CART TRIGGER */}
      <footer className="fixed bottom-0 inset-x-0 z-40 bg-[#070A12]/95 backdrop-blur-2xl border-t border-white/10 p-3 sm:px-6 shadow-2xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Quick Cart Summary */}
          <div
            onClick={() => cart.length > 0 && setIsCartOpen(true)}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
                <div className="w-full h-full bg-[#0B101D] rounded-[14px] flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                </div>
              </div>
              {totalItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 min-w-[20px] h-5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center shadow">
                  {totalItemsCount}
                </span>
              )}
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">
                {cart.length === 0
                  ? isAr
                    ? "السلة فارغة"
                    : "Cart Empty"
                  : isAr
                  ? `إجمالي الفاتورة (${totalItemsCount} قطع)`
                  : `Total (${totalItemsCount} items)`}
              </span>
              <span className="text-base sm:text-lg font-black text-white">
                {totalAmount.toFixed(2)}{" "}
                <span className="text-xs font-bold text-emerald-400">ج.م</span>
              </span>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            disabled={cart.length === 0}
            onClick={() => setIsCartOpen(true)}
            className={`h-12 px-5 sm:px-7 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
              cart.length > 0
                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold hover:from-emerald-400 hover:to-cyan-400 shadow-emerald-500/25 cursor-pointer"
                : "bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed"
            }`}
          >
            <span>{isAr ? "عرض السلة والدفع" : "Review & Checkout"}</span>
            <ChevronUp className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </footer>

      {/* SLIDING CART & CHECKOUT SHEET */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-xl max-h-[92vh] bg-[#0B101D] rounded-t-3xl border-t border-x border-white/10 flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Cart Header */}
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#070A12]/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">
                      {isAr ? "إتمام الفاتورة والبيع" : "Cashier Checkout"}
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      📍 {branches.find((b) => b.branchCode === selectedBranch)?.name || selectedBranch}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearCart}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title={isAr ? "إفراغ السلة" : "Clear cart"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Cart Body - Scrollable Items */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
                {/* Cart Items List */}
                <div className="space-y-2">
                  {cart.map((item) => {
                    const unitPrice = item.customPrice ?? item.product.price;
                    const lineTotal = unitPrice * item.quantity;

                    return (
                      <div
                        key={item.product.id}
                        className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl">{item.product.emoji}</span>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-white truncate max-w-[170px] sm:max-w-[240px]">
                              {isAr ? item.product.nameAr : item.product.nameEn}
                            </h5>
                            <span className="text-[11px] text-emerald-400 font-semibold">
                              {unitPrice.toFixed(0)} ج.م{" "}
                              <span className="text-slate-500 font-normal">× {item.quantity}</span>
                            </span>
                          </div>
                        </div>

                        {/* Quantity Counter */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleUpdateQuantity(item.product.id, -1)}
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 flex items-center justify-center transition-colors active:scale-90"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(item.product.id, 1)}
                            className="w-7 h-7 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 flex items-center justify-center transition-colors active:scale-90"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveItem(item.product.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors ml-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Customer Details Box */}
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAr ? "بيانات العميل (اختياري للإيصال)" : "Customer Information"}</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={isAr ? "اسم العميل" : "Customer name"}
                      className="h-10 px-3 rounded-xl bg-[#070A12] border border-white/10 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50"
                    />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder={isAr ? "موبايل / واتساب (010...)" : "Phone / WhatsApp"}
                      className="h-10 px-3 rounded-xl bg-[#070A12] border border-white/10 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAr ? "طريقة الدفع" : "Payment Method"}</span>
                  </span>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        setPaymentMethod("cash");
                      }}
                      className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                        paymentMethod === "cash"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                          : "bg-white/5 text-slate-400 border-white/5 hover:border-white/10"
                      }`}
                    >
                      <Banknote className="w-4 h-4 text-emerald-400" />
                      <span>{isAr ? "كاش (نقداً)" : "Cash"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        setPaymentMethod("card");
                      }}
                      className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                        paymentMethod === "card"
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm"
                          : "bg-white/5 text-slate-400 border-white/5 hover:border-white/10"
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-cyan-400" />
                      <span>{isAr ? "فيزا / بطاقة" : "Card"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        setPaymentMethod("credit");
                      }}
                      className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                        paymentMethod === "credit"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                          : "bg-white/5 text-slate-400 border-white/5 hover:border-white/10"
                      }`}
                    >
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>{isAr ? "آجل (دين)" : "Credit"}</span>
                    </button>
                  </div>

                  {/* Cash Change Calculator Pills */}
                  {paymentMethod === "cash" && (
                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">
                          {isAr ? "المبلغ المستلم من العميل:" : "Cash Tendered:"}
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={cashPaidAmount}
                            onChange={(e) => setCashPaidAmount(e.target.value)}
                            placeholder={totalAmount.toString()}
                            className="w-24 h-8 px-2 rounded-lg bg-[#070A12] border border-white/10 text-right text-xs font-bold text-white outline-none focus:border-emerald-500/50"
                          />
                          <span className="text-xs text-slate-400">ج.م</span>
                        </div>
                      </div>

                      {/* Fast denomination pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-[11px]">
                        <button
                          type="button"
                          onClick={() => setCashPaidAmount(totalAmount.toString())}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 whitespace-nowrap"
                        >
                          {isAr ? "المبلغ بالضبط" : "Exact"}
                        </button>
                        {[50, 100, 200, 500, 1000].map((denom) => {
                          if (denom < totalAmount && totalAmount > 200) return null;
                          return (
                            <button
                              key={denom}
                              type="button"
                              onClick={() => setCashPaidAmount(denom.toString())}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold border border-white/5 whitespace-nowrap"
                            >
                              {denom} ج.م
                            </button>
                          );
                        })}
                      </div>

                      {parsedCashPaid > totalAmount && (
                        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs font-bold">
                          <span className="text-emerald-400">{isAr ? "الباقي للعميل:" : "Change due:"}</span>
                          <span className="text-emerald-300 text-sm font-black">
                            {cashChange.toFixed(2)} ج.م
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>{isAr ? "المجموع الفرعي:" : "Subtotal:"}</span>
                    <span>{subtotal.toFixed(2)} ج.م</span>
                  </div>

                  {/* VAT 14% Toggle */}
                  <div className="flex items-center justify-between text-slate-400">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyVat}
                        onChange={(e) => setApplyVat(e.target.checked)}
                        className="rounded bg-slate-900 border-white/20 text-emerald-500 focus:ring-0"
                      />
                      <span>{isAr ? "ضريبة القيمة المضافة (14% VAT)" : "14% Value Added Tax"}</span>
                    </label>
                    <span>{vatAmount.toFixed(2)} ج.م</span>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex justify-between items-center text-sm font-extrabold text-white">
                    <span>{isAr ? "الإجمالي النهائي المستحق:" : "Net Payable Total:"}</span>
                    <span className="text-lg font-black text-emerald-400">
                      {totalAmount.toFixed(2)} ج.م
                    </span>
                  </div>
                </div>
              </div>

              {/* Cart Footer Actions */}
              <div className="p-4 border-t border-white/10 bg-[#070A12] flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="h-12 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs"
                >
                  {isAr ? "متابعة التسوق" : "Back"}
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || cart.length === 0}
                  onClick={handleCheckout}
                  className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isAr ? "جاري تسجيل ومزامنة البيع..." : "Syncing sale..."}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                      <span>
                        {isAr ? "تأكيد البيع وحفظ الفاتورة" : "Confirm & Complete Sale"} (
                        {totalAmount.toFixed(0)} ج.م)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUCCESS & DIGITAL RECEIPT MODAL */}
      <AnimatePresence>
        {isSuccessModalOpen && completedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-[#0B101D] border border-emerald-500/30 p-5 space-y-4 shadow-2xl relative"
            >
              {/* Checkmark Animation */}
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8 stroke-[2.5] animate-pulse" />
                </div>
                <h3 className="text-base font-black text-white">
                  {isAr ? "تم تسجيل البيع بنجاح!" : "Sale Completed Successfully!"}
                </h3>
                <p className="text-xs text-slate-400">
                  {isAr
                    ? "تم حفظ الفاتورة وتحديث إحصائيات الفرع وبرج المراقبة لحظياً"
                    : "Invoice recorded and synced with cloud monitor"}
                </p>
              </div>

              {/* Receipt Summary Ticket */}
              <div className="p-3.5 rounded-2xl bg-[#070A12] border border-white/5 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>{isAr ? "رقم الفاتورة:" : "Invoice #:"}</span>
                  <span className="font-bold text-white">#{completedInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>{isAr ? "الفرع:" : "Branch:"}</span>
                  <span className="text-emerald-400">
                    {branches.find((b) => b.branchCode === selectedBranch)?.name || selectedBranch}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>{isAr ? "العميل:" : "Customer:"}</span>
                  <span className="text-white">{completedInvoice.customerName}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>{isAr ? "طريقة الدفع:" : "Payment:"}</span>
                  <span className="font-bold text-white uppercase">{completedInvoice.paymentMethod}</span>
                </div>
                <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-sm">
                  <span className="text-slate-300">{isAr ? "الإجمالي:" : "Total:"}</span>
                  <span className="text-emerald-400 font-black">
                    {completedInvoice.totalAmount.toFixed(2)} ج.م
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {/* Send WhatsApp Button */}
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isAr ? "إرسال الفاتورة عبر واتساب" : "Send WhatsApp Receipt"}</span>
                </button>

                {/* Print Thermal Receipt Button */}
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="w-full h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span>{isAr ? "طباعة إيصال حراري (80mm)" : "Print Thermal Receipt"}</span>
                </button>

                {/* New Sale Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSuccessModalOpen(false);
                    setCompletedInvoice(null);
                  }}
                  className="w-full h-10 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs transition-all cursor-pointer"
                >
                  {isAr ? "+ فاتورة جديدة" : "+ New Sale"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QUICK CUSTOM ITEM MODAL */}
      <AnimatePresence>
        {isCustomItemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-[#0B101D] border border-white/10 p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-sm text-white">
                    {isAr ? "إضافة صنف سريع للسلة" : "Add Quick Custom Item"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsCustomItemModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddCustomItem} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    {isAr ? "اسم الصنف / الخدمة" : "Item / Service Name"}
                  </label>
                  <input
                    type="text"
                    required
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    placeholder={isAr ? "مثال: تغيير باغة شاشة / صنف متنوع" : "e.g. Repair / Misc Item"}
                    className="w-full h-10 px-3 rounded-xl bg-[#070A12] border border-white/10 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      {isAr ? "سعر البيع (ج.م)" : "Price (EGP)"}
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={customItemPrice}
                      onChange={(e) => setCustomItemPrice(e.target.value)}
                      placeholder="150"
                      className="w-full h-10 px-3 rounded-xl bg-[#070A12] border border-white/10 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      {isAr ? "الكمية" : "Quantity"}
                    </label>
                    <div className="flex items-center h-10 rounded-xl bg-[#070A12] border border-white/10 px-2 justify-between">
                      <button
                        type="button"
                        onClick={() => setCustomItemQty((q) => Math.max(1, q - 1))}
                        className="text-slate-400 hover:text-white p-1"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-white">{customItemQty}</span>
                      <button
                        type="button"
                        onClick={() => setCustomItemQty((q) => q + 1)}
                        className="text-emerald-400 hover:text-emerald-300 p-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-11 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>{isAr ? "إضافة للسلة فوراً" : "Add to Cart"}</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CAMERA SCANNER MODAL */}
      <AnimatePresence>
        {isScannerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-[#0B101D] border border-white/10 p-4 space-y-3 shadow-2xl relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white">
                    {isAr ? "قارئ الباركود بالكاميرا" : "Camera Barcode Scanner"}
                  </h3>
                </div>
                <button
                  onClick={stopCameraScan}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Viewfinder Screen */}
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-emerald-500/40">
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Laser scan line animation */}
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_#10b981] animate-pulse pointer-events-none" />

                {cameraError && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-rose-400" />
                    <p className="text-xs text-rose-300 font-semibold">{cameraError}</p>
                    <span className="text-[11px] text-slate-400">
                      {isAr ? "يمكنك استخدام الإدخال اليدوي أدناه" : "Use manual entry below"}
                    </span>
                  </div>
                )}
              </div>

              {/* Fast Manual Barcode Input Fallback */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 block">
                  {isAr ? "أو أدخل رقم الباركود يدوياً:" : "Or enter barcode manually:"}
                </span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    id="manual-barcode-input"
                    placeholder="6221001..."
                    className="flex-1 h-10 px-3 rounded-xl bg-[#070A12] border border-white/10 text-xs text-white outline-none focus:border-emerald-500/50"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleBarcodeScanned((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("manual-barcode-input") as HTMLInputElement;
                      if (el && el.value) {
                        handleBarcodeScanned(el.value);
                        el.value = "";
                      }
                    }}
                    className="px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                  >
                    {isAr ? "إضافة" : "Add"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT-ONLY THERMAL RECEIPT STYLES */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt,
          #thermal-receipt * {
            visibility: visible !important;
          }
          #thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            padding: 5mm !important;
            font-family: monospace !important;
            color: #000 !important;
            background: #fff !important;
          }
        }
      `}</style>

      {/* HIDDEN PRINT CONTAINER (Rendered only on print) */}
      {completedInvoice && (
        <div id="thermal-receipt" className="hidden print:block text-black bg-white">
          <div className="text-center font-bold text-base mb-2">QuazLink Retail POS</div>
          <div className="text-center text-xs mb-1">
            {branches.find((b) => b.branchCode === selectedBranch)?.name || selectedBranch}
          </div>
          <div className="border-b border-black my-2" />
          <div className="text-xs mb-1">Invoice: #{completedInvoice.invoiceNumber}</div>
          <div className="text-xs mb-1">
            Date: {new Date(completedInvoice.created_at || Date.now()).toLocaleString()}
          </div>
          <div className="text-xs mb-2">Cashier: {completedInvoice.cashierName || cashierName}</div>
          <div className="border-b border-black my-2" />

          {/* Items */}
          {Array.isArray(completedInvoice.rawItems) &&
            completedInvoice.rawItems.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-xs my-1">
                <span>
                  {item.name} ×{item.quantity}
                </span>
                <span>{item.total} EGP</span>
              </div>
            ))}

          <div className="border-b border-black my-2" />
          <div className="flex justify-between font-bold text-sm my-1">
            <span>TOTAL:</span>
            <span>{completedInvoice.totalAmount.toFixed(2)} EGP</span>
          </div>
          <div className="flex justify-between text-xs my-0.5">
            <span>PAID ({completedInvoice.paymentMethod}):</span>
            <span>{completedInvoice.paidAmount.toFixed(2)} EGP</span>
          </div>
          {completedInvoice.remainingAmount > 0 && (
            <div className="flex justify-between text-xs my-0.5 font-bold">
              <span>REMAINING:</span>
              <span>{completedInvoice.remainingAmount.toFixed(2)} EGP</span>
            </div>
          )}
          <div className="border-b border-black my-2" />
          <div className="text-center text-xs mt-3">شكراً لزيارتكم! نرجو تشريفنا دائماً</div>
        </div>
      )}
    </div>
  );
}
