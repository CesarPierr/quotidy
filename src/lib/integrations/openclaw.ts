import "server-only";

import { startOfDay } from "date-fns";
import type { OccurrenceStatus } from "@prisma/client";

import { db } from "@/lib/db";
import {
  createIntegrationApiKey,
  getIntegrationKeyPreview,
  hashIntegrationApiKey,
  OPENCLAW_PROVIDER,
} from "@/lib/integrations/auth";
import {
  integrationSettingsSchema,
  integrationTaskDefinitionSchema,
  integrationTaskPatchSchema,
} from "@/lib/integrations/validation";
import { resolveAppUrl } from "@/lib/request";
import { syncHouseholdOccurrences } from "@/lib/scheduling/service";

import {
  cleanOptionalText,
  hasSingleRunConfig,
  normalizeAssignmentMembers,
  nullableString,
  parseNumberArray,
  parseStringArray,
  serializeOccurrence,
  serializeTask,
  toOpenClawIntegrationSettingsSnapshot,
} from "@/lib/integrations/openclaw-mappers";

async function getActiveHouseholdMembers(householdId: string) {
  return db.householdMember.findMany({
    where: {
      householdId,
      isActive: true,
    },
    select: {
      id: true,
      displayName: true,
      color: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

async function getTaskForUpdate(taskId: string, householdId: string) {
  return db.taskTemplate.findFirst({
    where: {
      id: taskId,
      householdId,
    },
    include: {
      recurrenceRule: true,
      assignmentRule: true,
    },
  });
}



export async function listOpenClawTasks(householdId: string, options?: { includeInactive?: boolean }) {
  const tasks = await db.taskTemplate.findMany({
    where: {
      householdId,
      ...(options?.includeInactive ? {} : { isActive: true }),
    },
    include: {
      recurrenceRule: true,
      assignmentRule: true,
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return tasks.map(serializeTask);
}

export async function listOpenClawUpcoming(params: {
  householdId: string;
  memberId?: string;
  limit: number;
  includeCompleted?: boolean;
}) {
  const openStatuses: OccurrenceStatus[] = ["planned", "due", "overdue", "rescheduled"];

  const occurrences = await db.taskOccurrence.findMany({
    where: {
      householdId: params.householdId,
      ...(params.memberId ? { assignedMemberId: params.memberId } : {}),
      ...(params.includeCompleted ? {} : { status: { in: openStatuses } }),
    },
    include: {
      taskTemplate: {
        select: {
          title: true,
          color: true,
          estimatedMinutes: true,
        },
      },
      assignedMember: {
        select: {
          id: true,
          displayName: true,
          color: true,
        },
      },
    },
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
    take: params.limit,
  });

  return occurrences.map((occurrence) => serializeOccurrence(occurrence));
}

export async function createOpenClawTask(input: unknown) {
  const parsed = integrationTaskDefinitionSchema.parse(input);
  const activeMembers = await getActiveHouseholdMembers(parsed.householdId);
  const normalizedAssignment = normalizeAssignmentMembers({
    activeMembers,
    eligibleMemberIds: parsed.assignment.eligibleMemberIds,
    rotationOrder: parsed.assignment.rotationOrder,
  });
  const fixedMemberId =
    parsed.assignment.mode === "fixed"
      ? parsed.assignment.fixedMemberId ?? normalizedAssignment.eligibleMemberIds[0]
      : null;

  const createdTask = await db.$transaction(async (tx) => {
    const recurrenceRule = await tx.recurrenceRule.create({
      data: {
        type: parsed.recurrence.type,
        interval: parsed.recurrence.oneTime ? 1 : parsed.recurrence.interval,
        weekdays: parsed.recurrence.weekdays,
        dayOfMonth: parsed.recurrence.dayOfMonth,
        anchorDate: parsed.recurrence.anchorDate ?? parsed.startsOn,
        dueOffsetDays: parsed.recurrence.dueOffsetDays,
        config: parsed.recurrence.oneTime ? { singleRun: true } : undefined,
      },
    });

    const assignmentRule = await tx.assignmentRule.create({
      data: {
        mode: parsed.assignment.mode,
        eligibleMemberIds: normalizedAssignment.eligibleMemberIds,
        fixedMemberId,
        rotationOrder: normalizedAssignment.rotationOrder,
        fairnessWindowDays: parsed.assignment.fairnessWindowDays,
        rebalanceOnMemberAbsence: parsed.assignment.rebalanceOnMemberAbsence,
        lockAssigneeAfterGeneration: parsed.assignment.lockAssigneeAfterGeneration,
      },
    });

    await tx.taskTemplate.create({
      data: {
        householdId: parsed.householdId,
        title: parsed.title,
        description: nullableString(parsed.description),
        category: nullableString(parsed.category),
        room: nullableString(parsed.room),
        color: parsed.color,
        estimatedMinutes: parsed.estimatedMinutes,
        priority: 2,
        startsOn: parsed.startsOn,
        endsOn: parsed.recurrence.oneTime ? parsed.startsOn : null,
        recurrenceRuleId: recurrenceRule.id,
        assignmentRuleId: assignmentRule.id,
      },
    });

    return tx.taskTemplate.findFirstOrThrow({
      where: {
        householdId: parsed.householdId,
        recurrenceRuleId: recurrenceRule.id,
      },
      include: {
        recurrenceRule: true,
        assignmentRule: true,
      },
    });
  });

  await syncHouseholdOccurrences(parsed.householdId);

  return serializeTask(createdTask);
}

export async function updateOpenClawTask(taskId: string, householdId: string, patchInput: unknown) {
  const patch = integrationTaskPatchSchema.parse(patchInput);
  const existingTask = await getTaskForUpdate(taskId, householdId);

  if (!existingTask) {
    return null;
  }

  const activeMembers = await getActiveHouseholdMembers(householdId);
  const nextStartsOn = patch.startsOn ?? existingTask.startsOn;
  const nextAssignmentMode = patch.assignment?.mode ?? existingTask.assignmentRule.mode;
  const normalizedAssignment = normalizeAssignmentMembers({
    activeMembers,
    eligibleMemberIds: patch.assignment?.eligibleMemberIds ?? parseStringArray(existingTask.assignmentRule.eligibleMemberIds),
    rotationOrder: patch.assignment?.rotationOrder ?? parseStringArray(existingTask.assignmentRule.rotationOrder),
  });
  const nextFixedMemberId =
    nextAssignmentMode === "fixed"
      ? patch.assignment?.fixedMemberId ?? existingTask.assignmentRule.fixedMemberId ?? normalizedAssignment.eligibleMemberIds[0]
      : null;
  const nextEligibleMemberIds = normalizedAssignment.eligibleMemberIds;
  const nextRotationOrder = normalizedAssignment.rotationOrder;

  const nextTask = integrationTaskDefinitionSchema.parse({
    householdId,
    title: patch.title ?? existingTask.title,
    description:
      patch.description === null ? undefined : patch.description ?? cleanOptionalText(existingTask.description),
    category: patch.category === null ? undefined : patch.category ?? cleanOptionalText(existingTask.category),
    room: patch.room === null ? undefined : patch.room ?? cleanOptionalText(existingTask.room),
    color: patch.color ?? existingTask.color,
    estimatedMinutes: patch.estimatedMinutes ?? existingTask.estimatedMinutes,
    startsOn: nextStartsOn,
    recurrence: {
      type: patch.recurrence?.type ?? existingTask.recurrenceRule.type,
      interval: patch.recurrence?.interval ?? existingTask.recurrenceRule.interval,
      weekdays: patch.recurrence?.weekdays ?? parseNumberArray(existingTask.recurrenceRule.weekdays),
      dayOfMonth:
        patch.recurrence?.dayOfMonth === null
          ? undefined
          : patch.recurrence?.dayOfMonth ?? existingTask.recurrenceRule.dayOfMonth ?? undefined,
      anchorDate: patch.recurrence?.anchorDate ?? nextStartsOn,
        dueOffsetDays: patch.recurrence?.dueOffsetDays ?? existingTask.recurrenceRule.dueOffsetDays,
        oneTime: patch.recurrence?.oneTime ?? hasSingleRunConfig(existingTask.recurrenceRule.config),
      },
    assignment: {
      mode: nextAssignmentMode,
      eligibleMemberIds: nextEligibleMemberIds,
      fixedMemberId: nextFixedMemberId ?? undefined,
      rotationOrder: nextRotationOrder,
      fairnessWindowDays:
        patch.assignment?.fairnessWindowDays ?? existingTask.assignmentRule.fairnessWindowDays ?? 14,
      rebalanceOnMemberAbsence:
        patch.assignment?.rebalanceOnMemberAbsence ?? existingTask.assignmentRule.rebalanceOnMemberAbsence,
      lockAssigneeAfterGeneration:
        patch.assignment?.lockAssigneeAfterGeneration ?? existingTask.assignmentRule.lockAssigneeAfterGeneration,
    },
  });

  await db.$transaction(async (tx) => {
    await tx.recurrenceRule.update({
      where: {
        id: existingTask.recurrenceRuleId,
      },
      data: {
        type: nextTask.recurrence.type,
        interval: nextTask.recurrence.oneTime ? 1 : nextTask.recurrence.interval,
        weekdays: nextTask.recurrence.weekdays,
        dayOfMonth: nextTask.recurrence.dayOfMonth ?? null,
        anchorDate: nextTask.recurrence.anchorDate ?? nextTask.startsOn,
        dueOffsetDays: nextTask.recurrence.dueOffsetDays,
        config: nextTask.recurrence.oneTime ? { singleRun: true } : undefined,
      },
    });

    await tx.assignmentRule.update({
      where: {
        id: existingTask.assignmentRuleId,
      },
      data: {
        mode: nextTask.assignment.mode,
        eligibleMemberIds: nextEligibleMemberIds,
        fixedMemberId:
          nextTask.assignment.mode === "fixed"
            ? nextTask.assignment.fixedMemberId ?? nextEligibleMemberIds[0]
            : null,
        rotationOrder: nextTask.assignment.rotationOrder ?? nextRotationOrder,
        fairnessWindowDays: nextTask.assignment.fairnessWindowDays,
        rebalanceOnMemberAbsence: nextTask.assignment.rebalanceOnMemberAbsence,
        lockAssigneeAfterGeneration: nextTask.assignment.lockAssigneeAfterGeneration,
      },
    });

    await tx.taskTemplate.update({
      where: {
        id: taskId,
      },
      data: {
        title: nextTask.title,
        description: nullableString(nextTask.description),
        category: nullableString(nextTask.category),
        room: nullableString(nextTask.room),
        color: nextTask.color,
        estimatedMinutes: nextTask.estimatedMinutes,
        startsOn: nextTask.startsOn,
        endsOn: nextTask.recurrence.oneTime ? nextTask.startsOn : null,
      },
    });
  });

  await syncHouseholdOccurrences(householdId, {
    taskId,
    forceOverwriteManual: patch.forceOverwriteManual,
  });

  const updatedTask = await getTaskForUpdate(taskId, householdId);

  return updatedTask ? serializeTask(updatedTask) : null;
}

export async function deleteOpenClawTask(params: {
  taskId: string;
  householdId: string;
  deleteManual?: boolean;
}) {
  const task = await db.taskTemplate.findFirst({
    where: {
      id: params.taskId,
      householdId: params.householdId,
    },
  });

  if (!task) {
    return null;
  }

  await db.taskTemplate.update({
    where: {
      id: params.taskId,
    },
    data: {
      isActive: false,
    },
  });

  const occurrenceConditions: {
    taskTemplateId: string;
    status: { in: ["planned", "due", "overdue", "rescheduled"] };
    scheduledDate: { gte: Date };
    isManuallyModified?: boolean;
  } = {
    taskTemplateId: params.taskId,
    status: {
      in: ["planned", "due", "overdue", "rescheduled"],
    },
    scheduledDate: {
      gte: startOfDay(new Date()),
    },
  };

  if (!params.deleteManual) {
    occurrenceConditions.isManuallyModified = false;
  }

  const result = await db.taskOccurrence.updateMany({
    where: occurrenceConditions,
    data: {
      status: "cancelled",
    },
  });

  return {
    id: params.taskId,
    cancelledOccurrences: result.count,
    keptManualOccurrences: !params.deleteManual,
  };
}

export async function rebalanceOpenClawHousehold(params: {
  householdId: string;
  taskId?: string;
  forceOverwriteManual?: boolean;
  preserveRotationOnSkipOverride?: boolean;
}) {
  await syncHouseholdOccurrences(params.householdId, {
    taskId: params.taskId,
    forceOverwriteManual: params.forceOverwriteManual,
    preserveRotationOnSkipOverride: params.preserveRotationOnSkipOverride ?? null,
  });

  return {
    householdId: params.householdId,
    taskId: params.taskId ?? null,
    forceOverwriteManual: Boolean(params.forceOverwriteManual),
  };
}



export async function getOpenClawIntegrationSettings(householdId: string) {
  const integration = await db.householdIntegration.findUnique({
    where: {
      householdId_provider: {
        householdId,
        provider: OPENCLAW_PROVIDER,
      },
    },
  });

  return toOpenClawIntegrationSettingsSnapshot(integration, householdId);
}

export async function upsertOpenClawIntegrationSettings(input: unknown) {
  const parsed = integrationSettingsSchema.parse(input);
  const existing = await db.householdIntegration.findUnique({
    where: {
      householdId_provider: {
        householdId: parsed.householdId,
        provider: OPENCLAW_PROVIDER,
      },
    },
  });
  const shouldGenerateKey = parsed.regenerateKey || !existing?.apiKeyHash;
  const newApiKey = shouldGenerateKey ? createIntegrationApiKey() : null;

  const integration = await db.householdIntegration.upsert({
    where: {
      householdId_provider: {
        householdId: parsed.householdId,
        provider: OPENCLAW_PROVIDER,
      },
    },
    create: {
      householdId: parsed.householdId,
      provider: OPENCLAW_PROVIDER,
      isEnabled: parsed.isEnabled,
      serverUrl: nullableString(parsed.serverUrl || undefined),
      clientLabel: nullableString(parsed.clientLabel || undefined),
      ...(newApiKey
        ? {
            apiKeyHash: hashIntegrationApiKey(newApiKey),
            apiKeyPreview: getIntegrationKeyPreview(newApiKey),
          }
        : {}),
      config: {
        protocol: "mcp-http-json",
      },
    },
    update: {
      isEnabled: parsed.isEnabled,
      serverUrl: nullableString(parsed.serverUrl || undefined),
      clientLabel: nullableString(parsed.clientLabel || undefined),
      ...(newApiKey
        ? {
            apiKeyHash: hashIntegrationApiKey(newApiKey),
            apiKeyPreview: getIntegrationKeyPreview(newApiKey),
          }
        : {}),
      config: {
        protocol: "mcp-http-json",
      },
    },
  });

  const snapshot = toOpenClawIntegrationSettingsSnapshot(integration, parsed.householdId);

  return {
    integration: {
      ...snapshot,
      householdId: parsed.householdId,
    },
    apiKey: newApiKey,
  };
}

export async function disableOpenClawIntegration(householdId: string) {
  const integration = await db.householdIntegration.upsert({
    where: {
      householdId_provider: {
        householdId,
        provider: OPENCLAW_PROVIDER,
      },
    },
    create: {
      householdId,
      provider: OPENCLAW_PROVIDER,
      isEnabled: false,
      config: {
        protocol: "mcp-http-json",
      },
    },
    update: {
      isEnabled: false,
    },
  });

  return toOpenClawIntegrationSettingsSnapshot(integration, householdId);
}

export async function buildOpenClawDiscovery(request: Request, householdId: string) {
  const household = await db.household.findUnique({
    where: {
      id: householdId,
    },
    select: {
      id: true,
      name: true,
      timezone: true,
    },
  });

  if (!household) {
    return null;
  }

  const tasksUrl = resolveAppUrl(request, "/api/integrations/mcp/openclaw/tasks");
  tasksUrl.searchParams.set("householdId", householdId);

  const upcomingUrl = resolveAppUrl(request, "/api/integrations/mcp/openclaw/upcoming");
  upcomingUrl.searchParams.set("householdId", householdId);

  const rebalanceUrl = resolveAppUrl(request, "/api/integrations/mcp/openclaw/rebalance");
  rebalanceUrl.searchParams.set("householdId", householdId);

  const discoveryUrl = resolveAppUrl(request, "/api/integrations/mcp/openclaw/discovery");
  discoveryUrl.searchParams.set("householdId", householdId);

  const householdIdQuery = encodeURIComponent(householdId);
  const updateTaskTemplateUrl = `${resolveAppUrl(request, "/api/integrations/mcp/openclaw/tasks").toString()}/{taskId}?householdId=${householdIdQuery}`;

  return {
    provider: "mcp_openclaw",
    version: 1,
    household,
    auth: {
      type: "api_key",
      keyHeader: "x-quotidy-key",
      householdHeader: "x-quotidy-household",
      authorizationHeader: "Authorization: Bearer <key>",
    },
    endpoints: {
      discovery: {
        method: "GET",
        url: discoveryUrl.toString(),
      },
      listTasks: {
        method: "GET",
        url: tasksUrl.toString(),
      },
      addTask: {
        method: "POST",
        url: tasksUrl.toString(),
      },
      updateTask: {
        method: "PATCH",
        urlTemplate: updateTaskTemplateUrl,
      },
      deleteTask: {
        method: "DELETE",
        urlTemplate: updateTaskTemplateUrl,
      },
      listUpcoming: {
        method: "GET",
        url: upcomingUrl.toString(),
      },
      rebalance: {
        method: "POST",
        url: rebalanceUrl.toString(),
      },
    },
    mcpReady: {
      transport: "http-json",
      tools: [
        {
          name: "listTasks",
          description: "List active recurring task templates for the household.",
        },
        {
          name: "addTask",
          description: "Create a new recurring task and regenerate future occurrences.",
        },
        {
          name: "updateTask",
          description: "Patch an existing recurring task and optionally overwrite manual future changes.",
        },
        {
          name: "deleteTask",
          description: "Disable a recurring task and cancel future occurrences.",
        },
        {
          name: "listUpcoming",
          description: "List upcoming household occurrences and reminders.",
        },
        {
          name: "rebalance",
          description: "Regenerate and rebalance future occurrences for the household or one task.",
        },
      ],
    },
  };
}
