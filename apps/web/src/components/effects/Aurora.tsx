"use client";

import * as React from "react";

export function Aurora() {
  return (
    <div 
      className="absolute top-0 inset-x-0 h-[40vh] pointer-events-none overflow-hidden z-0"
      style={{
        background: "linear-gradient(180deg, rgba(34, 211, 238, 0.12) 0%, rgba(34, 211, 238, 0.04) 45%, transparent 100%)",
      }}
      aria-hidden="true"
    />
  );
}
