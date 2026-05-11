import "server-only";

import { db } from "@/lib/db";

export const BILLING_ENABLED = process.env.BILLING_ENABLED === "1";

export const betaFeatureDefaults = {
  households: { enabled: true, limit: null },
  members: { enabled: true, limit: null },
  full_history: { enabled: true, limit: null },
  advanced_exports: { enabled: true, limit: null },
  advanced_notifications: { enabled: true, limit: null },
  integrations: { enabled: true, limit: null },
  advanced_stats: { enabled: true, limit: null },
} as const;

export type FeatureKey = keyof typeof betaFeatureDefaults;

export async function canUseFeature(householdId: string, feature: FeatureKey) {
  if (!BILLING_ENABLED) {
    return {
      enabled: true,
      source: "beta",
      limit: betaFeatureDefaults[feature].limit,
    };
  }

  const entitlement = await db.featureEntitlement.findUnique({
    where: {
      householdId_feature: {
        householdId,
        feature,
      },
    },
  });

  if (!entitlement) {
    return {
      enabled: false,
      source: "missing",
      limit: null,
    };
  }

  const expired = entitlement.expiresAt ? entitlement.expiresAt < new Date() : false;

  return {
    enabled: entitlement.enabled && !expired,
    source: entitlement.source,
    limit: entitlement.limitValue,
  };
}

export async function getHouseholdBillingSnapshot(householdId: string) {
  const [subscription, entitlements, supporterTotal] = await Promise.all([
    db.subscription.findFirst({
      where: { householdId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    db.featureEntitlement.findMany({
      where: { householdId },
      orderBy: { feature: "asc" },
    }),
    db.supporterContribution.aggregate({
      where: { householdId, amountCents: { not: null } },
      _sum: { amountCents: true },
    }),
  ]);

  return {
    billingEnabled: BILLING_ENABLED,
    subscription,
    entitlements,
    supporterTotalCents: supporterTotal._sum.amountCents ?? 0,
    betaFeatures: betaFeatureDefaults,
  };
}
