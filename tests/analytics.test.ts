import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildLoadMetrics, buildRollingCompletionMetrics } from "@/lib/analytics";

describe("analytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes fairness deltas and completion rates", () => {
    const metrics = buildLoadMetrics(
      [
        { id: "A", displayName: "Alice", color: "#000", isActive: true },
        { id: "B", displayName: "Bob", color: "#111", isActive: true },
      ],
      [
        {
          assignedMemberId: "A",
          actualMinutes: null,
          status: "planned",
          taskTemplate: { estimatedMinutes: 40 },
        },
        {
          assignedMemberId: "A",
          actualMinutes: 25,
          status: "completed",
          taskTemplate: { estimatedMinutes: 30 },
        },
        {
          assignedMemberId: "B",
          actualMinutes: null,
          status: "completed",
          taskTemplate: { estimatedMinutes: 20 },
        },
      ],
    );

    expect(metrics.totalOccurrences).toBe(3);
    expect(metrics.byMember[0]?.plannedMinutes).toBe(65);
    expect(metrics.byMember[0]?.completionRate).toBe(50);
    expect(metrics.fairness[0]?.deltaMinutes).toBeGreaterThan(0);
    expect(metrics.fairness[1]?.deltaMinutes).toBeLessThan(0);
  });

  it("computes rolling completion stats over 3, 7, and 15 days", () => {
    const metrics = buildRollingCompletionMetrics(
      [
        { id: "A", displayName: "Alice", color: "#000", isActive: true },
        { id: "B", displayName: "Bob", color: "#111", isActive: true },
      ],
      [
        {
          assignedMemberId: "A",
          completedByMemberId: "A",
          actualMinutes: 35,
          completedAt: new Date("2026-04-20T12:00:00Z"),
          status: "completed",
          taskTemplate: { estimatedMinutes: 40 },
        },
        {
          assignedMemberId: "B",
          completedByMemberId: "B",
          actualMinutes: null,
          completedAt: new Date("2026-04-18T12:00:00Z"),
          status: "completed",
          taskTemplate: { estimatedMinutes: 20 },
        },
        {
          assignedMemberId: "B",
          completedByMemberId: "B",
          actualMinutes: 18,
          completedAt: new Date("2026-04-10T12:00:00Z"),
          status: "completed",
          taskTemplate: { estimatedMinutes: 20 },
        },
      ],
    );

    expect(metrics[0]?.days).toBe(3);
    expect(metrics[0]?.byMember[0]?.completedCount).toBe(1);
    expect(metrics[0]?.byMember[0]?.minutesSpent).toBe(35);
    expect(metrics[0]?.byMember[1]?.completedCount).toBe(0);
    expect(metrics[1]?.days).toBe(7);
    expect(metrics[1]?.byMember[1]?.completedCount).toBe(1);
    expect(metrics[2]?.days).toBe(15);
    expect(metrics[2]?.byMember[1]?.completedCount).toBe(2);
    expect(metrics[2]?.byMember[1]?.minutesSpent).toBe(38);
  });
});
