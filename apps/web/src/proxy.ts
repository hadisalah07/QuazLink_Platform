import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// OPTIMISTIC auth gate only. Proxy runs on every request/prefetch, so it does
// the cheapest possible check: is the session cookie present? It does NOT
// verify the JWT or hit the DB — the real security boundary is Express's
// requireAuth on every /api/* call (and the dashboard layout's /me read as a
// first-load safety net). A present-but-invalid cookie is caught there.

// Cookie name must match SESSION_COOKIE in apps/api/src/lib/auth.ts.
const SESSION_COOKIE = "session";

// Prefix match so nested routes (e.g. /workflows/[id]) are covered too.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/workflows",
  "/accounts",
  "/catalogs",
  "/compose",
  "/runs",
  "/settings",
];

const AUTH_PAGES = ["/login", "/signup"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  // No cookie + protected route → bounce to login.
  if (!hasSession && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Already has a cookie + on login/signup → send to the dashboard.
  if (hasSession && matchesPrefix(pathname, AUTH_PAGES)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, and static files
  // (any path containing a dot). Keeps redirects off CSS/JS/images.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
