import { NextRequest, NextResponse } from "next/server";

const CANDIDATE_HOSTS = [
  process.env.INTERNAL_API_HOST || "api",
  "10.166.0.2",
  "127.0.0.1",
];

const API_PORT = 3001;
let preferredHost: string | null = null;

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = `/api/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((val, key) => {
    const lower = key.toLowerCase();
    if (
      lower !== "host" &&
      lower !== "connection" &&
      lower !== "content-length" &&
      lower !== "transfer-encoding"
    ) {
      headers.set(key, val);
    }
  });

  const bodyData =
    req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined;

  const errors: string[] = [];
  const hostsToTry = preferredHost
    ? [preferredHost, ...CANDIDATE_HOSTS.filter((h) => h !== preferredHost)]
    : CANDIDATE_HOSTS;

  for (const host of hostsToTry) {
    const targetUrl = `http://${host}:${API_PORT}${targetPath}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: bodyData,
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      preferredHost = host;

      const resHeaders = new Headers();
      res.headers.forEach((val, key) => {
        const lower = key.toLowerCase();
        if (lower !== "content-encoding" && lower !== "transfer-encoding") {
          resHeaders.set(key, val);
        }
      });

      const nullBodyStatuses = [101, 204, 205, 304];
      const resBody = nullBodyStatuses.includes(res.status)
        ? null
        : await res.arrayBuffer();

      return new NextResponse(resBody, {
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
      });
    } catch (err: any) {
      if (host === preferredHost) preferredHost = null;
      const cause = err.cause ? ` [cause: ${err.cause.code || err.cause.message || err.cause}]` : "";
      errors.push(`${host}: ${err.message}${cause}`);
    }
  }

  console.error("All API host candidates failed:", errors.join(" | "));
  return NextResponse.json(
    { error: `API Gateway unreachable. Attempts: ${errors.join(", ")}` },
    { status: 502 }
  );
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
