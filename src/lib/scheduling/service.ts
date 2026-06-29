import "server-only";

import { addDays, differenceInDays, endOfDay, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { generateOccurrences } from "@/lib/scheduling/generator";
import { buildGenerationKey, computeDueDate, computeNextAnchorAfter, getStableSequenceIndex } from "@/lib/scheduling/recurrence";
import { logWarn } from "@/lib/logger";
import type { TaskTemplateInput } from "@/lib/scheduling/types";
import { getGenerationWindow, isPastDay, isToday } from "@/lib/time";

import {
  mapAbsences,
  mapAssignmentRule,
  mapExistingOccurrences,
  mapMembers,
  mapRecurrenceRule,
  parseNumberArray,
  parseStringArray,
} from "@/lib/scheduling/mappers";

export async function syncHouseholdOccurrences(
  householdId: string,
  options?: {
    taskId?: string;
    forceOverwriteManual?: boolean;
    preserveRotationOnSkipOverride?: boolean | null;
  },
) {
  const household = await db.household.findUnique({
    where: {
      id: householdId,
    },
    include: {
      members: {
        include: {
          availabilities: true,
        },
      },
      tasks: {
        where: {
          isActive: true,
          ...(options?.taskId ? { id: options.taskId } : {}),
        },
        include: {
          recurrenceRule: true,
          assignmentRule: true,
          occurrences: {
            where: {
              scheduledDate: {
                gte: addDays(startOfDay(new Date()), -45),
                lte: addDays(endOfDay(new Date()), 60),
              },
            },
          },
        },
      },
    },
  });

  if (!household) {
    return;
  }

  const { start, end } = getGenerationWindow();
  const members = mapMembers(household.members);
  const absences = mapAbsences(household.members);

  for (const task of household.tasks) {
    const template: TaskTemplateInput = {
      id: task.id,
      householdId: task.householdId,
      title: task.title,
      estimatedMinutes: task.estimatedMinutes,
      startsOn: task.startsOn,
      endsOn: task.endsOn,
      lastCompletedAt: task.lastCompletedAt,
      recurrence: mapRecurrenceRule(task.recurrenceRule),
      assignment: mapAssignmentRule(task.assignmentRule, {
        preserveRotationOnSkip: options?.preserveRotationOnSkipOverride ?? null,
      }),
    };

    const existingOccurrences = mapExistingOccurrences(task.occurrences);
    const generated = generateOccurrences({
      template,
      members,
      absences,
      existingOccurrences,
      rangeStart: start,
      rangeEnd: end,
    });

    const generatedKeys = new Set(generated.map((occurrence) => occurrence.sourceGenerationKey));
    const isSlidingTask = task.recurrenceRule?.mode === "SLIDING";
    // Rows already bound to a generated slot this run, so two generated entries
    // can't claim the same row and the slot fallback below can't double-bind.
    const consumedIds = new Set<string>();
    const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

    for (const occurrence of generated) {
      let existing = task.occurrences.find(
        (item) => item.sourceGenerationKey === occurrence.sourceGenerationKey && !consumedIds.has(item.id),
      );

      // SLIDING idempotence: the `:sliding:<index>` key is recomputed from a moving
      // base (the latest locked occurrence), so an exact-key miss can still be the
      // SAME calendar slot. Without this, the slot is re-created (a duplicate) and
      // the prior row is orphan-cancelled below — the dishwasher-task bug.
      if (!existing && isSlidingTask) {
        // A terminal/manual occurrence already owns this slot — never duplicate it.
        const lockedOnSlot = task.occurrences.find(
          (item) =>
            !consumedIds.has(item.id) &&
            sameDay(item.scheduledDate, occurrence.scheduledDate) &&
            (item.isManuallyModified ||
              ["completed", "skipped", "rescheduled"].includes(item.status)),
        );
        if (lockedOnSlot) {
          continue;
        }
        // Re-bind a stale-keyed non-terminal row to this slot (its key re-converges
        // in the update branch below, so the orphan-cancel no longer cancels it).
        existing = task.occurrences.find(
          (item) =>
            !consumedIds.has(item.id) &&
            sameDay(item.scheduledDate, occurrence.scheduledDate) &&
            ["planned", "due", "overdue"].includes(item.status) &&
            !item.isManuallyModified,
        );
      }

      if (!existing) {
        const created = await db.taskOccurrence.create({
          data: {
            householdId,
            taskTemplateId: task.id,
            scheduledDate: occurrence.scheduledDate,
            dueDate: occurrence.dueDate,
            assignedMemberId: occurrence.assignedMemberId,
            status: occurrence.status,
            sourceGenerationKey: occurrence.sourceGenerationKey,
            originalScheduledDate: occurrence.scheduledDate,
          },
        });

        await db.occurrenceActionLog.create({
          data: {
            occurrenceId: created.id,
            actionType: "created",
            newValues: {
              scheduledDate: occurrence.scheduledDate.toISOString(),
              assignedMemberId: occurrence.assignedMemberId,
            },
          },
        });

        continue;
      }

      consumedIds.add(existing.id);

      const isPastOrDone = ["completed", "skipped"].includes(existing.status);
      const isSliding = task.recurrenceRule?.mode === "SLIDING";
      const isRescheduled = existing.status === "rescheduled";
      const isProtected = (existing.isManuallyModified || (isRescheduled && !isSliding)) && !options?.forceOverwriteManual;

      if (isPastOrDone) {
        continue;
      }

      const statusChanged = existing.status !== occurrence.status;
      // A re-bound slot (fallback above) carries a stale key; re-converge it so the
      // orphan-cancel below keeps the row instead of cancelling it.
      const keyChanged = existing.sourceGenerationKey !== occurrence.sourceGenerationKey;
      const otherFieldsChanged =
        existing.assignedMemberId !== occurrence.assignedMemberId ||
        existing.scheduledDate.getTime() !== occurrence.scheduledDate.getTime();

      if (isProtected) {
        // Even for protected (manual) occurrences, we MUST allow the status to transition
        // to 'due' or 'overdue' as time passes. We just don't touch dates or assignees.
        const shouldUpdateStatus = 
          (occurrence.status === "overdue" && existing.status !== "overdue") ||
          (occurrence.status === "due" && existing.status === "planned");

        if (shouldUpdateStatus) {
          await db.taskOccurrence.update({
            where: { id: existing.id },
            data: { status: occurrence.status },
          });
        }
        continue;
      }

      if (
        otherFieldsChanged ||
        statusChanged ||
        keyChanged ||
        (existing.isManuallyModified && options?.forceOverwriteManual)
      ) {
        await db.taskOccurrence.update({
          where: { id: existing.id },
          data: {
            scheduledDate: occurrence.scheduledDate,
            dueDate: occurrence.dueDate,
            assignedMemberId: occurrence.assignedMemberId,
            status: occurrence.status,
            sourceGenerationKey: occurrence.sourceGenerationKey,
            ...(options?.forceOverwriteManual ? { isManuallyModified: false } : {}),
          },
        });
      }
    }

    // NEW: Orphan cancellation - cancel planned/due/overdue occurrences that are no longer generated
    // and haven't been manually modified or completed.
    const generatedKeysArray = Array.from(generatedKeys);
    await db.taskOccurrence.updateMany({
      where: {
        taskTemplateId: task.id,
        status: { in: ["planned", "due", "overdue"] },
        sourceGenerationKey: { notIn: generatedKeysArray },
        isManuallyModified: false,
        scheduledDate: { gte: start, lte: end },
      },
      data: { status: "cancelled" },
    });
  }
}

/**
 * For each task with an overdue occurrence, push the recurrence anchor forward to "interval
 * units after today" and let the next sync regenerate future occurrences. Each day the late
 * task remains undone, the next ones drift forward by a day — matching what an actual
 * completion would do on that day.
 *
 * Idempotent: if the next planned occurrence is already at or beyond the projected anchor,
 * the rule is left alone.
 */
export async function realignOverdueRecurrences(householdId: string) {
  const today = startOfDay(new Date());

  const tasks = await db.taskTemplate.findMany({
    where: {
      householdId,
      isActive: true,
      occurrences: { some: { status: "overdue" } },
    },
    include: { recurrenceRule: true },
  });

  let anyChange = false;

  for (const task of tasks) {
    if (!task.recurrenceRule) continue;

    const latestOverdue = await db.taskOccurrence.findFirst({
      where: { taskTemplateId: task.id, status: "overdue" },
      orderBy: { scheduledDate: "desc" },
      select: { scheduledDate: true },
    });
    if (!latestOverdue) continue;

    const nextOccurrence = await db.taskOccurrence.findFirst({
      where: {
        taskTemplateId: task.id,
        status: { in: ["planned", "due"] },
        scheduledDate: { gt: latestOverdue.scheduledDate },
      },
      orderBy: { scheduledDate: "asc" },
      select: { scheduledDate: true },
    });
    if (!nextOccurrence) continue;

    const rule = task.recurrenceRule;
    const delayDeltaDays = differenceInDays(today, startOfDay(latestOverdue.scheduledDate));
    
    if (delayDeltaDays <= 0) continue;

    const newAnchor = addDays(startOfDay(rule.anchorDate), delayDeltaDays);

    await db.recurrenceRule.update({
      where: { id: rule.id },
      data: { anchorDate: newAnchor },
    });
    anyChange = true;
  }

  if (anyChange) {
    await syncHouseholdOccurrences(householdId);
  }
}

export async function addMemberToExistingAssignments(params: {
  householdId: string;
  memberId: string;
}) {
  const tasks = await db.taskTemplate.findMany({
    where: {
      householdId: params.householdId,
      isActive: true,
    },
    include: {
      assignmentRule: true,
    },
  });

  for (const task of tasks) {
    if (task.assignmentRule.mode === "fixed" || task.assignmentRule.mode === "manual") {
      continue;
    }

    const eligibleMemberIds = parseStringArray(task.assignmentRule.eligibleMemberIds);

    if (eligibleMemberIds.includes(params.memberId)) {
      continue;
    }

    const rotationOrder = parseStringArray(task.assignmentRule.rotationOrder);
    const nextEligibleMemberIds = [...eligibleMemberIds, params.memberId];
    const nextRotationOrder = rotationOrder.length
      ? [...rotationOrder.filter((memberId) => memberId !== params.memberId), params.memberId]
      : nextEligibleMemberIds;

    await db.assignmentRule.update({
      where: {
        id: task.assignmentRuleId,
      },
      data: {
        eligibleMemberIds: nextEligibleMemberIds,
        rotationOrder: nextRotationOrder,
      },
    });
  }

  await syncHouseholdOccurrences(params.householdId);
}

export async function completeOccurrence(params: {
  occurrenceId: string;
  actorMemberId?: string | null;
  actualMinutes?: number;
  notes?: string;
  wasCompletedAlone?: boolean;
}) {
  const existing = await db.taskOccurrence.findUnique({
    where: {
      id: params.occurrenceId,
    },
    include: {
      taskTemplate: {
        include: {
          recurrenceRule: true,
        },
      },
    },
  });

  if (!existing) {
    return;
  }

  // Idempotent replay guard: an offline "complete" gets re-sent on reconnect. If
  // it's already completed and the replay carries no new details, no-op — otherwise
  // we'd append a duplicate action log and re-realign the recurrence anchor.
  if (
    existing.status === "completed" &&
    params.actualMinutes == null &&
    params.notes == null &&
    !params.wasCompletedAlone
  ) {
    return;
  }

  const isSliding = existing.taskTemplate?.recurrenceRule?.mode === "SLIDING";
  const completedAt = existing.completedAt ?? new Date();

  const occurrence = await db.taskOccurrence.update({
    where: {
      id: params.occurrenceId,
    },
    data: {
      status: "completed",
      completedAt,
      completedByMemberId: params.actorMemberId ?? existing.completedByMemberId ?? undefined,
      actualMinutes: params.actualMinutes ?? existing.actualMinutes,
      notes: params.notes ?? existing.notes,
      wasCompletedAlone: params.wasCompletedAlone ?? existing.wasCompletedAlone,
      isManuallyModified: true,
      ...(isSliding
        ? {
            scheduledDate: completedAt,
            dueDate: computeDueDate(
              completedAt,
              existing.taskTemplate?.recurrenceRule?.dueOffsetDays ?? 0,
            ),
          }
        : {}),
    },
  });

  // Update lastCompletedAt on the template
  await db.taskTemplate.update({
    where: { id: existing.taskTemplateId },
    data: { lastCompletedAt: occurrence.completedAt },
  });

  await db.occurrenceActionLog.create({
    data: {
      occurrenceId: occurrence.id,
      actionType: "completed",
      actorMemberId: params.actorMemberId ?? undefined,
      previousValues: {
        status: existing.status,
        scheduledDate: existing.scheduledDate.toISOString(),
        actualMinutes: existing.actualMinutes,
        notes: existing.notes,
      },
      newValues: {
        actualMinutes: params.actualMinutes ?? existing.actualMinutes,
        notes: params.notes ?? existing.notes,
        wasCompletedAlone: params.wasCompletedAlone ?? existing.wasCompletedAlone,
      },
    },
  });

  // Future occurrences always realign from the actual completion date so the recurrence
  // resumes "interval units from now" — early or late, the cadence remains stable.
  const today = startOfDay(new Date());

  if (existing.taskTemplate) {
    const ruleRecord = await db.recurrenceRule.findUnique({
      where: { id: existing.taskTemplate.recurrenceRuleId },
    });

    if (ruleRecord) {
      // ONLY for FIXED mode tasks, we manually realign the anchor.
      // SLIDING mode tasks rely on the generator to look at lastCompletedAt.
      if (ruleRecord.mode === "FIXED") {
        const nextAnchor = computeNextAnchorAfter(
          {
            type: ruleRecord.type,
            mode: "FIXED",
            interval: ruleRecord.interval,
            weekdays: parseNumberArray(ruleRecord.weekdays),
            dayOfMonth: ruleRecord.dayOfMonth,
            anchorDate: ruleRecord.anchorDate,
            dueOffsetDays: ruleRecord.dueOffsetDays,
            config: ruleRecord.config,
          },
          today,
        );

        await db.recurrenceRule.update({
          where: { id: existing.taskTemplate.recurrenceRuleId },
          data: { anchorDate: nextAnchor },
        });

        await db.taskOccurrence.updateMany({
          where: {
            taskTemplateId: existing.taskTemplate.id,
            status: { in: ["planned", "due", "overdue"] },
            scheduledDate: { gt: existing.scheduledDate },
          },
          data: { status: "cancelled" },
        });
      }

      // Sync is best-effort: completion is already committed above.
      await syncHouseholdOccurrences(existing.householdId, {
        taskId: existing.taskTemplate.id,
        forceOverwriteManual: false,
      }).catch((err) => {
        logWarn("completeOccurrence.sync_failed", { error: err instanceof Error ? err.message : String(err) });
      });
    }
  }
}

export async function skipOccurrence(params: {
  occurrenceId: string;
  actorMemberId?: string | null;
  notes?: string;
}) {
  const existing = await db.taskOccurrence.findUnique({
    where: {
      id: params.occurrenceId,
    },
    include: {
      taskTemplate: {
        include: {
          recurrenceRule: true,
        },
      },
    },
  });

  if (!existing) {
    return;
  }

  const isSliding = existing.taskTemplate?.recurrenceRule?.mode === "SLIDING";
  const today = startOfDay(new Date());

  // For SLIDING tasks, skipping an occurrence moves the anchor to today
  // so the next one appears in "interval" days.
  const occurrence = await db.taskOccurrence.update({
    where: {
      id: params.occurrenceId,
    },
    data: {
      status: "skipped",
      completedAt: null,
      completedByMemberId: null,
      actualMinutes: null,
      notes: params.notes ?? existing.notes,
      isManuallyModified: true,
      ...(isSliding
        ? {
            scheduledDate: today,
            dueDate: computeDueDate(
              today,
              existing.taskTemplate?.recurrenceRule?.dueOffsetDays ?? 0,
            ),
          }
        : {}),
    },
  });

  await db.occurrenceActionLog.create({
    data: {
      occurrenceId: occurrence.id,
      actionType: "skipped",
      actorMemberId: params.actorMemberId ?? undefined,
      previousValues: {
        status: existing.status,
        actualMinutes: existing.actualMinutes,
        notes: existing.notes,
      },
      newValues: {
        notes: params.notes ?? existing.notes,
      },
    },
  });
}

export async function rescheduleOccurrence(params: {
  occurrenceId: string;
  actorMemberId?: string | null;
  scheduledDate: Date;
  notes?: string;
}) {
  const existing = await db.taskOccurrence.findUnique({
    where: {
      id: params.occurrenceId,
    },
    include: {
      taskTemplate: {
        include: {
          recurrenceRule: true,
        },
      },
    },
  });

  if (!existing) {
    return;
  }

  const dueDate = endOfDay(params.scheduledDate);
  const occurrence = await db.taskOccurrence.update({
    where: {
      id: params.occurrenceId,
    },
    data: {
      scheduledDate: params.scheduledDate,
      dueDate,
      status: "rescheduled",
      notes: params.notes ?? existing.notes,
      isManuallyModified: true,
      rescheduleCount: { increment: 1 },
    },
  });

  await db.occurrenceActionLog.create({
    data: {
      occurrenceId: occurrence.id,
      actionType: "rescheduled",
      actorMemberId: params.actorMemberId ?? undefined,
      previousValues: {
        scheduledDate: existing.scheduledDate.toISOString(),
        notes: existing.notes,
      },
      newValues: {
        scheduledDate: params.scheduledDate.toISOString(),
        notes: params.notes ?? existing.notes,
      },
    },
  });

  if (existing.taskTemplate) {
    const ruleRecord = await db.recurrenceRule.findUnique({
      where: { id: existing.taskTemplate.recurrenceRuleId },
    });

    if (ruleRecord) {
      // Propagation: shift the anchor by the same delta to move the whole future sequence.
      const deltaDays = differenceInDays(startOfDay(params.scheduledDate), startOfDay(existing.scheduledDate));
      if (deltaDays !== 0) {
        await db.recurrenceRule.update({
          where: { id: existing.taskTemplate.recurrenceRuleId },
          data: { anchorDate: addDays(startOfDay(ruleRecord.anchorDate), deltaDays) },
        });
      }

      // Re-key the current occurrence for stability
      // For SLIDING, the generator will pick up this rescheduled date as the new base
      // because it's "locked" (status = rescheduled).
      // For SLIDING, REUSE the occurrence's existing sliding index rather than
      // forcing 0 — forcing 0 shifts the base parsed on the next sync, drifting
      // every downstream slot's key and materialising duplicates.
      let slidingIndex: number | undefined;
      if (ruleRecord.mode === "SLIDING") {
        const parsed = Number.parseInt(existing.sourceGenerationKey.split(":sliding:")[1] ?? "", 10);
        slidingIndex = Number.isNaN(parsed)
          ? getStableSequenceIndex(mapRecurrenceRule(ruleRecord), params.scheduledDate)
          : parsed;
      }
      const newKey = buildGenerationKey(
        existing.taskTemplate.id,
        params.scheduledDate,
        ruleRecord.mode,
        slidingIndex,
      );

      // Re-keying is best-effort: if another occurrence already holds this key
      // (e.g. sync generated a new one after a reopen), skip rather than crash.
      await db.taskOccurrence
        .update({
          where: { id: params.occurrenceId },
          data: { sourceGenerationKey: newKey },
        })
        // Intentionally swallowed: if another occurrence already holds this key
        // (e.g. sync generated a new one after a reopen), the unique constraint
        // violation is expected and harmless.
        .catch(() => {});

      // For FIXED, we preemptively cancel others. For SLIDING, sync will handle it.
      if (ruleRecord.mode === "FIXED") {
        await db.taskOccurrence.updateMany({
          where: {
            taskTemplateId: existing.taskTemplate.id,
            status: { in: ["planned", "due", "overdue"] },
            scheduledDate: { gt: params.scheduledDate },
          },
          data: { status: "cancelled" },
        });
      }

      // Sync is best-effort: the reschedule is already committed above.
      // A sync failure must not surface as a user-visible error.
      await syncHouseholdOccurrences(existing.householdId, {
        taskId: existing.taskTemplate.id,
        forceOverwriteManual: false,
      }).catch((err) => {
        logWarn("rescheduleOccurrence.sync_failed", { error: err instanceof Error ? err.message : String(err) });
      });
    }
  }
}

export async function reassignOccurrence(params: {
  occurrenceId: string;
  actorMemberId?: string | null;
  assignedMemberId: string;
  notes?: string;
}) {
  const existing = await db.taskOccurrence.findUnique({
    where: {
      id: params.occurrenceId,
    },
  });

  if (!existing) {
    return;
  }

  const occurrence = await db.taskOccurrence.update({
    where: {
      id: params.occurrenceId,
    },
    data: {
      assignedMemberId: params.assignedMemberId,
      notes: params.notes ?? existing.notes,
      isManuallyModified: true,
    },
  });

  await db.occurrenceActionLog.create({
    data: {
      occurrenceId: occurrence.id,
      actionType: "reassigned",
      actorMemberId: params.actorMemberId ?? undefined,
      previousValues: {
        assignedMemberId: existing.assignedMemberId,
        notes: existing.notes,
      },
      newValues: {
        assignedMemberId: params.assignedMemberId,
        notes: params.notes ?? existing.notes,
      },
    },
  });
}

export async function reopenOccurrence(params: {
  occurrenceId: string;
  actorMemberId?: string | null;
  notes?: string;
}) {
  const existing = await db.taskOccurrence.findUnique({
    where: {
      id: params.occurrenceId,
    },
  });

  if (!existing) {
    return;
  }

  // Restore the original scheduledDate if completion moved it (SLIDING mode sets it to today).
  const completionLog = await db.occurrenceActionLog.findFirst({
    where: { occurrenceId: params.occurrenceId, actionType: "completed" },
    orderBy: { createdAt: "desc" },
  });
  const previousScheduledDate =
    completionLog?.previousValues &&
    typeof (completionLog.previousValues as Record<string, unknown>).scheduledDate === "string"
      ? new Date((completionLog.previousValues as Record<string, unknown>).scheduledDate as string)
      : null;

  const restoredDate = previousScheduledDate ?? existing.scheduledDate;
  const reopenedStatus = isPastDay(restoredDate) ? "overdue" : isToday(restoredDate) ? "due" : "planned";
  const occurrence = await db.taskOccurrence.update({
    where: {
      id: params.occurrenceId,
    },
    data: {
      status: reopenedStatus,
      scheduledDate: restoredDate,
      completedAt: null,
      completedByMemberId: null,
      actualMinutes: null,
      notes: params.notes ?? existing.notes,
      isManuallyModified: true,
    },
  });

  await db.occurrenceActionLog.create({
    data: {
      occurrenceId: occurrence.id,
      actionType: "edited",
      actorMemberId: params.actorMemberId ?? undefined,
      previousValues: {
        status: existing.status,
        completedAt: existing.completedAt?.toISOString() ?? null,
        completedByMemberId: existing.completedByMemberId,
        actualMinutes: existing.actualMinutes,
        notes: existing.notes,
      },
      newValues: {
        status: reopenedStatus,
        completedAt: null,
        completedByMemberId: null,
        actualMinutes: null,
        notes: params.notes ?? existing.notes,
      },
    },
  });
}
