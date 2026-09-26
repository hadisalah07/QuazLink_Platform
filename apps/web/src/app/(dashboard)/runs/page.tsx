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
  Hash
} from "lucide-react";
import { getJobs, screenshotUrl, type Job } from "@/lib/api";
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

export default function RunsPage() {
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "completed" | "running" | "failed">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [previewJob, setPreviewJob] = React.useState<Job | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [expandedJobIds, setExpandedJobIds] = React.useState<Set<string>>(new Set());
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
      const data = await getJobs();
      data.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setJobs(data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

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

  const filteredJobs = jobs.filter((j) => {
    const status = toUiStatus(j.status);
    if (filter === "completed" && status !== "success") return false;
    if (filter === "running" && status !== "running") return false;
    if (filter === "failed" && status !== "error" && status !== "warn") return false;

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
        
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-medium cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <span>Refresh Logs</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center space-x-2">
          {(["all", "completed", "running", "failed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                filter === t
                  ? "bg-white/10 text-white border border-white/10 shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by content, phone, or ID..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-gray-500 outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Table Container */}
      <SpotlightCard className="rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-white/5 border-b border-white/10 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-6 py-4 font-semibold w-[42%]">Post Content &amp; Details</th>
                <th className="px-6 py-4 font-semibold w-[20%]">Execution Status</th>
                <th className="px-6 py-4 font-semibold w-[18%]">Timestamp</th>
                <th className="px-6 py-4 font-semibold text-right w-[20%]">Proof Screenshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No execution logs found. Go to Compose to launch your first automation!
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
}: {
  job: Job;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPreviewScreenshot: () => void;
  onCopy: (text: string, id: string, e?: React.MouseEvent) => void;
  copiedId: string | null;
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
            <div className="flex items-center space-x-2">
              {status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {status === "error" && <XCircle className="w-4 h-4 text-red-400" />}
              {status === "warn" && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {status === "running" && <Clock className="w-4 h-4 text-blue-400 animate-pulse" />}
              <span className="capitalize font-semibold text-xs text-gray-200">
                {job.status.replace(/_/g, " ")}
              </span>
            </div>
            {status === "error" && job.result && (
              <div className="text-xs text-red-400/80 mt-1 max-w-xs leading-relaxed font-mono" dir="auto">
                {job.result}
              </div>
            )}
            {status === "warn" && job.result && (
              <div className="text-xs text-amber-400/80 mt-1 max-w-xs leading-relaxed font-mono" dir="auto">
                {job.result}
              </div>
            )}
          </div>
        </td>

        {/* Cell 3: Timestamp */}
        <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap">
          {new Date(job.createdAt).toLocaleString()}
        </td>

        {/* Cell 4: View Proof Button */}
        <td className="px-6 py-4 text-right">
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
          ) : (
            <span className="text-gray-600 text-xs">—</span>
          )}
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

              {/* Execution Result Box & View Proof Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs">
                <div className="text-gray-400 flex items-center gap-2">
                  <span className="font-semibold text-gray-300">نتيجة التنفيذ:</span>
                  <span className="text-gray-200 font-mono">
                    {job.result || (status === "success" ? "تم الإرسال بنجاح عبر الرانر المحلي" : "قيد المعالجة")}
                  </span>
                </div>

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
          </td>
        </tr>
      )}
    </>
  );
}
