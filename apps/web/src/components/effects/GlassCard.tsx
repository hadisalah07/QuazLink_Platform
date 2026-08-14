"use client";
import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { glassHover } from "@/lib/motion";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  interactive?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, interactive = false, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        variants={interactive ? glassHover : undefined}
        initial="initial"
        whileHover={interactive ? "hover" : undefined}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 shadow-2xl",
          className
        )}
        {...props}
      >
        <div className="relative z-10">{children}</div>
        
        {/* Subtle inner highlight */}
        <div className="absolute inset-0 border border-white/5 rounded-2xl pointer-events-none" />
      </motion.div>
    );
  }
);

GlassCard.displayName = "GlassCard";
