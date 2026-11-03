"use client";

import * as React from "react";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Save,
  User,
  CreditCard,
  Store,
  Bot,
  Sparkles,
  Headphones,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Check,
  Send,
  Radio,
  Eye,
  CheckCheck,
} from "lucide-react";
import {
  getAdminContactMessages,
  updateAdminContactMessage,
  deleteAdminContactMessage,
  replyAdminContactMessage,
  type ContactMessageItem,
} from "@/lib/api";
import { useLiveHub } from "@/lib/useLiveHub";

type StatusTab = "all" | "pending" | "in_progress" | "contacted" | "resolved";

export default function AdminContactsPage() {
  const [items, setItems] = React.useState<ContactMessageItem[]>([]);
  const [counts, setCounts] = React.useState({ pending: 0, inProgress: 0, resolved: 0, all: 0 });
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [newContactAlert, setNewContactAlert] = React.useState<string | null>(null);

  // Real-time bidirectional LiveHub connection (WebSocket)
  const { isConnected: isLiveConnected } = useLiveHub({
    role: "admin",
    onNewContact: (newMsg) => {
      setItems((prev) => [newMsg, ...prev.filter((it) => it.id !== newMsg.id)]);
      setCounts((prev) => ({
        ...prev,
        pending: prev.pending + 1,
        all: prev.all + 1,
      }));
      setNewContactAlert(`استفسار جديد وصل للتو من ${newMsg.name}: "${newMsg.subject}"`);
      setTimeout(() => setNewContactAlert(null), 7000);
    },
    onReply: ({ contactId, data }) => {
      setItems((prev) =>
        prev.map((item) => (item.id === contactId ? { ...item, ...data } : item))
      );
    },
    onReplyStatus: ({ contactId, replyStatus, replyDeliveredAt, replyReadAt }) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === contactId
            ? { ...item, replyStatus, replyDeliveredAt, replyReadAt }
            : item
        )
      );
    },
  });

  // Filters
  const [statusTab, setStatusTab] = React.useState<StatusTab>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Action states
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [notesDrafts, setNotesDrafts] = React.useState<Record<string, string>>({});
  const [savedNotesId, setSavedNotesId] = React.useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = React.useState<Record<string, string>>({});
  const [sendingReplyId, setSendingReplyId] = React.useState<string | null>(null);
  const [repliedSuccessId, setRepliedSuccessId] = React.useState<string | null>(null);

  const fetchMessages = React.useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await getAdminContactMessages({
        status: statusTab !== "all" ? statusTab : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        search: searchQuery.trim() || undefined,
        limit: 50,
      });
      setItems(res.items || []);
      setCounts(res.counts || { pending: 0, inProgress: 0, resolved: 0, all: 0 });

      // Initialize drafts
      const notes: Record<string, string> = {};
      const replies: Record<string, string> = {};
      (res.items || []).forEach((item) => {
        notes[item.id] = item.adminNotes || "";
        replies[item.id] = item.adminReply || "";
      });
      setNotesDrafts(notes);
      setReplyDrafts(replies);
    } catch (err: any) {
      setError(err?.message || "Failed to load customer inquiries.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusTab, categoryFilter, searchQuery]);

  React.useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      await updateAdminContactMessage(id, { status: newStatus });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
      // Refresh counts silently
      fetchMessages(true);
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveNotes = async (id: string) => {
    setUpdatingId(id);
    try {
      const note = notesDrafts[id] || "";
      await updateAdminContactMessage(id, { adminNotes: note });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, adminNotes: note } : item))
      );
      setSavedNotesId(id);
      setTimeout(() => setSavedNotesId(null), 2000);
    } catch (err: any) {
      alert("Failed to save note: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSendReply = async (id: string) => {
    const text = (replyDrafts[id] || "").trim();
    if (!text) {
      alert("Please enter a reply before sending.");
      return;
    }
    setSendingReplyId(id);
    try {
      const res = await replyAdminContactMessage(id, text);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...res.item } : item))
      );
      setRepliedSuccessId(id);
      setTimeout(() => setRepliedSuccessId(null), 3000);
      fetchMessages(true);
    } catch (err: any) {
      alert("Failed to send reply: " + err.message);
    } finally {
      setSendingReplyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    setDeletingId(id);
    try {
      await deleteAdminContactMessage(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      fetchMessages(true);
    } catch (err: any) {
      alert("Failed to delete message: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "subscription_renewal":
        return { label: "تجديد اشتراك • Renewal", bg: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: CreditCard };
      case "pos_support":
        return { label: "كاشير ومخازن • POS", bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: Store };
      case "runner_support":
        return { label: "رانر أتمتة • Runner", bg: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", icon: Bot };
      case "sales_inquiry":
        return { label: "مبيعات وتراخيص • Sales", bg: "bg-purple-500/15 text-purple-300 border-purple-500/30", icon: Sparkles };
      default:
        return { label: "دعم فني عام • Support", bg: "bg-blue-500/15 text-blue-300 border-blue-500/30", icon: Headphones };
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-16">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-[#0B101D] to-[#060913] border border-white/10 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Customer Inquiries &amp; Support Messages
              </h1>
              {counts.pending > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold animate-pulse">
                  {counts.pending} New
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              إدارة ومتابعة رسائل العملاء، طلبات تجديد الاشتراكات، واستفسارات الدعم الفني والمبيعات.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Live Webhook Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs font-mono shadow-sm">
            <span className={`w-2 h-2 rounded-full ${isLiveConnected ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-amber-400"}`} />
            <span className={isLiveConnected ? "text-emerald-300 font-semibold" : "text-amber-300"}>
              {isLiveConnected ? "Live Webhook Active" : "Connecting..."}
            </span>
          </div>

          <Link
            href="/contact"
            target="_blank"
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-colors flex items-center gap-2"
          >
            <span>Open Public Form</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => fetchMessages(true)}
            disabled={refreshing}
            className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Real-time New Inquiry Push Alert Banner */}
      {newContactAlert && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-cyan-500/20 border border-cyan-500/40 text-cyan-200 text-xs sm:text-sm font-bold flex items-center justify-between shadow-2xl animate-bounce">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>⚡ {newContactAlert}</span>
          </div>
          <button
            onClick={() => setNewContactAlert(null)}
            className="text-gray-400 hover:text-white text-xs underline cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-[#0B101D]/80 border border-white/10 backdrop-blur-md">
          <span className="text-xs text-gray-400 font-medium">Pending Inquiries</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-extrabold text-amber-400 font-mono">{counts.pending}</span>
            <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full">Requires action</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0B101D]/80 border border-white/10 backdrop-blur-md">
          <span className="text-xs text-gray-400 font-medium">In Progress</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-extrabold text-cyan-400 font-mono">{counts.inProgress}</span>
            <span className="text-[10px] text-cyan-400/80 bg-cyan-500/10 px-2 py-0.5 rounded-full">Being followed up</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0B101D]/80 border border-white/10 backdrop-blur-md">
          <span className="text-xs text-gray-400 font-medium">Resolved &amp; Closed</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-extrabold text-emerald-400 font-mono">{counts.resolved}</span>
            <span className="text-[10px] text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full">Completed</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0B101D]/80 border border-white/10 backdrop-blur-md">
          <span className="text-xs text-gray-400 font-medium">Total Messages</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-extrabold text-white font-mono">{counts.all}</span>
            <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">Lifetime</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-[#0B101D]/90 border border-white/10 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: "all" as StatusTab, label: "All Messages", badge: undefined },
            { id: "pending" as StatusTab, label: "Pending", badge: counts.pending },
            { id: "in_progress" as StatusTab, label: "In Progress", badge: undefined },
            { id: "contacted" as StatusTab, label: "Contacted", badge: undefined },
            { id: "resolved" as StatusTab, label: "Resolved", badge: undefined },
          ].map((tab) => {
            const isSelected = statusTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/25"
                    : "bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/5"
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isSelected ? "bg-black text-cyan-400" : "bg-amber-500 text-black"}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Category Dropdown */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-gray-300 focus:outline-none focus:border-cyan-400"
          >
            <option value="all">All Categories</option>
            <option value="subscription_renewal">Subscription Renewal</option>
            <option value="pos_support">POS &amp; Retail System</option>
            <option value="runner_support">Automation Runner</option>
            <option value="sales_inquiry">Enterprise Sales</option>
            <option value="general">General Support</option>
          </select>

          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search inquiries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-xs text-gray-400 font-mono">Loading inquiries...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="p-16 rounded-3xl bg-[#0B101D]/40 border border-white/10 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h3 className="text-base font-bold text-white">No inquiries found</h3>
          <p className="text-xs text-gray-400 max-w-sm">
            {searchQuery || statusTab !== "all" || categoryFilter !== "all"
              ? "No messages match your selected search filters."
              : "All customer inquiries have been addressed. The inbox is clean!"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => {
            const badge = getCategoryBadge(item.category);
            const CategoryIcon = badge.icon;

            return (
              <div
                key={item.id}
                className="rounded-3xl p-6 bg-gradient-to-b from-[#0B1120] to-[#070B16] border border-white/10 hover:border-white/20 transition-all shadow-xl flex flex-col gap-4"
              >
                {/* Message Header Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 font-bold text-sm shrink-0">
                      {item.flag || "🌐"}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-white">{item.name}</span>
                        {item.userId || item.user ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
                            <User className="w-2.5 h-2.5 text-emerald-400" />
                            <span>عضو مسجل • Member</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 text-[10px] font-medium flex items-center gap-1">
                            <span>زائر • Guest</span>
                          </span>
                        )}
                        {item.country && (
                          <span className="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
                            <MapPin className="w-3 h-3 text-cyan-400" />
                            <span>{item.city ? `${item.city}, ${item.country}` : item.country}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-gray-500" />
                          <span>{new Date(item.createdAt).toLocaleString()}</span>
                        </span>
                        <span className="font-mono text-[10px] text-gray-500">ID: {item.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Category & Status Pill */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${badge.bg}`}>
                      <CategoryIcon className="w-3.5 h-3.5" />
                      <span>{badge.label}</span>
                    </span>

                    {/* Status Dropdown */}
                    <select
                      value={item.status}
                      disabled={updatingId === item.id}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        item.status === "pending"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : item.status === "in_progress"
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : item.status === "contacted"
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      }`}
                    >
                      <option value="pending" className="bg-[#0B101D] text-amber-300">Pending (New)</option>
                      <option value="in_progress" className="bg-[#0B101D] text-cyan-300">In Progress</option>
                      <option value="contacted" className="bg-[#0B101D] text-purple-300">Contacted (تم التواصل)</option>
                      <option value="resolved" className="bg-[#0B101D] text-emerald-300">Resolved (مكتمل)</option>
                      <option value="spam" className="bg-[#0B101D] text-red-300">Spam</option>
                    </select>
                  </div>
                </div>

                {/* Contact Coordinates & Fast Actions Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-black/40 border border-white/5 text-xs font-mono">
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Email */}
                    <a
                      href={`mailto:${item.email}?subject=${encodeURIComponent(`Re: ${item.subject} — QuazLink Platform`)}`}
                      className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{item.email}</span>
                    </a>

                    {/* Phone */}
                    {item.phone && (
                      <span className="flex items-center gap-1.5 text-gray-300">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{item.phone}</span>
                      </span>
                    )}
                  </div>

                  {/* Fast Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title="Delete inquiry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف الرسالة • Delete</span>
                    </button>
                  </div>
                </div>

                {/* Message Subject & Body */}
                <div className="flex flex-col gap-2">
                  <h3 className="font-extrabold text-base text-white">
                    {item.subject}
                  </h3>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                    {item.message}
                  </div>
                </div>

                {/* In-Platform Reply Section (Registered Users Only) */}
                {item.userId || item.user ? (
                  <div className="p-4 rounded-2xl bg-cyan-950/25 border border-cyan-500/30 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-cyan-400" />
                        <span>الرد الرسمي للعميل داخل المنصة (In-Platform Reply)</span>
                      </label>
                      {repliedSuccessId === item.id && (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 animate-pulse">
                          <Check className="w-3.5 h-3.5" />
                          <span>تم إرسال الرد للعميل بنجاح!</span>
                        </span>
                      )}
                    </div>

                    {item.adminReply && (
                      <div className="p-3 rounded-xl bg-black/50 border border-emerald-500/25 flex flex-col gap-2 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                          <span className="text-emerald-300 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>الرد المرسل للعميل:</span>
                          </span>
                          {item.repliedAt && (
                            <span>{new Date(item.repliedAt).toLocaleString()} ({item.repliedBy || "الإدارة"})</span>
                          )}
                        </div>
                        <p className="text-gray-200 whitespace-pre-wrap leading-relaxed font-sans">
                          {item.adminReply}
                        </p>

                        {/* Customer Delivery & Seen Verification Status */}
                        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-white/10 mt-1 text-[11px] font-mono">
                          <span className="text-gray-400">حالة تسليم الرد للعميل:</span>
                          {item.replyStatus === "read" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold shadow-sm">
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>تمت المشاهدة (Seen)</span>
                              {item.replyReadAt && (
                                <span className="text-gray-400 font-normal">({new Date(item.replyReadAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                              )}
                            </span>
                          ) : item.replyStatus === "delivered" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold shadow-sm">
                              <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                              <span>وصل لجهاز العميل (Delivered)</span>
                              {item.replyDeliveredAt && (
                                <span className="text-gray-400 font-normal">({new Date(item.replyDeliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300 font-medium">
                              <Check className="w-3.5 h-3.5 text-gray-400" />
                              <span>تم الإرسال (Sent) • في انتظار الاستلام</span>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                      <textarea
                        rows={2}
                        placeholder="اكتب رد الإدارة هنا ليظهر للعميل فوراً داخل حسابه على المنصة..."
                        value={replyDrafts[item.id] ?? ""}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="flex-1 p-3 rounded-xl bg-black/60 border border-cyan-500/30 focus:border-cyan-400 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors resize-y min-h-[55px]"
                      />
                      <button
                        onClick={() => handleSendReply(item.id)}
                        disabled={sendingReplyId === item.id || !replyDrafts[item.id]?.trim()}
                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {sendingReplyId === item.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>جاري الإرسال...</span>
                          </>
                        ) : (
                          <>
                            <span>إرسال الرد للعميل</span>
                            <Send className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-2.5 text-xs text-gray-400">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      هذا الاستفسار من <strong>زائر غير مسجل</strong> في المنصة. الرد المباشر داخل المنصة متاح فقط للأعضاء المسجلين. للتواصل معه، استخدم البريد الإلكتروني أو رقم الهاتف أعلاه.
                    </span>
                  </div>
                )}

                {/* Admin Internal Notes Section */}
                <div className="mt-1 pt-3 border-t border-white/5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-cyan-400" />
                      <span>Admin Private Notes &amp; Follow-up Log</span>
                    </label>
                    {savedNotesId === item.id && (
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Note Saved!</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add internal follow-up notes (e.g. تم التواصل هاتفياً وتجديد الاشتراك لمدة عام)..."
                      value={notesDrafts[item.id] ?? ""}
                      onChange={(e) =>
                        setNotesDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={() => handleSaveNotes(item.id)}
                      disabled={updatingId === item.id}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
