import "server-only";

import crypto from "crypto";

function secret() {
  const s = process.env.ICAL_SECRET ?? process.env.AUTH_SECRET ?? "dev-secret";
  return s;
}

/**
 * Creates a URL-safe HMAC token scoped to a household (and optionally a member).
 * Format: base64url(householdId:memberId?):signature
 */
export function generateIcalToken(householdId: string, memberId?: string): string {
  const payload = memberId ? `${householdId}:${memberId}` : householdId;
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

type IcalTokenPayload = { householdId: string; memberId?: string };

export function verifyIcalToken(token: string): IcalTokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;

  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  const payload = Buffer.from(encoded, "base64url").toString();
  const parts = payload.split(":");
  if (!parts[0] || parts.length > 2) return null;

  return {
    householdId: parts[0],
    memberId: parts[1] ?? undefined,
  };
}
