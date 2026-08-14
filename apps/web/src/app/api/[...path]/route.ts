import { NextRequest, NextResponse } from "next/server";
import http from "http";

const API_PORT = 3001;
const API_HOST = process.env.INTERNAL_API_HOST || "10.166.0.2";

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

  return new Promise<NextResponse>((resolve) => {
    const proxyReq = http.request(
      {
        host: API_HOST,
        port: API_PORT,
        path: targetPath,
        method: req.method,
        headers: reqHeaders,
        timeout: 10000,
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
      console.error("Proxy error forwarding to API:", err.message);
      // Try fallback to 127.0.0.1 if docker DNS fails
      if (API_HOST === "api") {
        const fallbackReq = http.request(
          {
            host: "127.0.0.1",
            port: API_PORT,
            path: targetPath,
            method: req.method,
            headers: reqHeaders,
            timeout: 10000,
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
                  headers: resHeaders,
                })
              );
            });
          }
        );
        fallbackReq.on("error", (fErr) => {
          resolve(
            NextResponse.json(
              { error: `API Server unreachable (${err.message} / ${fErr.message})` },
              { status: 502 }
            )
          );
        });
        if (bodyData) fallbackReq.write(bodyData);
        fallbackReq.end();
      } else {
        resolve(
          NextResponse.json(
            { error: `API Server unreachable (${err.message})` },
            { status: 502 }
          )
        );
      }
    });

    if (bodyData) {
      proxyReq.write(bodyData);
    }
    proxyReq.end();
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
