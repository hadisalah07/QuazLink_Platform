import * as React from "react";
import { StarField } from "@/components/effects/StarField";
import { NebulaBackground } from "@/components/effects/NebulaBackground";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center">
      <StarField interactive={true} />
      <NebulaBackground />
      <main className="flex-1 w-full flex flex-col">{children}</main>
    </div>
  );
}
