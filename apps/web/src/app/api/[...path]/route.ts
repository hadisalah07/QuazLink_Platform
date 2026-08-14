import { NextRequest, NextResponse } from "next/server";
import http from "http";
import dns from "dns";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

const CANDIDATE_HOSTS = [process.env.INTERNAL_API_HOST || "api", "127.0.0.1"];

const API_PORT = 3001;

function forwardToHost(
  host: string,
  targetPath: string,
  method: string,
  reqHeaders: Record<string, string>,
  bodyData?: string
): Promise<NextResponse> {
  return new Promise((resolve, reject) => {
    const proxyReq = http.request(
      {
        host,
        port: API_PORT,
        path: targetPath,
        method,
        headers: reqHeaders,
        timeout: 15000,
      },
      (proxyRes) => {
        const chunks: Buffer[] = [];
        proxyRes.on("data", (chunk) => chunks.push(chunk));
        proxyRes.on("end", () => {
          const body = Buffer.concat(chunks);
          const resHeaders = new Headers();

          Object.entries(proxyRes.headers).forEach(([key, value]) => {
            if (!value) return;
            if (Array.isArray(value)) {
              value.forEach((v) => resHeaders.append(key, v));
            } else {
              resHeaders.set(key, value);
            }
          });

          resolve(
            new NextResponse(body, {
              status: proxyRes.statusCode || 200,
              statusText: proxyRes.statusMessage,
              headers: resHeaders,
            })
          );
        });
      }
    );

    proxyReq.on("error", (err) => {
      reject(err);
    });

    proxyReq.on("timeout", () => {
      proxyReq.destroy(new Error(`Timeout connecting to ${host}:${API_PORT}`));
    });

    if (bodyData) {
      proxyReq.write(bodyData);
    }
    proxyReq.end();
  });
}

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = `/api/${path.join("/")}${req.nextUrl.search}`;

  const reqHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower !== "host" && lower !== "connection" && lower !== "content-length") {
      reqHeaders[lower] = value;
    }
  });

  const bodyData =
    req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined;

  if (bodyData) {
    reqHeaders["content-length"] = Buffer.byteLength(bodyData).toString();
    if (!reqHeaders["content-type"]) {
      reqHeaders["content-type"] = "application/json";
    }
  }

  const errors: string[] = [];

  for (const host of CANDIDATE_HOSTS) {
    try {
      const response = await forwardToHost(host, targetPath, req.method, reqHeaders, bodyData);
      return response;
    } catch (err: any) {
      errors.push(`${host}: ${err.message}`);
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
