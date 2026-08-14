"use client";
import * as React from "react";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { Play, Save, Settings, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function WorkflowEditorPage() {
  const params = useParams();
  
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/workflows" className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-3">
               <span>Sync CRM to Slack</span>
               <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">Active</span>
            </h1>
            <p className="text-sm text-gray-400">ID: {params.id as string} • Last edited 2 hours ago</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors flex items-center space-x-2 text-sm font-semibold">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors flex items-center space-x-2 text-sm font-semibold">
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
          <button className="px-4 py-2 bg-[var(--color-quaz-cyan)] text-black rounded-lg hover:bg-cyan-400 transition-colors flex items-center space-x-2 shadow-[0_0_15px_rgba(34,211,238,0.3)] text-sm font-semibold">
            <Play className="w-4 h-4 fill-black" />
            <span>Test Run</span>
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 w-full rounded-xl relative shadow-2xl">
         <WorkflowCanvas />
      </div>
    </div>
  );
}
