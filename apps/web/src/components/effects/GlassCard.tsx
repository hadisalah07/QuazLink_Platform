"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, interactive = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/10 bg-[#0B101D]/85 p-6 shadow-xl",
          interactive &&
            "transition-[border-color,background-color,transform] duration-200 hover:border-white/20 hover:bg-[#0E1526]/95 hover:-translate-y-1 cursor-pointer",
          className
        )}
        style={{
          transform: "translateZ(0)",
          willChange: interactive ? "transform" : "auto",
        }}
        {...props}
      >
        <div className="relative z-10">{children}</div>
        {/* Subtle inner highlight border */}
        <div className="absolute inset-0 border border-white/5 rounded-2xl pointer-events-none" />
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";
