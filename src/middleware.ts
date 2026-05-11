import { NextResponse, type NextRequest } from "next/server";

// Read both during the rebrand transition; sessions issued before the rename
// remain valid until they expire naturally (max 21 days).
const SESSION_COOKIE = "quotidy_session";
const LEGACY_SESSION_COOKIE = "hearthly_session";
const CSRF_COOKIE = "__csrf";
// Routes that don't require a CSRF token (unauthenticated, form-based public flows,
// or native-form endpoints protected by SameSite=Lax cookies)
const CSRF_EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/invitations/redeem",
  "/api/invitations/",   // accept invitation via native form on /join/[token]
  "/api/households",      // household create/leave via native form
  "/api/metrics",         // UX telemetry beacon (sendBeacon can't set custom headers)
  "/api/feedback",        // bug-report can fire from a crashed shell where the CSRF cookie was lost
];

function resolveCsrfSecret(): string {
  const secret = process.env.CSRF_SECRET;
  if (secret && secret.length >= 16) return secret;

  // Hard-fail in production: a predictable secret is equivalent to no CSRF protection.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[security] CSRF_SECRET must be set to a strong random string (>=16 chars) in production.",
    );
  }
  // Dev fallback only — not safe for production traffic.
  return "quotidy-dev-only-csrf-fallback";
}

async function deriveCsrfToken(sessionToken: string): Promise<string> {
  const secret = resolveCsrfSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sessionToken));
  return Array.from(new Uint8Array(sig))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// In-memory rate limit store (per edge runtime instance)
// For production with multiple instances, use Redis/Upstash
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_RULES = [
  { pattern: /^\/api\/auth\/(login|register)$/, limit: 10, windowMs: 60_000 },
  { pattern: /^\/api\/occurrences\/[^/]+\/(complete|skip|reschedule|reassign|reopen)$/, limit: 30, windowMs: 60_000 },
  { pattern: /^\/api\/households\/[^/]+\/invites$/, limit: 5, windowMs: 60_000 },
  { pattern: /^\/api\//, limit: 120, windowMs: 60_000 },
] as const;

function getRateLimitKey(request: NextRequest, pattern: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  return `${ip}:${pattern}`;
}

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}

// Cleanup old entries periodically (every 5 minutes)
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) rateLimitStore.delete(key);
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionToken =
    request.cookies.get(SESSION_COOKIE)?.value ??
    request.cookies.get(LEGACY_SESSION_COOKIE)?.value;
  const rateLimitDisabled = process.env.RATE_LIMIT_DISABLED === "1";
  const csrfDisabled = process.env.CSRF_DISABLED === "1";
  const requestStart = Date.now();

  // Rate-limit API routes
  if (pathname.startsWith("/api/")) {
    if (!rateLimitDisabled) {
      maybeCleanup();

      for (const rule of RATE_LIMIT_RULES) {
        if (rule.pattern.test(pathname)) {
          const key = getRateLimitKey(request, rule.pattern.source);
          const allowed = checkRateLimit(key, rule.limit, rule.windowMs);

          if (!allowed) {
            return NextResponse.json(
              { error: "Trop de requêtes. Veuillez réessayer dans quelques instants." },
              {
                status: 429,
                headers: {
                  "Retry-After": "60",
                  "X-RateLimit-Limit": String(rule.limit),
                },
              },
            );
          }
          break;
        }
      }
    }

    // CSRF validation for state-changing authenticated API requests
    const isStateMutating = ["POST", "PUT", "DELETE", "PATCH"].includes(request.method);
    const isExempt = CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));

    if (isStateMutating && !isExempt && sessionToken && !csrfDisabled) {
      const expected = await deriveCsrfToken(sessionToken);
      const sent = request.headers.get("X-CSRF-Token");
      if (sent !== expected) {
        return NextResponse.json({ error: "Token CSRF invalide." }, { status: 403 });
      }
    }
  }

  // Per-request correlation id — propagated through downstream logs/errors so a single
  // user complaint can be traced across rate-limit hits, CSRF failures and route handlers.
  const requestId =
    request.headers.get("x-request-id")?.slice(0, 64) ??
    crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  // Set __csrf cookie on page requests when authenticated (JS-readable double-submit).
  // Always overwrite — if CSRF_SECRET rotates, stale cookies self-heal on the next page load.
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  if (sessionToken) {
    const csrfToken = await deriveCsrfToken(sessionToken);
    const isSecure = request.nextUrl.protocol === "https:";
    response.cookies.set(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      sameSite: "lax",
      secure: isSecure,
      path: "/",
      maxAge: 60 * 60 * 24 * 21, // match session duration
    });
  }

  // Lightweight request log for API routes — captures method, path, and middleware time.
  // Real per-route response time would require route-level instrumentation; this is enough
  // to spot pathological middleware traffic and correlate with rate-limit events.
  if (pathname.startsWith("/api/") && process.env.LOG_REQUESTS !== "0") {
    const duration = Date.now() - requestStart;
    response.headers.set("Server-Timing", `mw;dur=${duration}`);
    if (duration > 50) {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "info",
          event: "request.middleware",
          method: request.method,
          path: pathname,
          duration_ms: duration,
          request_id: requestId,
        }),
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all API routes
    "/api/(.*)",
    // Skip Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon\\.svg).*)",
  ],
};
