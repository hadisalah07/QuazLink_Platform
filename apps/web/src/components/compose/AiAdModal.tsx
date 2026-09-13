"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  Package,
  Layers,
  Zap,
  ShoppingBag,
  MessageCircle,
  Video,
  Flame,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import {
  getCatalogs,
  getCatalogProducts,
  getAiPresets,
  saveAiPreset,
  generateAd,
  type Catalog,
  type Product,
  type AiAdPreset,
} from "@/lib/api";

interface AiAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (content: string, mediaUrls: string[]) => void;
  initialProduct?: Product | null;
}

const PRESET_ICONS: Record<string, React.ReactNode> = {
  fb_ig_feed: <ShoppingBag className="w-4 h-4 text-cyan-400" />,
  tiktok_reels: <Video className="w-4 h-4 text-pink-400" />,
  whatsapp_direct: <MessageCircle className="w-4 h-4 text-emerald-400" />,
  flash_sale: <Flame className="w-4 h-4 text-amber-400" />,
  b2b_wholesale: <Briefcase className="w-4 h-4 text-indigo-400" />,
};

export function AiAdModal({ isOpen, onClose, onApply, initialProduct }: AiAdModalProps) {
  // Catalogs & Products state
  const [catalogs, setCatalogs] = React.useState<Catalog[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = React.useState<string>("");
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState("");
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(initialProduct || null);
  const [showProductPicker, setShowProductPicker] = React.useState(!initialProduct);

  // Presets & Prompt state
  const [presets, setPresets] = React.useState<AiAdPreset[]>([]);
  const [activePresetKey, setActivePresetKey] = React.useState<string>("fb_ig_feed");
  const [showPromptEditor, setShowPromptEditor] = React.useState(false);
  const [customPrompt, setCustomPrompt] = React.useState("");
  const [savingPreset, setSavingPreset] = React.useState(false);
  const [presetSavedMsg, setPresetSavedMsg] = React.useState(false);

  // Generation state
  const [generating, setGenerating] = React.useState(false);
  const [adCopy, setAdCopy] = React.useState("");
  const [generationSource, setGenerationSource] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load catalogs and presets on mount
  React.useEffect(() => {
    if (!isOpen) return;

    getCatalogs()
      .then((cats) => {
        setCatalogs(cats);
        if (cats.length > 0 && !selectedCatalogId) {
          setSelectedCatalogId(cats[0].id);
        }
      })
      .catch(console.error);

    getAiPresets()
      .then((prs) => {
        setPresets(prs);
        if (prs.length > 0) {
          const current = prs.find((p) => p.presetKey === activePresetKey) || prs[0];
          setCustomPrompt(current.systemPrompt);
        }
      })
      .catch(console.error);
  }, [isOpen]);

  // Load products when selected catalog changes
  React.useEffect(() => {
    if (!selectedCatalogId) return;
    setLoadingProducts(true);
    getCatalogProducts(selectedCatalogId)
      .then((prods) => {
        setProducts(prods);
        if (!selectedProduct && prods.length > 0) {
          setSelectedProduct(prods[0]);
        }
      })
      .catch((e) => setError("Failed to load products: " + e.message))
      .finally(() => setLoadingProducts(false));
  }, [selectedCatalogId]);

  // If initial product passed, set it
  React.useEffect(() => {
    if (initialProduct) {
      setSelectedProduct(initialProduct);
      setShowProductPicker(false);
    }
  }, [initialProduct]);

  // When active preset tab changes, update prompt editor
  const handlePresetSelect = (presetKey: string) => {
    setActivePresetKey(presetKey);
    const found = presets.find((p) => p.presetKey === presetKey);
    if (found) {
      setCustomPrompt(found.systemPrompt);
    }
  };

  // Generate Ad Copy
  const handleGenerate = async (refinementInstructions?: string) => {
    if (!selectedProduct) {
      setError("Please select a product first");
      return;
    }

    setGenerating(true);
    setError(null);

    let promptToSend = customPrompt;
    if (refinementInstructions) {
      promptToSend = `${customPrompt}\n\n[Refinement / Special Instruction]: ${refinementInstructions}`;
    }

    try {
      const res = await generateAd({
        product: selectedProduct,
        presetKey: activePresetKey,
        customPrompt: promptToSend,
      });

      setAdCopy(res.copy);
      setGenerationSource(res.source || null);
    } catch (e: any) {
      setError("Generation failed: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  // Save customized prompt as default for this preset
  const handleSavePresetPrompt = async () => {
    setSavingPreset(true);
    try {
      await saveAiPreset({
        presetKey: activePresetKey,
        systemPrompt: customPrompt,
      });
      setPresetSavedMsg(true);
      setTimeout(() => setPresetSavedMsg(false), 3000);
      const updated = await getAiPresets();
      setPresets(updated);
    } catch (e: any) {
      alert("Failed to save preset: " + e.message);
    } finally {
      setSavingPreset(false);
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    if (!adCopy) return;
    navigator.clipboard.writeText(adCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Apply to Compose form
  const handleApplyToCompose = () => {
    if (!adCopy) return;
    const mediaUrls: string[] = [];
    if (selectedProduct) {
      if (selectedProduct.images && selectedProduct.images.length > 0) {
        mediaUrls.push(...selectedProduct.images);
      } else if (selectedProduct.imageUrl) {
        mediaUrls.push(selectedProduct.imageUrl);
      }
    }
    onApply(adCopy, mediaUrls);
    onClose();
  };

  // Insert token into prompt
  const insertToken = (token: string) => {
    setCustomPrompt((prev) => prev + ` ${token} `);
  };

  const filteredProducts = products.filter((p) =>
    p.title.toLowerCase().includes(productSearch.toLowerCase())
  );

  const activePreset = presets.find((p) => p.presetKey === activePresetKey);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="w-full max-w-5xl bg-[#090d16] border border-cyan-500/20 rounded-2xl sm:rounded-3xl shadow-[0_0_50px_rgba(34,211,238,0.15)] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-[var(--color-quaz-purple)]/15 via-transparent to-[var(--color-quaz-cyan)]/15">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--color-quaz-purple)] to-[var(--color-quaz-cyan)] text-black shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>AI Ad from Catalog</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 uppercase font-mono">
                  gemini-3.5-flash-lite
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                توليد إعلانات وحملات تسويقية ذكية ومبيعات مباشرة من بيانات منتجات الكتالوج
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body (2 Columns on Desktop) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-white/10">
          {/* Left Column: Product & Campaign Config (5 cols) */}
          <div className="lg:col-span-5 p-5 space-y-5 bg-black/20 flex flex-col">
            {/* Selected Product Banner */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-cyan-400" />
                  المنتج المستهدف
                </span>
                <button
                  type="button"
                  onClick={() => setShowProductPicker((prev) => !prev)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  <span>{showProductPicker ? "إخفاء القائمة" : "تغيير المنتج"}</span>
                  {showProductPicker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {selectedProduct ? (
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3.5 hover:border-cyan-500/30 transition-all">
                  {selectedProduct.imageUrl || (selectedProduct.images && selectedProduct.images[0]) ? (
                    <img
                      src={selectedProduct.imageUrl || selectedProduct.images![0]}
                      alt={selectedProduct.title}
                      className="w-16 h-16 rounded-xl object-cover bg-black/40 border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xs text-gray-500 shrink-0">
                      No Img
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{selectedProduct.title}</h4>
                    <p className="text-xs text-cyan-400 font-mono font-bold mt-0.5">
                      {selectedProduct.price} {selectedProduct.currency || "EGP"}
                    </p>
                    {selectedProduct.images && selectedProduct.images.length > 1 && (
                      <span className="text-[10px] text-gray-400">
                        +{selectedProduct.images.length} صور مرفقة
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-white/15 text-center text-xs text-gray-400">
                  لم يتم اختيار منتج بعد
                </div>
              )}
            </div>

            {/* Product Picker Drawer */}
            <AnimatePresence>
              {showProductPicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-3 p-3 rounded-2xl bg-black/50 border border-white/10"
                >
                  <div className="flex gap-2">
                    <select
                      value={selectedCatalogId}
                      onChange={(e) => setSelectedCatalogId(e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                    >
                      {catalogs.map((c) => (
                        <option key={c.id} value={c.id} className="bg-[#090d16] text-white">
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="بحث عن منتج..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {loadingProducts ? (
                      <div className="py-6 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>جاري تحميل المنتجات...</span>
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="py-4 text-center text-xs text-gray-500">لا توجد منتجات مطابقة</div>
                    ) : (
                      filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProduct(p);
                            setShowProductPicker(false);
                          }}
                          className={`w-full text-right p-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                            selectedProduct?.id === p.id
                              ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold"
                              : "hover:bg-white/5 text-gray-300 border border-transparent"
                          }`}
                        >
                          <span className="truncate">{p.title}</span>
                          <span className="font-mono text-cyan-400 shrink-0 ml-2">
                            {p.price} {p.currency}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Campaign Preset Tabs */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                قالب ونوع الحملة التسويقية
              </span>

              <div className="grid grid-cols-1 gap-1.5">
                {presets.map((p) => {
                  const isActive = p.presetKey === activePresetKey;
                  return (
                    <button
                      key={p.presetKey}
                      type="button"
                      onClick={() => handlePresetSelect(p.presetKey)}
                      className={`w-full text-right px-3.5 py-2.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                        isActive
                          ? "bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.1)] text-white"
                          : "bg-white/5 border-white/5 hover:border-white/15 text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-black/40 shrink-0">
                        {PRESET_ICONS[p.presetKey] || <Sparkles className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{p.title}</div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {p.presetKey === "fb_ig_feed" && "صيغة AIDA لهوك المشاهدة والمبيعات"}
                          {p.presetKey === "tiktok_reels" && "سكريبت فيديو سريع 15-30 ثانية بالمشاهد"}
                          {p.presetKey === "whatsapp_direct" && "رسالة ودودة لإغلاق الصفقات والأوردرات"}
                          {p.presetKey === "flash_sale" && "عرض لفترة محدودة وتحفيز الشراء الفوري"}
                          {p.presetKey === "b2b_wholesale" && "عرض كميات وتجار وموزعين بهامش ربح"}
                        </div>
                      </div>
                      {isActive && <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Advanced Prompt Editor Drawer */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <button
                type="button"
                onClick={() => setShowPromptEditor((prev) => !prev)}
                className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-white py-1 cursor-pointer"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  تخصيص تعليمات الذكاء الاصطناعي (Prompt Instructions)
                </span>
                {showPromptEditor ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <AnimatePresence>
                {showPromptEditor && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-2.5 pt-1"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => insertToken("{title}")}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10"
                      >
                        + اسم المنتج
                      </button>
                      <button
                        type="button"
                        onClick={() => insertToken("{price}")}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10"
                      >
                        + السعر
                      </button>
                      <button
                        type="button"
                        onClick={() => insertToken("{description}")}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10"
                      >
                        + الوصف
                      </button>
                    </div>

                    <textarea
                      rows={5}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl bg-black/60 border border-white/10 text-gray-200 focus:outline-none focus:border-cyan-400 font-mono leading-relaxed"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleSavePresetPrompt}
                        disabled={savingPreset}
                        className="text-[11px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {savingPreset ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 text-cyan-400" />}
                        <span>حفظ كإعداد افتراضي لي</span>
                      </button>

                      {presetSavedMsg && (
                        <span className="text-[11px] text-emerald-400 font-medium animate-pulse">
                          تم الحفظ بنجاح!
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Generate Action Button */}
            <div className="mt-auto pt-4">
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={generating || !selectedProduct}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[var(--color-quaz-purple)] to-[var(--color-quaz-cyan)] text-black font-extrabold text-sm shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:grayscale"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>جاري توليد الإعلان عبر الذكاء الاصطناعي...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>توليد الإعلان الآن ({activePreset?.title || "حملة جديدة"})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Output Preview & Actions (7 cols) */}
          <div className="lg:col-span-7 p-6 flex flex-col justify-between space-y-4 bg-black/40">
            {/* Output Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  الإعلان المُولّد (Ad Copy Output)
                </span>
                {generationSource && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {generationSource}
                  </span>
                )}
              </div>

              {adCopy && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">
                    {adCopy.length} حرف | {adCopy.split(/\s+/).filter(Boolean).length} كلمة
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "تم النسخ!" : "نسخ"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Ad Content Box */}
            <div className="flex-1 min-h-[300px] p-4 rounded-2xl bg-black/60 border border-white/10 flex flex-col relative overflow-hidden">
              {generating ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
                  <div className="relative">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                    <Sparkles className="w-4 h-4 text-purple-400 absolute -top-1 -right-1 animate-ping" />
                  </div>
                  <p className="text-xs font-medium">جاري صياغة الإعلان بدقة تسويقية عالية...</p>
                </div>
              ) : adCopy ? (
                <textarea
                  value={adCopy}
                  onChange={(e) => setAdCopy(e.target.value)}
                  className="flex-1 w-full bg-transparent text-gray-100 text-sm leading-relaxed focus:outline-none resize-none font-sans whitespace-pre-wrap selection:bg-cyan-500/30"
                  placeholder="نص الإعلان سيظهر هنا..."
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="p-4 rounded-full bg-white/5 border border-white/10 text-gray-500">
                    <Sparkles className="w-8 h-8 text-cyan-500/50" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-300">جاهز لصياغة الإعلان</h4>
                    <p className="text-xs text-gray-500 max-w-sm mt-1">
                      اختر المنتج من اليسار ثم اضغط على زر "توليد الإعلان" ليتم صياغة كابشن إعلاني احترافي فائق الإقناع وموجّه للمبيعات.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs mt-3">
                  {error}
                </div>
              )}
            </div>

            {/* Quick Refinement Pills */}
            {adCopy && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-gray-400">تحسينات سريعة بنقرة واحدة:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerate("اجعل النص أقصر وأكثر تركيزاً في 3 سطور فقط مع الحفاظ على الهوك والسعر")}
                    disabled={generating}
                    className="text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors cursor-pointer"
                  >
                    ⚡ اجعله أقصر ومختصر
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerate("أضف هوك قوي جداً عن الشحن المجاني والمعاينة قبل الاستلام والدفع عند الاستلام")}
                    disabled={generating}
                    className="text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors cursor-pointer"
                  >
                    🚚 أضف ميزة الشحن والمعاينة
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerate("ارفع نبرة الحماس والإثارة واستخدم أسلوب العرض الخاطف والحصري")}
                    disabled={generating}
                    className="text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors cursor-pointer"
                  >
                    🔥 زوّد نبرة الحماس والعرض
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium cursor-pointer transition-colors"
              >
                إلغاء
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!adCopy}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "تم النسخ!" : "نسخ الكابشن"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyToCompose}
                  disabled={!adCopy}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.4)] disabled:opacity-50 disabled:grayscale transition-all"
                >
                  <Send className="w-3.5 h-3.5 fill-black" />
                  <span>🚀 استخدام في البوست وإرفاق الصور</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
