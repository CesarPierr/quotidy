import { describe, it, expect } from "vitest";

// Mirror the deriveCsrfToken logic from middleware (edge-runtime Web Crypto)
async function deriveCsrfToken(sessionToken: string, secret = "quotidy-csrf-default"): Promise<string> {
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

describe("CSRF token derivation", () => {
  it("produces a 32-char hex string", async () => {
    const token = await deriveCsrfToken("test-session-token");
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is deterministic — same input yields same output", async () => {
    const a = await deriveCsrfToken("abc123");
    const b = await deriveCsrfToken("abc123");
    expect(a).toBe(b);
  });

  it("differs for different session tokens", async () => {
    const a = await deriveCsrfToken("token-A");
    const b = await deriveCsrfToken("token-B");
    expect(a).not.toBe(b);
  });

  it("differs for different secrets", async () => {
    const a = await deriveCsrfToken("same-token", "secret-1");
    const b = await deriveCsrfToken("same-token", "secret-2");
    expect(a).not.toBe(b);
  });
});
