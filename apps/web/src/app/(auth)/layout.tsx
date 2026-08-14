import * as React from "react";
import { StarField } from "@/components/effects/StarField";
import { NebulaBackground } from "@/components/effects/NebulaBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
      <StarField interactive={true} />
      <NebulaBackground />
      {/* Center the auth card and keep it above the background effects */}
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
