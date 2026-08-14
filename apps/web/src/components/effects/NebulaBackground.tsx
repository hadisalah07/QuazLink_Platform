"use client";
import { motion } from "framer-motion";

export function NebulaBackground() {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-[var(--color-quaz-bg)] pointer-events-none">
      {/* Cyan Nebula */}
      <motion.div
        className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-20"
        style={{ background: "radial-gradient(circle, var(--color-quaz-cyan) 0%, transparent 70%)" }}
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Purple Nebula */}
      <motion.div
        className="absolute top-[40%] -right-[10%] w-[60vw] h-[60vw] rounded-full blur-[150px] opacity-20"
        style={{ background: "radial-gradient(circle, var(--color-quaz-purple) 0%, transparent 70%)" }}
        animate={{
          x: [0, -40, 0],
          y: [0, -50, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
    </div>
  );
}
