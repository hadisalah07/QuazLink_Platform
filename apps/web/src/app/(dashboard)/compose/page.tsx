"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Send, Loader2, Info, Sparkles, Database, X } from "lucide-react";
import { GlassCard } from "@/components/effects/GlassCard";
import { PostPreview } from "@/components/compose/PostPreview";
import { fadeIn } from "@/lib/motion";
import { getAccounts, createPost, getCatalogs, getCatalogProducts, generateCopy, type Account, type Catalog, type Product } from "@/lib/api";

export default function ComposePage() {
  const router = useRouter();
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [accountId, setAccountId] = React.useState("");
  const [targetUrl, setTargetUrl] = React.useState("");
  const [content, setContent] = React.useState("");
  const [mediaUrls, setMediaUrls] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Catalog Picker State
  const [showPicker, setShowPicker] = React.useState(false);
  const [catalogs, setCatalogs] = React.useState<Catalog[]>([]);
  const [selectedCatalog, setSelectedCatalog] = React.useState<Catalog | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  // Only accounts with a saved session can publish.
  React.useEffect(() => {
    getAccounts()
      .then((all) => {
        const active = all.filter((a) => a.status === "active");
        setAccounts(active);
        if (active.length > 0) {
          setAccountId(active[0].id);
          const dests = active[0].destinations;
          if (dests && dests.length > 0) setTargetUrl(dests[0].url);
        }
      })
      .catch((e) => setError(e.message));
      
    getCatalogs().then(setCatalogs).catch(console.error);
  }, []);

  // Update targetUrl when account changes
  React.useEffect(() => {
    const acc = accounts.find(a => a.id === accountId);
    if (acc?.destinations && acc.destinations.length > 0) {
      setTargetUrl(acc.destinations[0].url);
    } else {
      setTargetUrl("");
    }
  }, [accountId, accounts]);

  async function handleCatalogSelect(c: Catalog) {
    setSelectedCatalog(c);
    setLoadingCatalog(true);
    setProducts([]);
    try {
      setProducts(await getCatalogProducts(c.id));
    } catch (e: any) {
      alert("Failed to fetch products: " + e.message);
    } finally {
      setLoadingCatalog(false);
    }
  }

  async function handleProductSelect(p: Product) {
    setShowPicker(false);
    setGenerating(true);
    setError(null);
    try {
      const res = await generateCopy({ product: p });
      setContent(res.copy);
      if (p.images && p.images.length > 0) {
        setMediaUrls([...p.images]);
      } else if (p.imageUrl) {
        setMediaUrls([p.imageUrl]);
      } else {
        setMediaUrls([]);
      }
    } catch (e: any) {
      setError("AI Generation Error: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createPost({ content, socialAccountId: accountId, mediaUrls, targetUrl });
      router.push("/runs");
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const canSubmit = accountId && content.trim() && !submitting;

  const selectedAcc = accounts.find(a => a.id === accountId);
  const selectedDest = selectedAcc?.destinations?.find(d => d.url === targetUrl);

  return (
    <motion.div initial="initial" animate="animate" variants={fadeIn} className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Compose Post</h1>
          <p className="text-sm text-gray-400 mt-1">
            اكتب البوست، والـ agent هيجهّزه ويقف قبل النشر — تراجعه وتدوس Post بإيدك.
          </p>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          disabled={catalogs.length === 0}
          className="px-5 py-2.5 bg-gradient-to-r from-[var(--color-quaz-purple)] to-[var(--color-quaz-cyan)] text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:grayscale cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Ad from Catalog</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form */}
        <div className="lg:col-span-7">
          <GlassCard className="flex flex-col p-6 md:p-8 space-y-6">
            {accounts.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-gray-400">مفيش حساب فيسبوك متصل جاهز للنشر.</p>
                <Link
                  href="/accounts"
                  className="inline-block px-5 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-semibold hover:bg-cyan-500/30 transition-all"
                >
                  اربط حساب فيسبوك الأول
                </Link>
              </div>
            ) : (
              <form className="flex flex-col space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label htmlFor="account" className="text-sm font-medium text-gray-300">
                    Facebook Account
                  </label>
                  <select
                    id="account"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-quaz-cyan)] transition-all"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id} className="bg-[var(--color-quaz-bg)]">
                        {a.platform} — {a.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Post Destination Dropdown */}
                {selectedAcc?.destinations && selectedAcc.destinations.length > 0 && (
                  <div className="space-y-2">
                    <label htmlFor="destination" className="text-sm font-medium text-gray-300">
                      Post Destination (Profile or Page)
                    </label>
                    <select
                      id="destination"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-quaz-cyan)] transition-all"
                    >
                      {selectedAcc.destinations.map((d, i) => (
                        <option key={i} value={d.url} className="bg-[var(--color-quaz-bg)]">
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2 relative">
                  <label htmlFor="content" className="text-sm font-medium text-gray-300 flex items-center justify-between">
                    <span>Post Content</span>
                    {generating && (
                      <span className="flex items-center gap-1 text-[var(--color-quaz-cyan)] text-xs animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" /> AI is writing...
                      </span>
                    )}
                  </label>
                  <textarea
                    id="content"
                    dir="auto"
                    rows={6}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="اكتب البوست هنا أو اختار منتج من الكتالوج للتوليد التلقائي..."
                    disabled={generating}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-quaz-cyan)] transition-all resize-none disabled:opacity-50"
                  />
                  
                  {mediaUrls.length > 0 && (
                    <div className="mt-2 p-3 rounded-xl bg-black/40 border border-white/10 flex items-center gap-3">
                      <div className="flex gap-2 flex-wrap">
                        {mediaUrls.map((url, idx) => (
                          <img key={idx} src={url} alt={`Media ${idx + 1}`} className="w-12 h-12 rounded-lg object-cover border border-white/10" />
                        ))}
                      </div>
                      <div className="flex-1 text-xs text-gray-300">
                        <span className="font-semibold text-white">{mediaUrls.length} image(s) attached</span>
                        <p className="text-gray-500">Will be downloaded locally before posting.</p>
                      </div>
                      <button type="button" onClick={() => setMediaUrls([])} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2 text-xs text-gray-400 bg-white/5 p-3 rounded-xl border border-white/5">
                  <Info className="w-4 h-4 mt-0.5 text-cyan-400 flex-shrink-0" />
                  <span>
                    هيتفتح متصفح ويجهّز البوست ويقف قبل النشر. راجعه وادوس Post بإيدك، بعدين اقفل الـ window.
                  </span>
                </div>

                {error && (
                  <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Send className="w-4 h-4 text-black" />}
                  <span>Prepare &amp; Publish</span>
                </button>
              </form>
            )}
          </GlassCard>
        </div>

        {/* Right Column: Live Mockup Preview */}
        <div className="lg:col-span-5 sticky top-6">
          <PostPreview
            content={content}
            mediaUrls={mediaUrls}
            accountName={selectedAcc?.platform || "Facebook Account"}
            targetName={selectedDest?.name}
          />
        </div>
      </div>

      {/* Catalog Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl h-[80vh] flex flex-col bg-[var(--color-quaz-bg)] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-[var(--color-quaz-purple)]" />
                Select Product for AI Ad
              </h2>
              <button onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar: Catalogs List */}
              <div className="w-64 border-r border-white/10 p-4 overflow-y-auto bg-black/20">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Catalogs</h3>
                <div className="space-y-2">
                  {catalogs.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleCatalogSelect(c)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedCatalog?.id === c.id ? 'bg-[var(--color-quaz-cyan)]/20 text-white border border-[var(--color-quaz-cyan)]/30' : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main: Products List */}
              <div className="flex-1 p-6 overflow-y-auto relative">
                {!selectedCatalog ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    Select a catalog from the left to view products.
                  </div>
                ) : loadingCatalog ? (
                  <div className="h-full flex items-center justify-center text-gray-400 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" /> Fetching live products...
                  </div>
                ) : products.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No products found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map((p) => {
                      const img = (p.images && p.images.length > 0) ? p.images[0] : p.imageUrl;
                      return (
                        <div key={p.id} className="p-3 rounded-xl border border-white/5 bg-black/40 hover:bg-white/5 hover:border-white/10 transition-all group flex flex-col cursor-pointer" onClick={() => handleProductSelect(p)}>
                          {img ? (
                            <img src={img} alt={p.title} className="w-full h-32 object-cover rounded-lg mb-3" />
                          ) : (
                            <div className="w-full h-32 rounded-lg mb-3 bg-white/5 flex items-center justify-center text-xs text-gray-600">No Image</div>
                          )}
                          <h4 className="font-semibold text-sm text-white line-clamp-1">{p.title}</h4>
                          <div className="mt-auto pt-2 flex items-center justify-between">
                            <span className="text-xs text-[var(--color-quaz-cyan)] font-bold">{p.price} {p.currency}</span>
                            <span className="text-xs px-2 py-1 bg-[var(--color-quaz-purple)]/20 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
