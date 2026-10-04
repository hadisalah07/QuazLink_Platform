"use client";

import * as React from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ImageIcon,
  AlertTriangle,
  Zap,
  Search,
  RefreshCw,
  X,
  Copy,
  Check,
  ChevronDown,
  Phone,
  ExternalLink,
  MessageSquare,
  FileText,
  Calendar,
  Layers,
  ArrowUpRight,
  Hash,
  RotateCcw
} from "lucide-react";
import { getJobs, screenshotUrl, retryJob, retryAllFailedJobs, type Job } from "@/lib/api";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { cn } from "@/lib/utils";

type UiStatus = "success" | "error" | "warn" | "running";

function toUiStatus(status: string): UiStatus {
  if (status === "prepared" || status === "completed" || status === "success") return "success";
  if (status === "failed" || status === "error") return "error";
  if (status === "posted_unconfirmed") return "warn";
  return "running";
}

function getProofImageSrc(job: Job): string {
  if (!job.screenshotUrl) return screenshotUrl(job.id);
  const src = job.screenshotUrl.trim();
  if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  if (src.startsWith("/9j/")) {
    return `data:image/jpeg;base64,${src}`;
  }
  if (src.startsWith("iVBORw")) {
    return `data:image/png;base64,${src}`;
  }
  return screenshotUrl(job.id);
}

function extractPhone(targetUrl?: string | null, content?: string | null): string | null {
  if (targetUrl) {
    const match = targetUrl.match(/phone=(\d+)/i);
    if (match && match[1]) return match[1];
  }
  if (content) {
    const match = content.match(/(?:\+?20|0)?1[0125]\d{8}/);
    if (match && match[0]) return match[0];
  }
  return null;
}

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getYesterdayStr(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatJobDate(dateStr: string): string {
  const date = new Date(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function RunsPage() {
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "completed" | "running" | "failed">("all");
  const [selectedDate, setSelectedDate] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [previewJob, setPreviewJob] = React.useState<Job | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [expandedJobIds, setExpandedJobIds] = React.useState<Set<string>>(new Set());
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const [retrySuccessMsg, setRetrySuccessMsg] = React.useState<string | null>(null);
  const [resentJobIds, setResentJobIds] = React.useState<Set<string>>(new Set());
  const jobsRef = React.useRef(jobs);
  jobsRef.current = jobs;

  const toggleExpand = React.useCallback((id: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      const data = await getJobs(200);
      data.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setJobs(data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const handleRetry = React.useCallback(async (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRetryingId(jobId);
    setError(null);
    setResentJobIds((prev) => new Set(prev).add(jobId));
    try {
      await retryJob(jobId);
      setRetrySuccessMsg(`تمت جدولة إعادة إرسال المهمة #${jobId.slice(0, 8)} فوراً للرانر!`);
      setTimeout(() => setRetrySuccessMsg(null), 4000);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRetryingId(null);
    }
  }, [refresh]);

  const handleRetryAll = React.useCallback(async () => {
    setRetryingId("all");
    setError(null);
    try {
      const res = await retryAllFailedJobs();
      setRetrySuccessMsg(`تمت إعادة جدولة ${res.count} مهمة فاشلة للإرسال فوراً!`);
      setTimeout(() => setRetrySuccessMsg(null), 4000);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRetryingId(null);
    }
  }, [refresh]);

  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    let isCancelled = false;

    async function cycle() {
      if (typeof document !== "undefined" && !document.hidden) {
        await refresh();
      }
      if (isCancelled) return;

      const hasActiveJob = jobsRef.current.some((j) => {
        const s = toUiStatus(j.status);
        return s === "running" || j.status === "connecting" || j.status === "prepared";
      });

      const delay = hasActiveJob ? 5000 : 25000;
      timer = setTimeout(cycle, delay);
    }

    cycle();

    const onVisibilityChange = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        cycle();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  const failedCount = jobs.filter((j) => toUiStatus(j.status) === "error").length;

  const filteredJobs = jobs.filter((j) => {
    const status = toUiStatus(j.status);
    if (filter === "completed" && status !== "success") return false;
    if (filter === "running" && status !== "running") return false;
    if (filter === "failed" && status !== "error" && status !== "warn") return false;

    // Date Filter (Local Date match)
    if (selectedDate) {
      const jobDate = formatJobDate(j.createdAt);
      if (jobDate !== selectedDate) return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const content = j.post?.content?.toLowerCase() || "";
      const id = j.id.toLowerCase();
      const target = j.targetUrl?.toLowerCase() || "";
      return content.includes(query) || id.includes(query) || target.includes(query);
    }
    return true;
  });

  function handleCopy(text: string, id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="flex flex-col space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Zap className="w-8 h-8 text-[var(--color-quaz-cyan)]" />
            Execution Runs &amp; Audit Logs
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time monitoring of automated browser sessions, post preparing, and screenshot proofs.
          </p>
        </div>
        
        <div className="flex items-center flex-wrap gap-3">
          {failedCount > 0 && (
            <button
              onClick={handleRetryAll}
              disabled={retryingId === "all"}
              className="px-4 py-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-xl hover:bg-amber-500/25 transition-all flex items-center gap-2 text-sm font-semibold cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.25)] disabled:opacity-50"
            >
              <RotateCcw className={cn("w-4 h-4 text-amber-400", retryingId === "all" && "animate-spin")} />
              <span>{retryingId === "all" ? "جاري إعادة إرسال الكل..." : `إعادة محاولة كل الفاشل (${failedCount})`}</span>
            </button>
          )}

          <button
            onClick={refresh}
            className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-medium cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <span>Refresh Logs</span>
          </button>
        </div>
      </div>

      {retrySuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300 flex items-center justify-between">
          <span>{retrySuccessMsg}</span>
          <button onClick={() => setRetrySuccessMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-2">
        {/* Left: Status Filter Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {(["all", "completed", "running", "failed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                filter === t
                  ? "bg-white/10 text-white border border-white/10 shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Right: Date Filter & Search */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {/* Quick Date Presets */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 gap-1">
            <button
              type="button"
              onClick={() => setSelectedDate("")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                !selectedDate
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              All Dates
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayStr())}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedDate === getTodayStr()
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(getYesterdayStr())}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedDate === getYesterdayStr()
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Yesterday
            </button>
          </div>

          {/* Date Picker Input */}
          <div className="relative flex items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50 transition-colors [color-scheme:dark] cursor-pointer"
              title="اختر يوماً محدداً للفلترة"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                className="ml-1.5 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                title="إلغاء فلتر التاريخ (عرض الكل)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by content, phone, or ID..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-gray-500 outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <SpotlightCard className="rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-white/5 border-b border-white/10 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-6 py-4 font-semibold w-[40%]">Post Content &amp; Details</th>
                <th className="px-6 py-4 font-semibold w-[22%]">Execution Status</th>
                <th className="px-6 py-4 font-semibold w-[16%]">Timestamp</th>
                <th className="px-6 py-4 font-semibold text-right w-[22%]">Actions &amp; Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    {selectedDate ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span>لا توجد سجلات تشغيل في تاريخ ({selectedDate}).</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDate("")}
                          className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/20 cursor-pointer transition-colors"
                        >
                          عرض جميع التواريخ
                        </button>
                      </div>
                    ) : (
                      "No execution logs found. Go to Compose to launch your first automation!"
                    )}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <RunRow
                    key={job.id}
                    job={job}
                    isExpanded={expandedJobIds.has(job.id)}
                    onToggleExpand={() => toggleExpand(job.id)}
                    onPreviewScreenshot={() => setPreviewJob(job)}
                    onCopy={handleCopy}
                    copiedId={copiedId}
                    onRetry={handleRetry}
                    isRetrying={retryingId === job.id || retryingId === "all"}
                    isResent={resentJobIds.has(job.id) || !!job.result?.includes("[RESENT]")}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </SpotlightCard>

      {/* Screenshot Lightbox Modal */}
      {previewJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[var(--color-quaz-bg)] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">Execution Proof — Job #{previewJob.id.slice(0, 8)}</h3>
              </div>
              <button
                onClick={() => setPreviewJob(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex flex-col items-center justify-center bg-black/40">
              <img
                src={getProofImageSrc(previewJob)}
                alt="Execution Proof Screenshot"
                className="max-h-[70vh] rounded-xl border border-white/10 object-contain shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RunRow({
  job,
  isExpanded,
  onToggleExpand,
  onPreviewScreenshot,
  onCopy,
  copiedId,
  onRetry,
  isRetrying,
  isResent,
}: {
  job: Job;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPreviewScreenshot: () => void;
  onCopy: (text: string, id: string, e?: React.MouseEvent) => void;
  copiedId: string | null;
  onRetry: (id: string, e?: React.MouseEvent) => void;
  isRetrying: boolean;
  isResent: boolean;
}) {
  const status = toUiStatus(job.status);
  const fullContent = job.post?.content || "";
  const preview = fullContent
    ? fullContent.slice(0, 65) + (fullContent.length > 65 ? "…" : "")
    : "(No text content)";

  const phone = extractPhone(job.targetUrl, fullContent);
  const isWhatsApp = job.socialAccount?.platform === "whatsapp" || !!phone || job.targetUrl?.includes("whatsapp");

  return (
    <>
      <tr
        onClick={onToggleExpand}
        className={cn(
          "transition-colors group cursor-pointer border-b border-white/5",
          isExpanded ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
        )}
      >
        {/* Cell 1: Content & Expand Toggle */}
        <td className="px-6 py-4 font-medium text-white" dir="auto">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              aria-label={isExpanded ? "Collapse row details" : "Expand row details"}
              className="mt-0.5 p-1 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 transition-transform duration-300"
            >
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform duration-300",
                  isExpanded && "rotate-180 text-cyan-300"
                )}
              />
            </button>

            <div className="flex flex-col space-y-1.5 min-w-0">
              <span className="truncate text-gray-200 text-sm font-medium hover:text-white transition-colors">
                {preview}
              </span>

              <div className="flex items-center flex-wrap gap-2 text-xs">
                <span className="text-[11px] font-mono text-gray-500">ID: {job.id.slice(0, 8)}...</span>
                
                <button
                  type="button"
                  onClick={(e) => onCopy(job.id, `id-${job.id}`, e)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer flex items-center gap-1"
                >
                  {copiedId === `id-${job.id}` ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>

                {phone && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" dir="ltr">
                    <Phone className="w-2.5 h-2.5" />
                    +{phone}
                  </span>
                )}

                <span className="text-[11px] text-gray-500 group-hover:text-cyan-400/80 transition-colors">
                  {isExpanded ? "إخفاء التفاصيل ▲" : "عرض التفاصيل الكاملة ▼"}
                </span>
              </div>
            </div>
          </div>
        </td>

        {/* Cell 2: Status */}
        <td className="px-6 py-4">
          <div className="flex flex-col">
            <div className="flex items-center space-x-2 flex-wrap gap-1.5">
              {status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {status === "error" && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
              {status === "warn" && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
              {status === "running" && <Clock className="w-4 h-4 text-blue-400 animate-pulse shrink-0" />}
              <span className="capitalize font-semibold text-xs text-gray-200">
                {job.status.replace(/_/g, " ")}
              </span>
              {isResent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.25)]">
                  <RotateCcw className="w-2.5 h-2.5 text-cyan-400" />
                  Resent
                </span>
              )}
            </div>
            {status === "error" && job.result && (
              <div className="text-xs text-red-400/80 mt-1 max-w-xs leading-relaxed font-mono" dir="auto">
                {job.result.replace(/\[RESENT\]\s*/g, '')}
              </div>
            )}
            {status === "warn" && job.result && (
              <div className="text-xs text-amber-400/80 mt-1 max-w-xs leading-relaxed font-mono" dir="auto">
                {job.result.replace(/\[RESENT\]\s*/g, '')}
              </div>
            )}
          </div>
        </td>

        {/* Cell 3: Timestamp */}
        <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap">
          {new Date(job.createdAt).toLocaleString()}
        </td>

        {/* Cell 4: View Proof & Resend Action Button */}
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {/* Universal Resend Button for ALL operations */}
            <button
              type="button"
              onClick={(e) => onRetry(job.id, e)}
              disabled={isRetrying || status === "running"}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
                isResent
                  ? "bg-cyan-500/15 border-cyan-500/35 text-cyan-300 hover:bg-cyan-500/25 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                  : status === "error"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 shadow-sm hover:shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                  : "bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20"
              )}
              title={isResent ? "تمت إعادة إرسال هذه العملية سابقاً — اضغط لإعادة الإرسال مجدداً" : "إعادة إرسال هذه العملية الآن للرانر"}
            >
              <RotateCcw className={cn("w-3.5 h-3.5", isRetrying ? "animate-spin text-cyan-400" : isResent ? "text-cyan-400" : "text-gray-400")} />
              <span>
                {isRetrying
                  ? "جاري..."
                  : isResent
                  ? "Resent 🔄"
                  : "Resend"}
              </span>
            </button>

            {job.screenshotUrl ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreviewScreenshot();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all text-xs font-semibold cursor-pointer shadow-sm hover:shadow-[0_0_12px_rgba(6,182,212,0.2)]"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>View Proof</span>
              </button>
            ) : status !== "error" ? (
              <span className="text-gray-600 text-xs">—</span>
            ) : null}
          </div>
        </td>
      </tr>

      {/* Expanded Details Drawer */}
      {isExpanded && (
        <tr className="bg-white/[0.015] border-b border-white/10">
          <td colSpan={4} className="p-4 sm:p-6" dir="rtl">
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 md:p-6 shadow-2xl space-y-5 text-right relative overflow-hidden">
              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

              {/* Header Badges Grid */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    تفاصيل المهمة بالكامل
                  </span>

                  {isWhatsApp && (
                    <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      إرسال واتساب (WhatsApp Web)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  <span>تاريخ الإنشاء: {new Date(job.createdAt).toLocaleString("ar-EG")}</span>
                  {job.completedAt && (
                    <span className="text-emerald-400/90">
                      • اكتملت: {new Date(job.completedAt).toLocaleTimeString("ar-EG")}
                    </span>
                  )}
                </div>
              </div>

              {/* Recipient & Meta Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Phone / Target */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
                  <span className="text-gray-400 font-medium flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    المستلم / رقم الواتساب:
                  </span>
                  {phone ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-emerald-300 font-mono text-sm font-bold tracking-wide" dir="ltr">
                        +{phone}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => onCopy(phone, `phone-${job.id}`, e)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === `phone-${job.id}` ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ الرقم</span>
                            </>
                          )}
                        </button>
                        <a
                          href={`https://web.whatsapp.com/send?phone=${phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>فتح الشات</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-300 font-mono break-all pt-1" dir="ltr">
                      {job.targetUrl || "نشر تلقائي على الحساب"}
                    </p>
                  )}
                </div>

                {/* Full Job ID */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
                  <span className="text-gray-400 font-medium flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-cyan-400" />
                    المعرف الفريد للمهمة (UUID):
                  </span>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-gray-300 font-mono text-xs break-all" dir="ltr">
                      {job.id}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => onCopy(job.id, `fullid-${job.id}`, e)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0"
                    >
                      {copiedId === `fullid-${job.id}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>تم!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>نسخ</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Full Content Body */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                    محتوى الرسالة / الفاتورة بالكامل (Full Content):
                  </span>
                  {fullContent && (
                    <button
                      type="button"
                      onClick={(e) => onCopy(fullContent, `content-${job.id}`, e)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedId === `content-${job.id}` ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">تم نسخ النص بالكامل!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ النص كاملاً</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div
                  className="p-4 rounded-xl bg-black/50 border border-white/10 text-sm text-gray-100 font-sans leading-relaxed whitespace-pre-wrap select-text max-h-96 overflow-y-auto shadow-inner"
                  dir="auto"
                >
                  {fullContent || (
                    <span className="text-gray-500 italic">لا يوجد محتوى نصي مسجل لهذه المهمة.</span>
                  )}
                </div>
              </div>

              {/* Media Attachments Preview if any */}
              {job.post?.mediaUrls && job.post.mediaUrls.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    الملفات والمرفقات ({job.post.mediaUrls.length}):
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    {job.post.mediaUrls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-cyan-300 flex items-center gap-1.5 transition-colors"
                      >
                        <span>مرفق #{idx + 1}</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Execution Result Box & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs">
                <div className="text-gray-400 flex flex-col gap-1 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-300">نتيجة التنفيذ:</span>
                    <span className={cn(
                      "font-mono font-medium",
                      status === "error" ? "text-red-400" : status === "success" ? "text-emerald-400" : "text-gray-200"
                    )}>
                      {job.result ? job.result.replace(/\[RESENT\]\s*/g, '') : (status === "success" ? "تم الإرسال بنجاح عبر الرانر المحلي" : "قيد المعالجة")}
                    </span>
                    {isResent && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        <RotateCcw className="w-2.5 h-2.5" />
                        تمت إعادة الإرسال (Resent 🔄)
                      </span>
                    )}
                  </div>
                  {status === "error" && (
                    <p className="text-[11px] text-amber-400/90 leading-relaxed font-sans">
                      💡 ملاحظة: إذا كان الخطأ متعلقاً بعدم وجود المتصفح أو انقطاع الهاتف، اضغط على زر إعادة الإرسال (Resend) بعد فتح الهاتف وتوصيله بالإنترنت.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => onRetry(job.id, e)}
                    disabled={isRetrying || status === "running"}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shadow-md cursor-pointer disabled:opacity-50",
                      isResent
                        ? "bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                        : status === "error"
                        ? "bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                        : "bg-white/10 hover:bg-white/15 border border-white/20 text-gray-200 hover:text-white"
                    )}
                  >
                    <RotateCcw className={cn("w-4 h-4", isRetrying && "animate-spin")} />
                    <span>
                      {isRetrying
                        ? "جاري الإرسال للرانر..."
                        : isResent
                        ? "إعادة الإرسال مرة أخرى (Resend 🔄)"
                        : "إعادة إرسال العملية (Resend)"}
                    </span>
                  </button>

                  {job.screenshotUrl && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewScreenshot();
                      }}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold transition-all shadow-md hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>معاينة لقطة الشاشة (View Proof)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
