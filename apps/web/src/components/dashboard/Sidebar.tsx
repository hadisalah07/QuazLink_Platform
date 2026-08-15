"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, Zap, Settings, Workflow, PenSquare, ShoppingBag, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { logout, type AuthUser } from "@/lib/api";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Workflows", href: "/workflows", icon: Workflow },
  { name: "Accounts", href: "/accounts", icon: Users },
  { name: "Catalogs", href: "/catalogs", icon: ShoppingBag },
  { name: "Compose", href: "/compose", icon: PenSquare },
  { name: "Runs", href: "/runs", icon: Zap },
  { name: "Settings", href: "/settings", icon: Settings },
];

function initials(user: AuthUser): string {
  const base = (user.name?.trim() || user.email).trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(true);

  const displayName = user.name || user.email.split("@")[0];

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
    } catch (e) {
      console.error("Logout error:", e);
    }
    window.location.href = "/login";
  }

  return (
    <aside 
      className={cn(
        "border-r border-white/10 bg-[var(--color-quaz-bg)] flex flex-col h-full flex-shrink-0 transition-all duration-300 relative",
        isExpanded ? "w-64" : "w-20 cursor-pointer"
      )}
      onClick={() => { if (!isExpanded) setIsExpanded(true); }}
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
        <Link href="/" className="flex items-center space-x-2 group">
          <img src="/logo.png" alt="QuazLink Logo" className="w-8 h-8 flex-shrink-0 object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.4)] group-hover:drop-shadow-[0_0_20px_rgba(34,211,238,0.9)] transition-all duration-300" />
          {isExpanded && <span className="font-semibold text-lg text-white tracking-tight whitespace-nowrap">QuazLink</span>}
        </Link>
        {isExpanded && (
          <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className="text-gray-400 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              title={!isExpanded ? item.name : undefined}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors overflow-hidden",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white",
                !isExpanded && "justify-center px-0"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-[var(--color-quaz-cyan)]" : "")} />
              {isExpanded && <span className="whitespace-nowrap">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        <div className={cn("flex items-center rounded-lg overflow-hidden", isExpanded ? "space-x-3 p-2" : "justify-center p-0 mb-4")}>
          <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center text-xs font-medium border border-white/10" title={!isExpanded ? displayName : undefined}>
            {initials(user)}
          </div>
          {isExpanded && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-white leading-tight truncate">{displayName}</span>
              <span className="text-xs text-gray-500 truncate">{user.email}</span>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          disabled={signingOut}
          title={!isExpanded ? "Sign out" : undefined}
          className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden",
            isExpanded ? "w-full" : "w-10 h-10 justify-center mx-auto px-0"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {isExpanded && <span className="whitespace-nowrap">{signingOut ? "Signing out…" : "Sign out"}</span>}
        </button>
      </div>
    </aside>
  );
}
