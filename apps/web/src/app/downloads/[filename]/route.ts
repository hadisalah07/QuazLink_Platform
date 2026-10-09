import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const safeFilename = path.basename(filename);

  // Candidate paths on host / container
  const candidates = [
    path.join("/data/downloads", safeFilename),
    path.join(process.cwd(), "public", "downloads", safeFilename),
    path.join(process.cwd(), "apps", "web", "public", "downloads", safeFilename),
  ];

  let foundPath: string | null = null;
  for (const c of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ c)) {
      foundPath = c;
      break;
    }
  }

  if (foundPath) {
    const stat = fs.statSync(/*turbopackIgnore: true*/ foundPath);
    const range = req.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(/*turbopackIgnore: true*/ foundPath, { start, end });
      const webStream = Readable.toWeb(stream);

      return new Response(webStream as any, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${safeFilename}"`,
          "Cache-Control": "public, max-age=86400, s-maxage=604800",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const stream = fs.createReadStream(/*turbopackIgnore: true*/ foundPath);
    const webStream = Readable.toWeb(stream);

    return new Response(webStream as any, {
      status: 200,
      headers: {
        "Content-Length": stat.size.toString(),
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  }

  // Fallback to GitHub Release CDN
  const cdnMap: Record<string, string> = {
    "QuazLink-Runner-Setup-v26.10.13.exe": "https://github.com/hadisalah07/QuazLink_Platform/releases/download/v26.10.13/QuazLink-Runner-Setup-v26.10.13.exe",
    "QuazLink-Runner-Setup.exe": "https://github.com/hadisalah07/QuazLink_Platform/releases/download/v26.10.13/QuazLink-Runner-Setup-v26.10.13.exe",
    "QuazLink-POS-Setup-v1.1.0.exe": "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Setup-v1.1.0.exe",
    "QuazLink-POS-Setup.exe": "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Setup-v1.1.0.exe",
    "QuazLink-POS-Portable-v1.1.0.zip": "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Portable-v1.1.0.zip",
    "QuazLink-POS-Portable.zip": "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Portable-v1.1.0.zip",
    "QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe": "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe",
    "QuazLink-POS-Legacy-Win7-Setup.exe": "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe",
    "QuazLink-POS-Legacy-Win7-Portable-v1.1.0.zip": "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Legacy-Win7-Portable-v1.1.0.zip",
    "QuazLink-POS-Legacy-Win7-Portable.zip": "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Legacy-Win7-Portable.zip",
  };

  const target = cdnMap[safeFilename];
  if (target) {
    return NextResponse.redirect(target, { status: 307 });
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}
