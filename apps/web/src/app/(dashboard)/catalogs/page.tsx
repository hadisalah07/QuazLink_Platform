"use client";

import * as React from "react";
import { Plus, Loader2, ShoppingBag, Trash2, Database, Key, Sparkles, X, RefreshCw, ExternalLink, Tag } from "lucide-react";
import { getCatalogs, addCatalog, deleteCatalog, getCatalogProducts, type Catalog, type Product } from "@/lib/api";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

export default function CatalogsPage() {
  const [catalogs, setCatalogs] = React.useState<Catalog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAdding, setIsAdding] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form State
  const [name, setName] = React.useState("");
  const [sourceType, setSourceType] = React.useState("custom");
  const [apiUrl, setApiUrl] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [authScheme, setAuthScheme] = React.useState("bearer");
  const [authHeader, setAuthHeader] = React.useState("");

  // Preview State
  const [previewCatalog, setPreviewCatalog] = React.useState<Catalog | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setCatalogs(await getCatalogs());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await addCatalog({
        name,
        sourceType,
        apiUrl,
        apiKey: apiKey || undefined,
        authScheme,
        authHeader: authScheme === "header" ? authHeader : undefined,
      });
      setIsAdding(false);
      setName(""); setApiUrl(""); setApiKey(""); setAuthHeader("");
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this catalog?")) return;
    try {
      await deleteCatalog(id);
      await refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handlePreview(catalog: Catalog) {
    setPreviewCatalog(catalog);
    setPreviewLoading(true);
    setPreviewError(null);
    setProducts([]);
    try {
      setProducts(await getCatalogProducts(catalog.id));
    } catch (e: any) {
      setPreviewError(e.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="flex flex-col space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShoppingBag className="w-8 h-8 text-[var(--color-quaz-cyan)]" />
            Product Catalogs &amp; Feeds
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Connect Shopify, WooCommerce, or Custom API feeds to fuel automated AI marketing campaigns.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] transition-all flex items-center space-x-2 cursor-pointer"
        >
          {isAdding ? <X className="w-4 h-4 text-black" /> : <Plus className="w-4 h-4 text-black" />}
          <span>{isAdding ? "Close Form" : "Add New Catalog"}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Add New Data Source Form */}
      {isAdding && (
        <SpotlightCard className="p-6 md:p-8 rounded-2xl border border-cyan-500/30 bg-[var(--color-quaz-bg)] shadow-2xl space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <Database className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">Configure New Product Data Source</h2>
          </div>
          
          <form onSubmit={handleAdd} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Catalog / Store Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  placeholder="e.g. Main Shopify Store"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-400 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Platform / Source Type</label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-400 transition-colors"
                >
                  <option value="custom" className="bg-[var(--color-quaz-bg)]">Custom API (JSON)</option>
                  <option value="shopify" className="bg-[var(--color-quaz-bg)]">Shopify Storefront</option>
                  <option value="woocommerce" className="bg-[var(--color-quaz-bg)]">WooCommerce REST</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">API Endpoint URL</label>
              <input
                required
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                type="url"
                placeholder="https://api.yourstore.com/v1/products"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-400 transition-colors font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Auth Scheme</label>
                <select
                  value={authScheme}
                  onChange={(e) => setAuthScheme(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-400 transition-colors"
                >
                  <option value="none" className="bg-[var(--color-quaz-bg)]">None (Public)</option>
                  <option value="bearer" className="bg-[var(--color-quaz-bg)]">Bearer Token</option>
                  <option value="header" className="bg-[var(--color-quaz-bg)]">Custom Header</option>
                  <option value="query" className="bg-[var(--color-quaz-bg)]">Query Parameter</option>
                </select>
              </div>
              
              {authScheme === "header" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Header Name</label>
                  <input
                    required
                    value={authHeader}
                    onChange={(e) => setAuthHeader(e.target.value)}
                    type="text"
                    placeholder="X-Api-Key"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
              )}

              {authScheme !== "none" && (
                <div className={"space-y-2 " + (authScheme !== "header" ? "col-span-2" : "col-span-1")}>
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-purple-400" /> API Secret Key / Token
                  </label>
                  <input
                    required
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    type="password"
                    placeholder="Enter secret token..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-5 py-2.5 text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                <span>Save Catalog Source</span>
              </button>
            </div>
          </form>
        </SpotlightCard>
      )}

      {/* Catalogs Grid */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-sm text-gray-400">Loading catalog sources...</span>
        </div>
      ) : catalogs.length === 0 && !isAdding ? (
        <div className="p-16 rounded-2xl border border-dashed border-white/10 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">No Catalogs Connected</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
              Connect a store catalog to let the AI agent read products and draft automated ads.
            </p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="px-5 py-2.5 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-semibold rounded-xl hover:bg-cyan-500/30 transition-all cursor-pointer"
          >
            Add Your First Catalog
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalogs.map((c) => (
            <SpotlightCard
              key={c.id}
              className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] hover:border-cyan-500/30 transition-all flex flex-col justify-between h-52 group relative"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Database className="w-4 h-4 text-cyan-400" />
                    </div>
                    <span className="px-2.5 py-0.5 bg-white/5 border border-white/10 rounded-full text-[11px] font-mono uppercase text-gray-300">
                      {c.sourceType}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Delete catalog"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="font-bold text-lg text-white truncate group-hover:text-cyan-300 transition-colors">
                  {c.name}
                </h3>
                <p className="text-xs text-gray-500 font-mono truncate mt-1" title={c.apiUrl}>
                  {c.apiUrl}
                </p>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-purple-400" />
                  {c.authScheme === "none" ? "Public Feed" : "Secured"}
                </span>
                <button
                  onClick={() => handlePreview(c)}
                  className="px-3.5 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/20 transition-all text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Preview Products</span>
                </button>
              </div>
            </SpotlightCard>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewCatalog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-5xl max-h-[85vh] flex flex-col bg-[var(--color-quaz-bg)] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-400" />
                Live Catalog Feed: {previewCatalog.name}
              </h2>
              <button
                onClick={() => setPreviewCatalog(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  <p className="text-sm">Fetching and parsing products...</p>
                </div>
              ) : previewError ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300">
                  <p className="font-semibold mb-1">Failed to fetch products:</p>
                  <p className="text-sm font-mono">{previewError}</p>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center text-gray-500 p-12">
                  No products found in this data feed.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.map((p) => {
                    const img = p.images && p.images.length > 0 ? p.images[0] : p.imageUrl;
                    return (
                      <SpotlightCard key={p.id} className="p-3.5 rounded-xl border border-white/5 bg-black/40 hover:border-cyan-500/30 transition-all flex flex-col justify-between">
                        <div>
                          {img ? (
                            <img src={img} alt={p.title} className="w-full h-36 object-cover rounded-lg mb-3 border border-white/10" />
                          ) : (
                            <div className="w-full h-36 rounded-lg mb-3 bg-white/5 flex items-center justify-center text-gray-600 text-xs">
                              No Image
                            </div>
                          )}
                          <h4 className="font-semibold text-sm text-white line-clamp-1">{p.title}</h4>
                          <p className="text-xs text-gray-400 line-clamp-2 mt-1">{p.description || "No description provided."}</p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                          <span className="font-mono text-cyan-400 font-bold text-sm">
                            {p.price} {p.currency}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-semibold">
                            In Stock
                          </span>
                        </div>
                      </SpotlightCard>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
