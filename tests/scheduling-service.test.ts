import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  taskTemplateFindMany: vi.fn(),
  assignmentRuleUpdate: vi.fn(),
  householdFindUnique: vi.fn(),
  taskOccurrenceFindUnique: vi.fn(),
  taskOccurrenceUpdate: vi.fn(),
  occurrenceActionLogCreate: vi.fn(),
  occurrenceActionLogFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    taskTemplate: {
      findMany: dbMocks.taskTemplateFindMany,
    },
    assignmentRule: {
      update: dbMocks.assignmentRuleUpdate,
    },
    household: {
      findUnique: dbMocks.householdFindUnique,
    },
    taskOccurrence: {
      findUnique: dbMocks.taskOccurrenceFindUnique,
      update: dbMocks.taskOccurrenceUpdate,
    },
    occurrenceActionLog: {
      create: dbMocks.occurrenceActionLogCreate,
      findFirst: dbMocks.occurrenceActionLogFindFirst,
    },
  },
}));

import { addMemberToExistingAssignments, completeOccurrence, reopenOccurrence } from "@/lib/scheduling/service";

describe("scheduling service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.householdFindUnique.mockResolvedValue({
      id: "house-1",
      members: [],
      tasks: [],
    });
  });

  it("adds a new member to rotating and fairness-based task rules", async () => {
    dbMocks.taskTemplateFindMany.mockResolvedValue([
      {
        assignmentRuleId: "rule-1",
        assignmentRule: {
          mode: "strict_alternation",
          eligibleMemberIds: ["A", "B"],
          rotationOrder: ["A", "B"],
        },
      },
      {
        assignmentRuleId: "rule-2",
        assignmentRule: {
          mode: "least_assigned_minutes",
          eligibleMemberIds: ["A", "B"],
          rotationOrder: ["A", "B"],
        },
      },
      {
        assignmentRuleId: "rule-3",
        assignmentRule: {
          mode: "fixed",
          eligibleMemberIds: ["A"],
          rotationOrder: ["A"],
        },
      },
    ]);

    await addMemberToExistingAssignments({
      householdId: "house-1",
      memberId: "C",
    });

    expect(dbMocks.assignmentRuleUpdate).toHaveBeenCalledTimes(2);
    expect(dbMocks.assignmentRuleUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "rule-1" },
      data: {
        eligibleMemberIds: ["A", "B", "C"],
        rotationOrder: ["A", "B", "C"],
      },
    });
    expect(dbMocks.assignmentRuleUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "rule-2" },
      data: {
        eligibleMemberIds: ["A", "B", "C"],
        rotationOrder: ["A", "B", "C"],
      },
    });
  });
});

describe("reopenOccurrence", () => {
  it("resets completion and skipped metadata then logs the edit", async () => {
    dbMocks.taskOccurrenceFindUnique.mockResolvedValue({
      id: "occ-1",
      status: "completed",
      scheduledDate: new Date("2099-02-10"),
      completedAt: new Date("2099-02-11"),
      completedByMemberId: "member-1",
      actualMinutes: 35,
      notes: "fait",
    });
    dbMocks.taskOccurrenceUpdate.mockResolvedValue({
      id: "occ-1",
    });
    dbMocks.occurrenceActionLogFindFirst.mockResolvedValue(null);

    await reopenOccurrence({
      occurrenceId: "occ-1",
      actorMemberId: "member-2",
    });

    expect(dbMocks.taskOccurrenceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "occ-1" },
        data: expect.objectContaining({
          status: "planned",
          completedAt: null,
          completedByMemberId: null,
          actualMinutes: null,
        }),
      }),
    );
    expect(dbMocks.occurrenceActionLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          occurrenceId: "occ-1",
          actionType: "edited",
          actorMemberId: "member-2",
        }),
      }),
    );
  });
});

describe("completeOccurrence (offline replay idempotency)", () => {
  it("no-ops when already completed and the replay carries no new details", async () => {
    dbMocks.taskOccurrenceFindUnique.mockResolvedValue({
      id: "occ-1",
      status: "completed",
      scheduledDate: new Date("2099-02-10"),
      completedAt: new Date("2099-02-11"),
      completedByMemberId: "member-1",
      actualMinutes: null,
      notes: null,
      wasCompletedAlone: false,
      taskTemplateId: "tpl-1",
      taskTemplate: { recurrenceRule: { mode: "FIXED" } },
    });

    // A queued offline "complete" gets re-sent on reconnect; replaying it must
    // not append a second action log or re-realign the recurrence.
    await completeOccurrence({ occurrenceId: "occ-1", actorMemberId: "member-1" });

    expect(dbMocks.taskOccurrenceUpdate).not.toHaveBeenCalled();
    expect(dbMocks.occurrenceActionLogCreate).not.toHaveBeenCalled();
  });
});

