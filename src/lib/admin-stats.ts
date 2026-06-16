import "server-only";

import { subDays } from "date-fns";

import { db } from "@/lib/db";
import { isoDateKey } from "@/lib/time";

/** Retention for the UxEvent telemetry table (lazy-purged on admin load). */
const PURGE_DAYS = 120;

/**
 * Delete telemetry older than the retention window. Runs lazily when an admin
 * opens the dashboard (mirrors the savings/notes catch-up-on-read pattern) so
 * UxEvent never grows unbounded — a privacy + storage safeguard.
 */
export async function purgeOldUxEvents(retentionDays = PURGE_DAYS) {
  const cutoff = subDays(new Date(), retentionDays);
  await db.uxEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

async function distinctActiveUsers(sinceDays: number): Promise<number> {
  const rows = await db.uxEvent.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: subDays(new Date(), sinceDays) }, userId: { not: null } },
  });
  return rows.length;
}

export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;

/**
 * Aggregate, PII-free operator metrics. Everything here is counts / rates /
 * daily buckets — no emails, no names, no per-user drill-down.
 */
export async function getAdminStats() {
  const now = new Date();
  const d30 = subDays(now, 30);

  const [
    totalUsers,
    totalHouseholds,
    newUsers30,
    newHouseholds30,
    active1,
    active7,
    active30,
    onboardingStarted,
    onboardingCompleted,
    completed30,
    scheduled30,
    feedbackByStatus,
    feedbackByKind,
    seriesEvents,
  ] = await Promise.all([
    db.user.count(),
    db.household.count(),
    db.user.count({ where: { createdAt: { gte: d30 } } }),
    db.household.count({ where: { createdAt: { gte: d30 } } }),
    distinctActiveUsers(1),
    distinctActiveUsers(7),
    distinctActiveUsers(30),
    db.uxEvent.groupBy({ by: ["userId"], where: { event: "onboarding.step_viewed", userId: { not: null } } }),
    db.uxEvent.groupBy({ by: ["userId"], where: { event: "onboarding.completed", userId: { not: null } } }),
    db.taskOccurrence.count({ where: { scheduledDate: { gte: d30 }, status: "completed" } }),
    db.taskOccurrence.count({ where: { scheduledDate: { gte: d30 }, status: { not: "cancelled" } } }),
    db.feedbackReport.groupBy({ by: ["status"], _count: true }),
    db.feedbackReport.groupBy({ by: ["kind"], _count: true }),
    db.uxEvent.findMany({
      where: { createdAt: { gte: subDays(now, 13) }, userId: { not: null } },
      select: { userId: true, createdAt: true },
    }),
  ]);

  // Daily active users, last 14 days.
  const byDay = new Map<string, Set<string>>();
  for (const e of seriesEvents) {
    const key = isoDateKey(e.createdAt);
    if (!byDay.has(key)) byDay.set(key, new Set());
    if (e.userId) byDay.get(key)!.add(e.userId);
  }
  const series: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = isoDateKey(subDays(now, i));
    series.push({ date: key, count: byDay.get(key)?.size ?? 0 });
  }

  return {
    totals: { users: totalUsers, households: totalHouseholds },
    growth30: { users: newUsers30, households: newHouseholds30 },
    active: { d1: active1, d7: active7, d30: active30 },
    series,
    completion: {
      rate: scheduled30 > 0 ? Math.round((completed30 / scheduled30) * 100) : 0,
      completed: completed30,
      scheduled: scheduled30,
    },
    onboarding: {
      started: onboardingStarted.length,
      completed: onboardingCompleted.length,
      rate: onboardingStarted.length > 0 ? Math.round((onboardingCompleted.length / onboardingStarted.length) * 100) : 0,
    },
    feedback: {
      byStatus: feedbackByStatus.map((r) => ({ status: r.status, count: r._count })),
      byKind: feedbackByKind.map((r) => ({ kind: r.kind, count: r._count })),
    },
  };
}
