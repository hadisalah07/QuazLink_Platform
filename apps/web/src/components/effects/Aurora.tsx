"use client";
import { motion } from "framer-motion";

export function Aurora() {
  return (
    <div className="absolute top-0 inset-x-0 h-[40vh] pointer-events-none overflow-hidden z-0">
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background: "linear-gradient(180deg, var(--color-quaz-cyan) 0%, transparent 100%)",
          filter: "blur(60px)",
          transform: "translateY(-50%)"
        }}
        animate={{
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
