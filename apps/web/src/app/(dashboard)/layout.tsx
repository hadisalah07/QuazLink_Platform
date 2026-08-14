import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopNav } from "@/components/dashboard/TopNav";
import { getMe } from "@/lib/api";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // First-load safety net + real identity for the nav. This is NOT the security
  // boundary (layouts don't re-render on client-side nav) — proxy.ts gates
  // navigation and Express requireAuth guards the data. cookies() is async and
  // server-only in this Next; forward the header so the API sees our session.
  const cookieStore = await cookies();
  const user = await getMe(cookieStore.toString());
  if (!user) {
    redirect("/login");
  }

  return (
    <div 
      className="flex bg-[var(--color-quaz-bg)] text-white overflow-hidden" 
      style={{ zoom: 0.85, width: "calc(100vw / 0.85)", height: "calc(100vh / 0.85)" }}
    >
      <Sidebar user={user} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopNav />
        <main className="flex-1 overflow-y-auto bg-black/20 p-6 md:p-8 lg:p-10">
          <div className="mx-auto w-full max-w-[1800px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
