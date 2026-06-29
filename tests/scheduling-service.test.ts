import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  taskTemplateFindMany: vi.fn(),
  assignmentRuleUpdate: vi.fn(),
  householdFindUnique: vi.fn(),
  taskOccurrenceFindUnique: vi.fn(),
  taskOccurrenceCreate: vi.fn(),
  taskOccurrenceUpdate: vi.fn(),
  taskOccurrenceUpdateMany: vi.fn(),
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
      create: dbMocks.taskOccurrenceCreate,
      update: dbMocks.taskOccurrenceUpdate,
      updateMany: dbMocks.taskOccurrenceUpdateMany,
    },
    occurrenceActionLog: {
      create: dbMocks.occurrenceActionLogCreate,
      findFirst: dbMocks.occurrenceActionLogFindFirst,
    },
  },
}));

import { addDays, startOfDay } from "date-fns";

import { generateOccurrences } from "@/lib/scheduling/generator";
import { mapAbsences, mapAssignmentRule, mapMembers, mapRecurrenceRule } from "@/lib/scheduling/mappers";
import {
  addMemberToExistingAssignments,
  completeOccurrence,
  reopenOccurrence,
  syncHouseholdOccurrences,
} from "@/lib/scheduling/service";
import { getGenerationWindow } from "@/lib/time";

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

describe("syncHouseholdOccurrences (SLIDING slot idempotence)", () => {
  it("re-binds a stale-keyed occurrence to its slot instead of materialising a duplicate", async () => {
    // Reproduces the dishwasher-task bug: a SLIDING `:sliding:<index>` key drifts when
    // the base moves, so the same calendar slot maps to a new key. Before the fix the
    // engine created a duplicate (and orphan-cancelled the old row); now it re-binds.
    const anchor = startOfDay(new Date());
    const recurrenceRule = {
      type: "monthly_simple" as const,
      mode: "SLIDING" as const,
      interval: 1,
      weekdays: [],
      dayOfMonth: null,
      anchorDate: anchor,
      dueOffsetDays: 1,
    };
    const assignmentRule = {
      mode: "fixed" as const,
      eligibleMemberIds: ["M"],
      fixedMemberId: "M",
      rotationOrder: ["M"],
      fairnessWindowDays: null,
      preserveRotationOnSkip: false,
      preserveRotationOnReschedule: false,
      rebalanceOnMemberAbsence: false,
      lockAssigneeAfterGeneration: false,
    };
    const members = [{ id: "M", displayName: "M", isActive: true, weightingFactor: 1, availabilities: [] }];

    // Compute exactly what the generator will produce for this template (same window).
    const { start, end } = getGenerationWindow();
    const generated = generateOccurrences({
      template: {
        id: "tpl-1",
        householdId: "house-1",
        title: "Nettoyage lave vaisselle",
        estimatedMinutes: 10,
        startsOn: addDays(anchor, -1),
        endsOn: null,
        lastCompletedAt: null,
        recurrence: mapRecurrenceRule(recurrenceRule),
        assignment: mapAssignmentRule(assignmentRule),
      },
      members: mapMembers(members),
      absences: mapAbsences(members),
      existingOccurrences: [],
      rangeStart: start,
      rangeEnd: end,
    });
    expect(generated.length).toBeGreaterThan(0);

    // Seed an existing planned occurrence for every generated slot, all key-correct
    // EXCEPT the first, which carries a drifted/stale sliding key.
    const STALE_KEY = "tpl-1:sliding:9999";
    const occurrences = generated.map((g, i) => ({
      id: `occ-${i}`,
      sourceGenerationKey: i === 0 ? STALE_KEY : g.sourceGenerationKey,
      scheduledDate: g.scheduledDate,
      dueDate: g.dueDate,
      assignedMemberId: g.assignedMemberId,
      status: "planned" as const,
      actualMinutes: null,
      isManuallyModified: false,
    }));

    dbMocks.householdFindUnique.mockResolvedValue({
      id: "house-1",
      members,
      tasks: [
        {
          id: "tpl-1",
          householdId: "house-1",
          title: "Nettoyage lave vaisselle",
          estimatedMinutes: 10,
          startsOn: addDays(anchor, -1),
          endsOn: null,
          lastCompletedAt: null,
          isActive: true,
          recurrenceRule,
          assignmentRule,
          occurrences,
        },
      ],
    });
    dbMocks.taskOccurrenceCreate.mockResolvedValue({ id: "should-not-be-created" });
    dbMocks.taskOccurrenceUpdate.mockResolvedValue({ id: "occ-0" });
    dbMocks.taskOccurrenceUpdateMany.mockResolvedValue({ count: 0 });

    await syncHouseholdOccurrences("house-1");

    // No duplicate row materialised, and the stale-keyed slot is re-bound + re-keyed.
    expect(dbMocks.taskOccurrenceCreate).not.toHaveBeenCalled();
    expect(dbMocks.taskOccurrenceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "occ-0" },
        data: expect.objectContaining({ sourceGenerationKey: generated[0].sourceGenerationKey }),
      }),
    );
  });
});

