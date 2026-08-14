"use client";

import * as React from "react";
import { Plus, Play, MoreVertical, Workflow, Sparkles, Clock, CheckCircle2, Pause, ArrowRight, Zap, RefreshCw } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  trigger: string;
  schedule: string;
  active: boolean;
  lastRun?: string;
  category: string;
}

const INITIAL_WORKFLOWS: WorkflowItem[] = [
  {
    id: "wf-1",
    name: "Facebook Daily Catalog Publisher",
    description: "Generates high-converting Arabic ad copy from synced catalog products and prepares Facebook draft.",
    trigger: "Cron Schedule",
    schedule: "Every day at 12:00 PM",
    active: true,
    lastRun: "Today, 12:00 PM",
    category: "Social Automation",
  },
  {
    id: "wf-2",
    name: "Shopify New Product Announcer",
    description: "Detects new products added to the store catalog and creates an engaging visual announcement post.",
    trigger: "Webhook",
    schedule: "Real-time on product creation",
    active: true,
    lastRun: "Yesterday, 4:30 PM",
    category: "E-commerce",
  },
  {
    id: "wf-3",
    name: "Weekend Special Discount Campaign",
    description: "Prepares weekend marketing campaigns with discount codes and target audience tags.",
    trigger: "Manual Trigger",
    schedule: "On demand",
    active: false,
    lastRun: "3 days ago",
    category: "Promotions",
  },
];

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = React.useState<WorkflowItem[]>(INITIAL_WORKFLOWS);
  const [filter, setFilter] = React.useState<"all" | "active" | "draft">("all");
  const [runningId, setRunningId] = React.useState<string | null>(null);
  const [successToast, setSuccessToast] = React.useState<string | null>(null);

  const filteredWorkflows = workflows.filter((w) => {
    if (filter === "active") return w.active;
    if (filter === "draft") return !w.active;
    return true;
  });

  function toggleStatus(id: string) {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, active: !w.active } : w))
    );
  }

  async function handleRunNow(w: WorkflowItem) {
    setRunningId(w.id);
    // Simulate trigger execution
    setTimeout(() => {
      setRunningId(null);
      setSuccessToast(`Workflow "${w.name}" triggered successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
    }, 1200);
  }

  return (
    <div className="flex flex-col space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Workflow className="w-8 h-8 text-[var(--color-quaz-cyan)]" />
            Automated Workflows
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Build, monitor, and automate repetitive social publishing &amp; catalog syncing agents.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link
            href="/compose"
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Workflow</span>
          </Link>
        </div>
      </div>

      {/* Success Notification Toast */}
      {successToast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-3 shadow-lg"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-medium">{successToast}</span>
        </motion.div>
      )}

      {/* Quick Templates Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TemplateCard
          title="Daily Auto-Post from Catalog"
          desc="Pick 1 product every day, write AI copy, and push to Facebook."
          badge="Popular"
        />
        <TemplateCard
          title="Weekly Promo Broadcast"
          desc="Schedule weekly discount campaigns with customized images."
          badge="Scheduled"
        />
        <TemplateCard
          title="Catalog Auto-Sync Agent"
          desc="Keep Shopify/WooCommerce catalog in sync every 6 hours."
          badge="Data Sync"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center space-x-2">
          {(["all", "active", "draft"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                filter === t
                  ? "bg-white/10 text-white border border-white/10 shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t === "all" ? `All Workflows (${workflows.length})` : t}
            </button>
          ))}
        </div>
      </div>

      {/* Workflows List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredWorkflows.map((wf) => (
          <SpotlightCard
            key={wf.id}
            className="p-6 rounded-2xl border border-white/10 bg-[var(--color-quaz-bg)] hover:border-cyan-500/30 transition-all flex flex-col justify-between space-y-5 group"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                      {wf.category}
                    </span>
                    <h3 className="font-bold text-lg text-white group-hover:text-cyan-300 transition-colors">
                      {wf.name}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleStatus(wf.id)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors flex items-center gap-1 cursor-pointer ${
                      wf.active
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-gray-500/10 border-gray-500/30 text-gray-400"
                    }`}
                  >
                    {wf.active ? <CheckCircle2 className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    {wf.active ? "Active" : "Paused"}
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-400 leading-relaxed">
                {wf.description}
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-400">
              <div className="flex items-center space-x-4">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  {wf.schedule}
                </span>
                {wf.lastRun && (
                  <span className="text-gray-500">Last: {wf.lastRun}</span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleRunNow(wf)}
                  disabled={runningId === wf.id}
                  className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-cyan-500/20 hover:border-cyan-500/40 hover:text-cyan-300 transition-all flex items-center gap-1.5 font-medium cursor-pointer disabled:opacity-50"
                >
                  {runningId === wf.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>{runningId === wf.id ? "Running..." : "Run Now"}</span>
                </button>
              </div>
            </div>
          </SpotlightCard>
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ title, desc, badge }: { title: string; desc: string; badge: string }) {
  return (
    <Link href="/compose" className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between group cursor-pointer">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          {badge}
        </span>
        <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
      </div>
      <h4 className="font-semibold text-sm text-white mb-1">{title}</h4>
      <p className="text-xs text-gray-400 line-clamp-2">{desc}</p>
    </Link>
  );
}
