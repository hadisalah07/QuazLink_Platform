import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import { Bot, Network, Zap, CheckCircle2, AlertCircle } from "lucide-react";

export function CustomNode({ data }: any) {
  const Icon = data.icon === 'bot' ? Bot : data.icon === 'network' ? Network : data.icon === 'zap' ? Zap : CheckCircle2;
  
  return (
    <div className="px-4 py-3 rounded-xl border border-white/10 bg-[var(--color-quaz-bg)] shadow-[0_0_15px_rgba(255,255,255,0.05)] min-w-[200px] flex items-center space-x-3 backdrop-blur-md relative group">
      {/* Target Handle */}
      {data.isTarget && (
        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-[var(--color-quaz-cyan)] !border-none !-top-1.5" />
      )}
      
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-white/10 ${data.status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-gray-300 group-hover:text-white group-hover:bg-white/10 transition-colors'}`}>
         {data.status === 'error' ? <AlertCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
      </div>
      
      <div className="flex flex-col">
        <span className="text-sm font-bold text-white">{data.label}</span>
        <span className="text-xs text-gray-500">{data.description}</span>
      </div>

      {/* Source Handle */}
      {data.isSource && (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-[var(--color-quaz-purple)] !border-none !-bottom-1.5" />
      )}
    </div>
  );
}
