import "server-only";

import { addDays, startOfDay, subDays } from "date-fns";
import type { RecurrenceType, SavingsEntryType } from "@prisma/client";

import { db } from "@/lib/db";
import { generateRecurrenceDates } from "@/lib/scheduling/recurrence";
import { toNumber } from "@/lib/savings/currency";

function occurrenceMinutes(occurrence: {
  actualMinutes: number | null;
  taskTemplate: { estimatedMinutes: number };
}) {
  return occurrence.actualMinutes ?? occurrence.taskTemplate.estimatedMinutes;
}

function signedEntryAmount(type: SavingsEntryType, amount: unknown) {
  const value = toNumber(amount as never);
  switch (type) {
    case "deposit":
    case "transfer_in":
    case "auto_fill":
      return value;
    case "withdrawal":
    case "transfer_out":
      return -value;
    case "adjustment":
      return value;
  }
}

export async function getHouseholdMonitoringSnapshot(householdId: string) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const historyStart = subDays(today, 90);
  const futureEnd = addDays(today, 30);

  const [members, occurrences, savingsEntries, recurringRules] = await Promise.all([
    db.householdMember.findMany({
      where: { householdId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, displayName: true, color: true },
    }),
    db.taskOccurrence.findMany({
      where: {
        householdId,
        status: { not: "cancelled" },
        OR: [
          { scheduledDate: { gte: historyStart, lte: futureEnd } },
          { completedAt: { gte: historyStart } },
        ],
      },
      include: {
        taskTemplate: { select: { title: true, estimatedMinutes: true } },
        assignedMember: { select: { id: true, displayName: true, color: true } },
        completedByMember: { select: { id: true, displayName: true, color: true } },
      },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
    }),
    db.savingsEntry.findMany({
      where: { householdId, occurredOn: { gte: historyStart } },
      include: { box: { select: { name: true, color: true, kind: true } } },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      take: 80,
    }),
    db.savingsAutoFillRule.findMany({
      where: { isPaused: false, box: { householdId, isArchived: false } },
      include: { box: { select: { name: true, color: true, kind: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const rolling = [7, 30, 90].map((days) => {
    const since = subDays(today, days);
    const elapsed = occurrences.filter(
      (occurrence) => occurrence.scheduledDate >= since && occurrence.scheduledDate < tomorrow,
    );
    const completed = elapsed.filter((occurrence) => occurrence.status === "completed");
    const skipped = elapsed.filter((occurrence) => occurrence.status === "skipped");
    const minutes = completed.reduce((sum, occurrence) => sum + occurrenceMinutes(occurrence), 0);

    return {
      days,
      scheduledCount: elapsed.length,
      completedCount: completed.length,
      skippedCount: skipped.length,
      completedMinutes: minutes,
      completionRate: elapsed.length ? Math.round((completed.length / elapsed.length) * 100) : 0,
    };
  });

  const activeStatuses = new Set(["planned", "due", "overdue", "rescheduled"]);
  const upcoming = occurrences.filter(
    (occurrence) => activeStatuses.has(occurrence.status) && occurrence.scheduledDate <= futureEnd,
  );
  const next7 = upcoming.filter((occurrence) => occurrence.scheduledDate < addDays(today, 7));
  const next30 = upcoming.filter((occurrence) => occurrence.scheduledDate >= today);
  const overdue = upcoming.filter((occurrence) => occurrence.status === "overdue" || occurrence.scheduledDate < today);
  const upcomingMinutes = next30.reduce((sum, occurrence) => sum + occurrenceMinutes(occurrence), 0);
  const upcoming7Minutes = next7.reduce((sum, occurrence) => sum + occurrenceMinutes(occurrence), 0);

  const byMember = members.map((member) => {
    const assigned = next30.filter((occurrence) => occurrence.assignedMemberId === member.id);
    return {
      memberId: member.id,
      displayName: member.displayName,
      color: member.color,
      taskCount: assigned.length,
      minutes: assigned.reduce((sum, occurrence) => sum + occurrenceMinutes(occurrence), 0),
    };
  });

  const completedLast30 = occurrences.filter(
    (occurrence) => occurrence.status === "completed" && occurrence.completedAt && occurrence.completedAt >= subDays(today, 30),
  );
  const taskGroups = new Map<string, { title: string; count: number; minutes: number }>();
  for (const occurrence of completedLast30) {
    const current = taskGroups.get(occurrence.taskTemplate.title) ?? {
      title: occurrence.taskTemplate.title,
      count: 0,
      minutes: 0,
    };
    current.count += 1;
    current.minutes += occurrenceMinutes(occurrence);
    taskGroups.set(occurrence.taskTemplate.title, current);
  }

  const topCompletedTasks = Array.from(taskGroups.values())
    .sort((left, right) => right.minutes - left.minutes || right.count - left.count)
    .slice(0, 4);

  const last30Start = subDays(today, 30);
  const last90Start = subDays(today, 90);
  const entrySummaries = savingsEntries.map((entry) => ({
    id: entry.id,
    boxName: entry.box.name,
    boxColor: entry.box.color,
    boxKind: entry.box.kind,
    occurredOn: entry.occurredOn,
    reason: entry.reason,
    signedAmount: signedEntryAmount(entry.type, entry.amount),
  }));

  const recentExpenses = entrySummaries.filter((entry) => entry.signedAmount < 0).slice(0, 5);
  const last30Expenses = entrySummaries
    .filter((entry) => entry.occurredOn >= last30Start && entry.signedAmount < 0)
    .reduce((sum, entry) => sum + Math.abs(entry.signedAmount), 0);
  const last30Income = entrySummaries
    .filter((entry) => entry.occurredOn >= last30Start && entry.signedAmount > 0)
    .reduce((sum, entry) => sum + entry.signedAmount, 0);
  const last90Expenses = entrySummaries
    .filter((entry) => entry.occurredOn >= last90Start && entry.signedAmount < 0)
    .reduce((sum, entry) => sum + Math.abs(entry.signedAmount), 0);

  const recurringMovements = recurringRules
    .map((rule) => {
      const nextDate = generateRecurrenceDates(
        {
          type: rule.type as RecurrenceType,
          mode: "FIXED",
          interval: rule.interval,
          weekdays: (rule.weekdays as number[] | null) ?? undefined,
          dayOfMonth: rule.dayOfMonth ?? undefined,
          anchorDate: rule.anchorDate,
        },
        today,
        futureEnd,
      )[0] ?? null;

      return {
        id: rule.id,
        boxName: rule.box.name,
        boxColor: rule.box.color,
        boxKind: rule.box.kind,
        amount: toNumber(rule.amount),
        nextDate,
      };
    })
    .sort((left, right) => {
      if (!left.nextDate && !right.nextDate) return 0;
      if (!left.nextDate) return 1;
      if (!right.nextDate) return -1;
      return left.nextDate.getTime() - right.nextDate.getTime();
    })
    .slice(0, 5);

  return {
    generatedAt: new Date(),
    rolling,
    upcoming: {
      next7Count: next7.length,
      next7Minutes: upcoming7Minutes,
      next30Count: next30.length,
      next30Minutes: upcomingMinutes,
      overdueCount: overdue.length,
      byMember,
    },
    topCompletedTasks,
    savings: {
      last30Income: Math.round(last30Income * 100) / 100,
      last30Expenses: Math.round(last30Expenses * 100) / 100,
      last90Expenses: Math.round(last90Expenses * 100) / 100,
      recentExpenses,
      recurringMovements,
    },
  };
}

export type HouseholdMonitoringSnapshot = Awaited<ReturnType<typeof getHouseholdMonitoringSnapshot>>;
