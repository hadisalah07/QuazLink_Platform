"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Clock, ImageIcon, AlertTriangle, Zap, Search, RefreshCw, X, Copy, ExternalLink } from "lucide-react";
import { getJobs, screenshotUrl, type Job } from "@/lib/api";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

type UiStatus = "success" | "error" | "warn" | "running";

function toUiStatus(status: string): UiStatus {
  if (status === "prepared" || status === "completed" || status === "success") return "success";
  if (status === "failed" || status === "error") return "error";
  if (status === "posted_unconfirmed") return "warn";
  return "running";
}

export default function RunsPage() {
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "completed" | "running" | "failed">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [previewJob, setPreviewJob] = React.useState<Job | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

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
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
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
      return content.includes(query) || id.includes(query);
    }
    return true;
  });

  function handleCopy(text: string, id: string) {
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
            placeholder="Search by content or ID..."
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
                <th className="px-6 py-4 font-semibold">Post Content</th>
                <th className="px-6 py-4 font-semibold">Execution Status</th>
                <th className="px-6 py-4 font-semibold">Timestamp</th>
                <th className="px-6 py-4 font-semibold">Proof Screenshot</th>
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
                    onPreviewScreenshot={() => setPreviewJob(job)}
                    onCopy={handleCopy}
                    isCopied={copiedId === job.id}
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
                src={screenshotUrl(previewJob.id)}
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
  onPreviewScreenshot,
  onCopy,
  isCopied,
}: {
  job: Job;
  onPreviewScreenshot: () => void;
  onCopy: (text: string, id: string) => void;
  isCopied: boolean;
}) {
  const status = toUiStatus(job.status);
  const preview = job.post?.content
    ? job.post.content.slice(0, 60) + (job.post.content.length > 60 ? "…" : "")
    : "(No text content)";

  return (
    <tr className="hover:bg-white/5 transition-colors group">
      <td className="px-6 py-4 font-medium text-white max-w-sm" dir="auto">
        <div className="flex flex-col space-y-1">
          <span className="truncate text-gray-200">{preview}</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-gray-500">ID: {job.id.slice(0, 8)}...</span>
            <button
              onClick={() => onCopy(job.id, job.id)}
              className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
            >
              {isCopied ? "Copied!" : "Copy ID"}
            </button>
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            {status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {status === "error" && <XCircle className="w-4 h-4 text-red-400" />}
            {status === "warn" && <AlertTriangle className="w-4 h-4 text-amber-400" />}
            {status === "running" && <Clock className="w-4 h-4 text-blue-400 animate-pulse" />}
            <span className="capitalize font-semibold text-xs">{job.status.replace(/_/g, " ")}</span>
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

      <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap">
        {new Date(job.createdAt).toLocaleString()}
      </td>

      <td className="px-6 py-4">
        {job.screenshotUrl ? (
          <button
            onClick={onPreviewScreenshot}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-xs font-semibold cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>View Proof</span>
          </button>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}
