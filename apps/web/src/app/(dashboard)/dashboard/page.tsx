"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, Play, CheckCircle2, Clock, Plus, ExternalLink, AlertCircle, Bot } from "lucide-react";
import { Button } from "@heroui/react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { StaggeredText } from "@/components/ui/StaggeredText";
import { AnimatedList } from "@/components/ui/AnimatedList";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { getJobs, getCatalogs, type Job, type Catalog } from "@/lib/api";

export default function DashboardOverview() {
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [catalogs, setCatalogs] = React.useState<Catalog[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      try {
        const [jobsData, catalogsData] = await Promise.all([
          getJobs().catch(() => []),
          getCatalogs().catch(() => [])
        ]);
        setJobs(jobsData);
        setCatalogs(catalogsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Compute Stats
  const totalRuns = jobs.length;
  const completedJobs = jobs.filter(j => j.status === "completed" || j.status === "success");
  const successRate = totalRuns > 0 ? ((completedJobs.length / totalRuns) * 100).toFixed(1) + "%" : "0%";
  
  let totalTime = 0;
  let timedJobs = 0;
  completedJobs.forEach(j => {
    if (j.startedAt && j.completedAt) {
      const diff = new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime();
      if (diff > 0) {
        totalTime += diff;
        timedJobs++;
      }
    }
  });
  const avgExecutionTime = timedJobs > 0 ? (totalTime / timedJobs / 1000).toFixed(1) + "s" : "0s";

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <StaggeredText text="Overview" className="text-3xl font-bold tracking-tight text-white" />
        <Link href="/compose">
          <Button
            variant="ghost"
            className="relative overflow-hidden rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold px-6 shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:bg-cyan-500/20 hover:border-cyan-400 transition-all duration-300 group cursor-pointer"
          >
            <Plus className="w-4 h-4 fill-cyan-400 text-cyan-400 inline-block mr-2 group-hover:scale-110 group-hover:rotate-90 transition-transform duration-300" />
            New Workflow
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Runs" value={loading ? "..." : totalRuns.toString()} icon={Activity} trend={totalRuns > 0 ? "+1" : "0"} />
        <StatsCard title="Success Rate" value={loading ? "..." : successRate} icon={CheckCircle2} trend={parseFloat(successRate) > 90 ? "+Good" : "0"} />
        <StatsCard title="Active Workflows" value={loading ? "..." : catalogs.length.toString()} icon={Play} trend={catalogs.length > 0 ? "+Active" : "0"} />
        <StatsCard title="Avg. Execution Time" value={loading ? "..." : avgExecutionTime} icon={Clock} trend="0" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <SpotlightCard className="col-span-2 p-6 shadow-xl min-h-[350px]">
          <ActivityChart jobs={jobs} />
        </SpotlightCard>
        
        <SpotlightCard className="p-6 shadow-xl">
          <h2 className="font-semibold text-xl mb-4 text-white">Quick Actions</h2>
          <AnimatedList className="space-y-3" delay={0.2}>
             <Link href="/accounts" className="block">
               <Button className="w-full justify-start text-sm text-gray-300 font-medium hover:text-white hover:bg-white/10 transition-colors" variant="ghost">
                 <ExternalLink className="w-4 h-4 mr-2 text-cyan-400" />
                 Connect New Account
               </Button>
             </Link>
             <Link href="/runs" className="block">
               <Button className="w-full justify-start text-sm text-gray-300 font-medium hover:text-white hover:bg-white/10 transition-colors" variant="ghost">
                 <AlertCircle className="w-4 h-4 mr-2 text-red-400" />
                 View Error Logs
               </Button>
             </Link>
             <Link href="/workflows" className="block">
               <Button className="w-full justify-start text-sm text-gray-300 font-medium hover:text-white hover:bg-white/10 transition-colors" variant="ghost">
                 <Bot className="w-4 h-4 mr-2 text-purple-400" />
                 Manage Agents
               </Button>
             </Link>
          </AnimatedList>
        </SpotlightCard>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, trend }: { title: string, value: string, icon: React.ElementType, trend: string }) {
  const isPositive = trend.startsWith("+");
  const isNeutral = trend === "0";
  return (
    <SpotlightCard className="p-6 flex flex-col justify-between h-[140px]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-400">{title}</span>
        <Icon className="w-5 h-5 text-gray-500" />
      </div>
      <div className="flex items-baseline space-x-2 mt-auto">
        <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
        {!isNeutral && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {trend}
          </span>
        )}
      </div>
    </SpotlightCard>
  );
}
