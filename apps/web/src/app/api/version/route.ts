import { NextResponse } from "next/server";
import { APP_VERSION, BUILD_ID, DEPLOY_ENV, RELEASE_DATE, GIT_COMMIT } from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    platform: "QuazLink Platform",
    version: APP_VERSION,
    buildId: BUILD_ID,
    environment: DEPLOY_ENV,
    releaseDate: RELEASE_DATE,
    commit: GIT_COMMIT,
    timestamp: new Date().toISOString(),
  });
}
