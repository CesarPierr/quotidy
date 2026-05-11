-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('weekly_rule', 'date_range_absence');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('daily', 'every_x_days', 'weekly', 'every_x_weeks', 'monthly_simple');

-- CreateEnum
CREATE TYPE "RecurrenceMode" AS ENUM ('FIXED', 'SLIDING');

-- CreateEnum
CREATE TYPE "AssignmentMode" AS ENUM ('fixed', 'manual', 'strict_alternation', 'round_robin', 'least_assigned_count', 'least_assigned_minutes');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('planned', 'due', 'overdue', 'completed', 'skipped', 'rescheduled', 'cancelled');

-- CreateEnum
CREATE TYPE "OccurrenceActionType" AS ENUM ('created', 'assigned', 'completed', 'skipped', 'rescheduled', 'reassigned', 'edited', 'cancelled');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('mcp_openclaw');

-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('bug', 'idea', 'question', 'abuse', 'billing', 'security');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('open', 'triaged', 'resolved', 'archived');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('requested', 'processing', 'completed', 'rejected');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('month', 'year', 'one_time');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('beta', 'trialing', 'active', 'past_due', 'canceled', 'inactive');

-- CreateEnum
CREATE TYPE "SavingsBoxKind" AS ENUM ('savings', 'project', 'debt', 'provision');

-- CreateEnum
CREATE TYPE "SavingsEntryType" AS ENUM ('deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'auto_fill', 'adjustment');

-- CreateEnum
CREATE TYPE "SavingsCalculatorFieldType" AS ENUM ('number', 'amount', 'percent');

-- CreateEnum
CREATE TYPE "SavingsCalculatorResultMode" AS ENUM ('deposit', 'withdrawal', 'none');

-- CreateEnum
CREATE TYPE "SavingsCalculatorNegativeMode" AS ENUM ('clamp_to_zero', 'convert_to_opposite');

-- CreateEnum
CREATE TYPE "SavingsCalculatorRoundingMode" AS ENUM ('cents', 'euro_floor', 'euro_ceil', 'euro_nearest');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isSiteAdmin" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3),
    "privacyAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "savingsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "weightingFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "weeklyCapacityMinutes" INTEGER,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdInvite" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdByMemberId" TEXT,
    "acceptedByUserId" TEXT,
    "token" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'member',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdIntegration" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "serverUrl" TEXT,
    "clientLabel" TEXT,
    "apiKeyHash" TEXT,
    "apiKeyPreview" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberAvailability" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "AvailabilityType" NOT NULL,
    "weekdays" JSONB,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurrenceRule" (
    "id" TEXT NOT NULL,
    "type" "RecurrenceType" NOT NULL,
    "mode" "RecurrenceMode" NOT NULL DEFAULT 'SLIDING',
    "interval" INTEGER NOT NULL DEFAULT 1,
    "weekdays" JSONB,
    "dayOfMonth" INTEGER,
    "anchorDate" TIMESTAMP(3) NOT NULL,
    "generateTimeOfDay" TEXT,
    "dueOffsetDays" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurrenceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentRule" (
    "id" TEXT NOT NULL,
    "mode" "AssignmentMode" NOT NULL,
    "eligibleMemberIds" JSONB NOT NULL,
    "fixedMemberId" TEXT,
    "rotationOrder" JSONB,
    "fairnessWindowDays" INTEGER,
    "preserveRotationOnSkip" BOOLEAN NOT NULL DEFAULT true,
    "preserveRotationOnReschedule" BOOLEAN NOT NULL DEFAULT true,
    "rebalanceOnMemberAbsence" BOOLEAN NOT NULL DEFAULT true,
    "lockAssigneeAfterGeneration" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "room" TEXT,
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#D8643D',
    "tags" JSONB,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 30,
    "difficulty" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCollective" BOOLEAN NOT NULL DEFAULT false,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "lastCompletedAt" TIMESTAMP(3),
    "recurrenceRuleId" TEXT NOT NULL,
    "assignmentRuleId" TEXT NOT NULL,
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskOccurrence" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "taskTemplateId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "assignedMemberId" TEXT,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'planned',
    "sourceGenerationKey" TEXT NOT NULL,
    "generationVersion" INTEGER NOT NULL DEFAULT 1,
    "originalScheduledDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedByMemberId" TEXT,
    "actualMinutes" INTEGER,
    "notes" TEXT,
    "wasCompletedAlone" BOOLEAN,
    "isManuallyModified" BOOLEAN NOT NULL DEFAULT false,
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdHoliday" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccurrenceActionLog" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "actionType" "OccurrenceActionType" NOT NULL,
    "actorMemberId" TEXT,
    "previousValues" JSONB,
    "newValues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OccurrenceActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccurrenceComment" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OccurrenceComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsBox" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SavingsBoxKind" NOT NULL DEFAULT 'savings',
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#D8643D',
    "targetAmount" DECIMAL(12,2),
    "targetDate" TIMESTAMP(3),
    "allowNegative" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsAutoFillRule" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "type" "RecurrenceType" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "weekdays" JSONB,
    "dayOfMonth" INTEGER,
    "anchorDate" TIMESTAMP(3) NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "lastAppliedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsAutoFillRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsEntry" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "type" "SavingsEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "authorMemberId" TEXT,
    "transferId" TEXT,
    "autoFillRuleId" TEXT,
    "autoFillKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsTransfer" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "fromBoxId" TEXT NOT NULL,
    "toBoxId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "authorMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsCalculator" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "boxId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "formula" TEXT NOT NULL,
    "reasonTemplate" TEXT,
    "resultMode" "SavingsCalculatorResultMode" NOT NULL DEFAULT 'deposit',
    "negativeMode" "SavingsCalculatorNegativeMode" NOT NULL DEFAULT 'clamp_to_zero',
    "roundingMode" "SavingsCalculatorRoundingMode" NOT NULL DEFAULT 'cents',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsCalculator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsCalculatorField" (
    "id" TEXT NOT NULL,
    "calculatorId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "SavingsCalculatorFieldType" NOT NULL DEFAULT 'number',
    "defaultValue" DECIMAL(12,4),
    "helperText" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsCalculatorField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsCalculatorRun" (
    "id" TEXT NOT NULL,
    "calculatorId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "boxId" TEXT,
    "inputValues" JSONB NOT NULL,
    "rawResult" DECIMAL(12,4) NOT NULL,
    "resultAmount" DECIMAL(12,2) NOT NULL,
    "entryType" "SavingsEntryType" NOT NULL,
    "entryId" TEXT,
    "authorMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsCalculatorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Household_createdByUserId_idx" ON "Household"("createdByUserId");

-- CreateIndex
CREATE INDEX "HouseholdMember_householdId_idx" ON "HouseholdMember"("householdId");

-- CreateIndex
CREATE INDEX "HouseholdMember_userId_idx" ON "HouseholdMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdMember_householdId_userId_key" ON "HouseholdMember"("householdId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdInvite_token_key" ON "HouseholdInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdInvite_code_key" ON "HouseholdInvite"("code");

-- CreateIndex
CREATE INDEX "HouseholdInvite_householdId_createdAt_idx" ON "HouseholdInvite"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "HouseholdInvite_expiresAt_idx" ON "HouseholdInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "HouseholdIntegration_provider_isEnabled_idx" ON "HouseholdIntegration"("provider", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdIntegration_householdId_provider_key" ON "HouseholdIntegration"("householdId", "provider");

-- CreateIndex
CREATE INDEX "MemberAvailability_memberId_startDate_endDate_idx" ON "MemberAvailability"("memberId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTemplate_recurrenceRuleId_key" ON "TaskTemplate"("recurrenceRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTemplate_assignmentRuleId_key" ON "TaskTemplate"("assignmentRuleId");

-- CreateIndex
CREATE INDEX "TaskTemplate_householdId_idx" ON "TaskTemplate"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskOccurrence_sourceGenerationKey_key" ON "TaskOccurrence"("sourceGenerationKey");

-- CreateIndex
CREATE INDEX "TaskOccurrence_householdId_scheduledDate_idx" ON "TaskOccurrence"("householdId", "scheduledDate");

-- CreateIndex
CREATE INDEX "TaskOccurrence_householdId_status_scheduledDate_idx" ON "TaskOccurrence"("householdId", "status", "scheduledDate");

-- CreateIndex
CREATE INDEX "TaskOccurrence_householdId_assignedMemberId_scheduledDate_idx" ON "TaskOccurrence"("householdId", "assignedMemberId", "scheduledDate");

-- CreateIndex
CREATE INDEX "TaskOccurrence_assignedMemberId_scheduledDate_idx" ON "TaskOccurrence"("assignedMemberId", "scheduledDate");

-- CreateIndex
CREATE INDEX "TaskOccurrence_taskTemplateId_idx" ON "TaskOccurrence"("taskTemplateId");

-- CreateIndex
CREATE INDEX "HouseholdHoliday_householdId_startDate_idx" ON "HouseholdHoliday"("householdId", "startDate");

-- CreateIndex
CREATE INDEX "OccurrenceActionLog_occurrenceId_idx" ON "OccurrenceActionLog"("occurrenceId");

-- CreateIndex
CREATE INDEX "OccurrenceComment_occurrenceId_createdAt_idx" ON "OccurrenceComment"("occurrenceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_memberId_idx" ON "PushSubscription"("memberId");

-- CreateIndex
CREATE INDEX "SavingsBox_householdId_isArchived_sortOrder_idx" ON "SavingsBox"("householdId", "isArchived", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsAutoFillRule_boxId_key" ON "SavingsAutoFillRule"("boxId");

-- CreateIndex
CREATE INDEX "SavingsEntry_boxId_occurredOn_idx" ON "SavingsEntry"("boxId", "occurredOn");

-- CreateIndex
CREATE INDEX "SavingsEntry_householdId_occurredOn_idx" ON "SavingsEntry"("householdId", "occurredOn");

-- CreateIndex
CREATE INDEX "SavingsEntry_transferId_idx" ON "SavingsEntry"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsEntry_autoFillRuleId_autoFillKey_key" ON "SavingsEntry"("autoFillRuleId", "autoFillKey");

-- CreateIndex
CREATE INDEX "SavingsTransfer_householdId_occurredOn_idx" ON "SavingsTransfer"("householdId", "occurredOn");

-- CreateIndex
CREATE INDEX "SavingsTransfer_fromBoxId_idx" ON "SavingsTransfer"("fromBoxId");

-- CreateIndex
CREATE INDEX "SavingsTransfer_toBoxId_idx" ON "SavingsTransfer"("toBoxId");

-- CreateIndex
CREATE INDEX "SavingsCalculator_householdId_isArchived_sortOrder_idx" ON "SavingsCalculator"("householdId", "isArchived", "sortOrder");

-- CreateIndex
CREATE INDEX "SavingsCalculator_boxId_isArchived_sortOrder_idx" ON "SavingsCalculator"("boxId", "isArchived", "sortOrder");

-- CreateIndex
CREATE INDEX "SavingsCalculatorField_calculatorId_sortOrder_idx" ON "SavingsCalculatorField"("calculatorId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsCalculatorField_calculatorId_key_key" ON "SavingsCalculatorField"("calculatorId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsCalculatorRun_entryId_key" ON "SavingsCalculatorRun"("entryId");

-- CreateIndex
CREATE INDEX "SavingsCalculatorRun_calculatorId_createdAt_idx" ON "SavingsCalculatorRun"("calculatorId", "createdAt");

-- CreateIndex
CREATE INDEX "SavingsCalculatorRun_householdId_createdAt_idx" ON "SavingsCalculatorRun"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "SavingsCalculatorRun_boxId_createdAt_idx" ON "SavingsCalculatorRun"("boxId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackReport_status_createdAt_idx" ON "FeedbackReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackReport_reporterUserId_createdAt_idx" ON "FeedbackReport"("reporterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackReport_householdId_createdAt_idx" ON "FeedbackReport"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "UxEvent_event_createdAt_idx" ON "UxEvent"("event", "createdAt");

-- CreateIndex
CREATE INDEX "UxEvent_userId_createdAt_idx" ON "UxEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UxEvent_householdId_createdAt_idx" ON "UxEvent"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_action_createdAt_idx" ON "AdminAuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_actorUserId_createdAt_idx" ON "AdminAuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_householdId_createdAt_idx" ON "AdminAuditEvent"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "DataExportRequest_userId_createdAt_idx" ON "DataExportRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DataExportRequest_householdId_createdAt_idx" ON "DataExportRequest"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "DataExportRequest_status_createdAt_idx" ON "DataExportRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DeletionRequest_userId_createdAt_idx" ON "DeletionRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DeletionRequest_householdId_createdAt_idx" ON "DeletionRequest"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "DeletionRequest_status_createdAt_idx" ON "DeletionRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupporterContribution_userId_createdAt_idx" ON "SupporterContribution"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SupporterContribution_householdId_createdAt_idx" ON "SupporterContribution"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "SupporterContribution_provider_providerRef_idx" ON "SupporterContribution"("provider", "providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Plan_isActive_code_idx" ON "Plan"("isActive", "code");

-- CreateIndex
CREATE INDEX "BillingCustomer_userId_idx" ON "BillingCustomer"("userId");

-- CreateIndex
CREATE INDEX "BillingCustomer_householdId_idx" ON "BillingCustomer"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_provider_providerCustomerId_key" ON "BillingCustomer"("provider", "providerCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_householdId_status_idx" ON "Subscription"("householdId", "status");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_provider_providerSubscriptionId_key" ON "Subscription"("provider", "providerSubscriptionId");

-- CreateIndex
CREATE INDEX "FeatureEntitlement_feature_enabled_idx" ON "FeatureEntitlement"("feature", "enabled");

-- CreateIndex
CREATE INDEX "FeatureEntitlement_expiresAt_idx" ON "FeatureEntitlement"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureEntitlement_householdId_feature_key" ON "FeatureEntitlement"("householdId", "feature");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "HouseholdMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdIntegration" ADD CONSTRAINT "HouseholdIntegration_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAvailability" ADD CONSTRAINT "MemberAvailability_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HouseholdMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurrenceRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_assignmentRuleId_fkey" FOREIGN KEY ("assignmentRuleId") REFERENCES "AssignmentRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "HouseholdMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOccurrence" ADD CONSTRAINT "TaskOccurrence_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOccurrence" ADD CONSTRAINT "TaskOccurrence_taskTemplateId_fkey" FOREIGN KEY ("taskTemplateId") REFERENCES "TaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOccurrence" ADD CONSTRAINT "TaskOccurrence_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "HouseholdMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOccurrence" ADD CONSTRAINT "TaskOccurrence_completedByMemberId_fkey" FOREIGN KEY ("completedByMemberId") REFERENCES "HouseholdMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdHoliday" ADD CONSTRAINT "HouseholdHoliday_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceActionLog" ADD CONSTRAINT "OccurrenceActionLog_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "TaskOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceActionLog" ADD CONSTRAINT "OccurrenceActionLog_actorMemberId_fkey" FOREIGN KEY ("actorMemberId") REFERENCES "HouseholdMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceComment" ADD CONSTRAINT "OccurrenceComment_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "TaskOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceComment" ADD CONSTRAINT "OccurrenceComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "HouseholdMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HouseholdMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsBox" ADD CONSTRAINT "SavingsBox_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsAutoFillRule" ADD CONSTRAINT "SavingsAutoFillRule_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "SavingsBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsEntry" ADD CONSTRAINT "SavingsEntry_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "SavingsBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsEntry" ADD CONSTRAINT "SavingsEntry_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "SavingsTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsTransfer" ADD CONSTRAINT "SavingsTransfer_fromBoxId_fkey" FOREIGN KEY ("fromBoxId") REFERENCES "SavingsBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsTransfer" ADD CONSTRAINT "SavingsTransfer_toBoxId_fkey" FOREIGN KEY ("toBoxId") REFERENCES "SavingsBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsCalculator" ADD CONSTRAINT "SavingsCalculator_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsCalculator" ADD CONSTRAINT "SavingsCalculator_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "SavingsBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsCalculatorField" ADD CONSTRAINT "SavingsCalculatorField_calculatorId_fkey" FOREIGN KEY ("calculatorId") REFERENCES "SavingsCalculator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsCalculatorRun" ADD CONSTRAINT "SavingsCalculatorRun_calculatorId_fkey" FOREIGN KEY ("calculatorId") REFERENCES "SavingsCalculator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsCalculatorRun" ADD CONSTRAINT "SavingsCalculatorRun_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "SavingsBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsCalculatorRun" ADD CONSTRAINT "SavingsCalculatorRun_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "SavingsEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UxEvent" ADD CONSTRAINT "UxEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UxEvent" ADD CONSTRAINT "UxEvent_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditEvent" ADD CONSTRAINT "AdminAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditEvent" ADD CONSTRAINT "AdminAuditEvent_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportRequest" ADD CONSTRAINT "DataExportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportRequest" ADD CONSTRAINT "DataExportRequest_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupporterContribution" ADD CONSTRAINT "SupporterContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupporterContribution" ADD CONSTRAINT "SupporterContribution_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCustomer" ADD CONSTRAINT "BillingCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCustomer" ADD CONSTRAINT "BillingCustomer_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureEntitlement" ADD CONSTRAINT "FeatureEntitlement_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

