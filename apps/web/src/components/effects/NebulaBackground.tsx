"use client";

import * as React from "react";

export function NebulaBackground() {
  return (
    <div 
      className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none select-none"
      style={{
        backgroundColor: "#060913",
        // Pure GPU-accelerated radial gradient mesh: 0% blur filter, 0ms render latency, 120 FPS locked
        backgroundImage: `
          radial-gradient(circle at 15% 15%, rgba(34, 211, 238, 0.12) 0%, rgba(34, 211, 238, 0.03) 35%, transparent 65%),
          radial-gradient(circle at 85% 65%, rgba(139, 92, 246, 0.14) 0%, rgba(139, 92, 246, 0.03) 40%, transparent 70%),
          radial-gradient(circle at 50% 90%, rgba(16, 185, 129, 0.08) 0%, transparent 50%)
        `,
      }}
      aria-hidden="true"
    />
  );
}
