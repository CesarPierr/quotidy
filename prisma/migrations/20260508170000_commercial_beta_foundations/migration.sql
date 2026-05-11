-- Commercial beta foundations: durable feedback, UX analytics, RGPD requests,
-- supporter records, and dormant freemium/billing primitives.

CREATE TYPE "FeedbackKind" AS ENUM ('bug', 'idea', 'question', 'abuse', 'billing', 'security');
CREATE TYPE "FeedbackStatus" AS ENUM ('open', 'triaged', 'resolved', 'archived');
CREATE TYPE "DataRequestStatus" AS ENUM ('requested', 'processing', 'completed', 'rejected');
CREATE TYPE "BillingInterval" AS ENUM ('month', 'year', 'one_time');
CREATE TYPE "SubscriptionStatus" AS ENUM ('beta', 'trialing', 'active', 'past_due', 'canceled', 'inactive');

ALTER TABLE "User"
  ADD COLUMN "isSiteAdmin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);

CREATE TABLE "FeedbackReport" (
  "id" TEXT NOT NULL,
  "kind" "FeedbackKind" NOT NULL,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'open',
  "message" TEXT NOT NULL,
  "url" TEXT,
  "digest" TEXT,
  "userAgent" TEXT,
  "reporterUserId" TEXT,
  "householdId" TEXT,
  "githubUrl" TEXT,
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UxEvent" (
  "id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "userId" TEXT,
  "householdId" TEXT,
  "path" TEXT,
  "props" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UxEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminAuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "householdId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataExportRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "householdId" TEXT,
  "status" "DataRequestStatus" NOT NULL DEFAULT 'requested',
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DataExportRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeletionRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "householdId" TEXT,
  "status" "DataRequestStatus" NOT NULL DEFAULT 'requested',
  "reason" TEXT,
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupporterContribution" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "householdId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'manual',
  "providerRef" TEXT,
  "amountCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "message" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupporterContribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "interval" "BillingInterval" NOT NULL DEFAULT 'month',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "entitlements" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingCustomer" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "householdId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "providerCustomerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "planId" TEXT,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'beta',
  "provider" TEXT NOT NULL DEFAULT 'internal',
  "providerSubscriptionId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeatureEntitlement" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "limitValue" INTEGER,
  "source" TEXT NOT NULL DEFAULT 'beta',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FeatureEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedbackReport_status_createdAt_idx" ON "FeedbackReport"("status", "createdAt");
CREATE INDEX "FeedbackReport_reporterUserId_createdAt_idx" ON "FeedbackReport"("reporterUserId", "createdAt");
CREATE INDEX "FeedbackReport_householdId_createdAt_idx" ON "FeedbackReport"("householdId", "createdAt");

CREATE INDEX "UxEvent_event_createdAt_idx" ON "UxEvent"("event", "createdAt");
CREATE INDEX "UxEvent_userId_createdAt_idx" ON "UxEvent"("userId", "createdAt");
CREATE INDEX "UxEvent_householdId_createdAt_idx" ON "UxEvent"("householdId", "createdAt");

CREATE INDEX "AdminAuditEvent_action_createdAt_idx" ON "AdminAuditEvent"("action", "createdAt");
CREATE INDEX "AdminAuditEvent_actorUserId_createdAt_idx" ON "AdminAuditEvent"("actorUserId", "createdAt");
CREATE INDEX "AdminAuditEvent_householdId_createdAt_idx" ON "AdminAuditEvent"("householdId", "createdAt");

CREATE INDEX "DataExportRequest_userId_createdAt_idx" ON "DataExportRequest"("userId", "createdAt");
CREATE INDEX "DataExportRequest_householdId_createdAt_idx" ON "DataExportRequest"("householdId", "createdAt");
CREATE INDEX "DataExportRequest_status_createdAt_idx" ON "DataExportRequest"("status", "createdAt");

CREATE INDEX "DeletionRequest_userId_createdAt_idx" ON "DeletionRequest"("userId", "createdAt");
CREATE INDEX "DeletionRequest_householdId_createdAt_idx" ON "DeletionRequest"("householdId", "createdAt");
CREATE INDEX "DeletionRequest_status_createdAt_idx" ON "DeletionRequest"("status", "createdAt");

CREATE INDEX "SupporterContribution_userId_createdAt_idx" ON "SupporterContribution"("userId", "createdAt");
CREATE INDEX "SupporterContribution_householdId_createdAt_idx" ON "SupporterContribution"("householdId", "createdAt");
CREATE INDEX "SupporterContribution_provider_providerRef_idx" ON "SupporterContribution"("provider", "providerRef");

CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");
CREATE INDEX "Plan_isActive_code_idx" ON "Plan"("isActive", "code");

CREATE UNIQUE INDEX "BillingCustomer_provider_providerCustomerId_key" ON "BillingCustomer"("provider", "providerCustomerId");
CREATE INDEX "BillingCustomer_userId_idx" ON "BillingCustomer"("userId");
CREATE INDEX "BillingCustomer_householdId_idx" ON "BillingCustomer"("householdId");

CREATE UNIQUE INDEX "Subscription_provider_providerSubscriptionId_key" ON "Subscription"("provider", "providerSubscriptionId");
CREATE INDEX "Subscription_householdId_status_idx" ON "Subscription"("householdId", "status");
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

CREATE UNIQUE INDEX "FeatureEntitlement_householdId_feature_key" ON "FeatureEntitlement"("householdId", "feature");
CREATE INDEX "FeatureEntitlement_feature_enabled_idx" ON "FeatureEntitlement"("feature", "enabled");
CREATE INDEX "FeatureEntitlement_expiresAt_idx" ON "FeatureEntitlement"("expiresAt");

ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UxEvent" ADD CONSTRAINT "UxEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UxEvent" ADD CONSTRAINT "UxEvent_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminAuditEvent" ADD CONSTRAINT "AdminAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminAuditEvent" ADD CONSTRAINT "AdminAuditEvent_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DataExportRequest" ADD CONSTRAINT "DataExportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataExportRequest" ADD CONSTRAINT "DataExportRequest_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupporterContribution" ADD CONSTRAINT "SupporterContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupporterContribution" ADD CONSTRAINT "SupporterContribution_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingCustomer" ADD CONSTRAINT "BillingCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingCustomer" ADD CONSTRAINT "BillingCustomer_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeatureEntitlement" ADD CONSTRAINT "FeatureEntitlement_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
