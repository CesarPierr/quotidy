import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { IntegrationProvider } from "@prisma/client";

import { db } from "@/lib/db";

export const OPENCLAW_PROVIDER: IntegrationProvider = "mcp_openclaw";
// Canonical headers (post-rebrand). The `x-hearthly-*` legacy aliases below remain
// accepted indefinitely so existing third-party integrations don't break.
export const INTEGRATION_KEY_HEADER = "x-quotidy-key";
export const INTEGRATION_HOUSEHOLD_HEADER = "x-quotidy-household";
const LEGACY_INTEGRATION_KEY_HEADER = "x-hearthly-key";
const LEGACY_INTEGRATION_HOUSEHOLD_HEADER = "x-hearthly-household";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeCompareHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createIntegrationApiKey() {
  return `mmg_oc_${randomBytes(24).toString("base64url")}`;
}

export function hashIntegrationApiKey(apiKey: string) {
  return sha256(apiKey);
}

export function getIntegrationKeyPreview(apiKey: string) {
  return `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`;
}

export function readIntegrationApiKey(request: Request) {
  const headerValue =
    request.headers.get(INTEGRATION_KEY_HEADER)?.trim() ??
    request.headers.get(LEGACY_INTEGRATION_KEY_HEADER)?.trim();

  if (headerValue) {
    return headerValue;
  }

  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export function readIntegrationHouseholdId(request: Request, fallback?: string | null) {
  const headerValue =
    request.headers.get(INTEGRATION_HOUSEHOLD_HEADER)?.trim() ??
    request.headers.get(LEGACY_INTEGRATION_HOUSEHOLD_HEADER)?.trim();

  if (headerValue) {
    return headerValue;
  }

  if (fallback) {
    return fallback;
  }

  const url = new URL(request.url);

  return url.searchParams.get("householdId");
}

export async function getHouseholdIntegration(householdId: string, provider: IntegrationProvider = OPENCLAW_PROVIDER) {
  return db.householdIntegration.findUnique({
    where: {
      householdId_provider: {
        householdId,
        provider,
      },
    },
    include: {
      household: {
        select: {
          id: true,
          name: true,
          timezone: true,
        },
      },
    },
  });
}

export async function authorizeHouseholdIntegrationRequest(request: Request, householdId: string) {
  const apiKey = readIntegrationApiKey(request);

  if (!apiKey) {
    return { ok: false as const, reason: "missing_key" as const };
  }

  const integration = await getHouseholdIntegration(householdId);

  if (!integration || !integration.isEnabled || !integration.apiKeyHash) {
    return { ok: false as const, reason: "integration_disabled" as const };
  }

  const providedHash = hashIntegrationApiKey(apiKey);

  if (!safeCompareHex(providedHash, integration.apiKeyHash)) {
    return { ok: false as const, reason: "invalid_key" as const };
  }

  return {
    ok: true as const,
    integration,
  };
}
