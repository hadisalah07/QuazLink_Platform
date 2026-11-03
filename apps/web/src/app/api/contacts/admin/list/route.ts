import { NextRequest, NextResponse } from "next/server";

const API_PORT = 3001;
const CANDIDATE_HOSTS = [
  process.env.INTERNAL_API_HOST || "api",
  "127.0.0.1",
  "localhost",
];

export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.search;
    const cookie = req.headers.get("cookie");

    let backendResponse: Response | null = null;
    for (const host of CANDIDATE_HOSTS) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`http://${host}:${API_PORT}/api/contacts/admin/list${qs}`, {
          method: "GET",
          headers: {
            cookie: cookie || "",
          },
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(timer);
        if (res.ok) {
          backendResponse = res;
          break;
        }
      } catch {
        // Fallback
      }
    }

    if (backendResponse) {
      const data = await backendResponse.json();
      return NextResponse.json(data);
    }

    // Fallback empty response for local dev if Express DB is offline
    return NextResponse.json({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      counts: { pending: 0, inProgress: 0, resolved: 0, all: 0 },
    });
  } catch (error: any) {
    return NextResponse.json({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      counts: { pending: 0, inProgress: 0, resolved: 0, all: 0 },
    });
  }
}

