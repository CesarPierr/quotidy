import { NextResponse } from "next/server";

import { db } from "@/lib/db";

const APP_VERSION = process.env.APP_VERSION ?? process.env.npm_package_version ?? "unknown";

/**
 * Liveness + readiness probe.
 *
 *   GET /api/health         → quick "is the process up" check (no DB).
 *   GET /api/health?db=1    → also pings the database; returns 503 on failure.
 *
 * No auth: this endpoint is meant for uptime monitors and load balancers.
 * Returns no PII or internal config — only liveness signals.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const checkDb = url.searchParams.get("db") === "1";
  const startedAt = Date.now();

  if (!checkDb) {
    return NextResponse.json(
      {
        ok: true,
        status: "live",
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        ok: true,
        status: "ready",
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        db: { ok: true, latencyMs: Date.now() - startedAt },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "degraded",
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        db: {
          ok: false,
          latencyMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
