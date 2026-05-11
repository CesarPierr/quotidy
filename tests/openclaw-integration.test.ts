import { beforeEach, describe, expect, it, vi } from "vitest";

const schedulingMocks = vi.hoisted(() => ({
  syncHouseholdOccurrences: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  householdFindUnique: vi.fn(),
  householdMemberFindMany: vi.fn(),
  householdIntegrationFindUnique: vi.fn(),
  householdIntegrationUpsert: vi.fn(),
  taskTemplateFindMany: vi.fn(),
  taskTemplateFindFirst: vi.fn(),
  taskTemplateUpdate: vi.fn(),
  taskOccurrenceFindMany: vi.fn(),
  taskOccurrenceUpdateMany: vi.fn(),
  transaction: vi.fn(),
  recurrenceRuleCreate: vi.fn(),
  assignmentRuleCreate: vi.fn(),
  taskTemplateCreate: vi.fn(),
  taskTemplateFindFirstOrThrow: vi.fn(),
}));

vi.mock("@/lib/scheduling/service", () => ({
  syncHouseholdOccurrences: schedulingMocks.syncHouseholdOccurrences,
}));

vi.mock("@/lib/db", () => ({
  db: {
    household: {
      findUnique: dbMocks.householdFindUnique,
    },
    householdMember: {
      findMany: dbMocks.householdMemberFindMany,
    },
    householdIntegration: {
      findUnique: dbMocks.householdIntegrationFindUnique,
      upsert: dbMocks.householdIntegrationUpsert,
    },
    taskTemplate: {
      findMany: dbMocks.taskTemplateFindMany,
      findFirst: dbMocks.taskTemplateFindFirst,
      update: dbMocks.taskTemplateUpdate,
    },
    taskOccurrence: {
      findMany: dbMocks.taskOccurrenceFindMany,
      updateMany: dbMocks.taskOccurrenceUpdateMany,
    },
    $transaction: dbMocks.transaction,
  },
}));

vi.mock("server-only", () => ({}));

import { authorizeHouseholdIntegrationRequest, hashIntegrationApiKey } from "@/lib/integrations/auth";
import {
  buildOpenClawDiscovery,
  createOpenClawTask,
  deleteOpenClawTask,
  upsertOpenClawIntegrationSettings,
} from "@/lib/integrations/openclaw";

describe("OpenClaw integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schedulingMocks.syncHouseholdOccurrences.mockResolvedValue(undefined);
    dbMocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        recurrenceRule: {
          create: dbMocks.recurrenceRuleCreate,
        },
        assignmentRule: {
          create: dbMocks.assignmentRuleCreate,
        },
        taskTemplate: {
          create: dbMocks.taskTemplateCreate,
          findFirstOrThrow: dbMocks.taskTemplateFindFirstOrThrow,
        },
      }),
    );
  });

  it("upserts a household integration and returns the newly generated api key once", async () => {
    dbMocks.householdIntegrationUpsert.mockResolvedValue({
      id: "int-1",
      householdId: "clh9x8j0a0000f7a8h1b2c3d",
      provider: "mcp_openclaw",
      isEnabled: true,
      serverUrl: "http://127.0.0.1:8787",
      clientLabel: "OpenClaw local",
      apiKeyHash: "hashed",
      apiKeyPreview: "mmg_oc_abc...1234",
      updatedAt: new Date("2026-04-22T12:00:00.000Z"),
    });

    const result = await upsertOpenClawIntegrationSettings({
      householdId: "clh9x8j0a0000f7a8h1b2c3d",
      isEnabled: true,
      serverUrl: "http://127.0.0.1:8787",
      clientLabel: "OpenClaw local",
      regenerateKey: true,
    });

    expect(result.apiKey).toMatch(/^mmg_oc_/);
    expect(result.integration.isEnabled).toBe(true);
    expect(dbMocks.householdIntegrationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isEnabled: true,
          serverUrl: "http://127.0.0.1:8787",
          clientLabel: "OpenClaw local",
          apiKeyHash: expect.any(String),
          apiKeyPreview: expect.stringContaining("..."),
        }),
      }),
    );
  });

  it("authorizes requests with the stored hashed api key", async () => {
    dbMocks.householdIntegrationFindUnique.mockResolvedValue({
      id: "int-1",
      householdId: "clh9x8j0a0000f7a8h1b2c3d",
      provider: "mcp_openclaw",
      isEnabled: true,
      apiKeyHash: hashIntegrationApiKey("secret-key"),
      household: {
        id: "clh9x8j0a0000f7a8h1b2c3d",
        name: "Maison",
        timezone: "Europe/Paris",
      },
    });

    const result = await authorizeHouseholdIntegrationRequest(
      new Request("http://localhost/api/integrations/mcp/openclaw/tasks", {
        headers: {
          "x-quotidy-key": "secret-key",
        },
      }),
      "clh9x8j0a0000f7a8h1b2c3d",
    );

    expect(result.ok).toBe(true);
  });

  it("creates a recurring task with all active members by default and syncs future occurrences", async () => {
    dbMocks.householdMemberFindMany.mockResolvedValue([
      { id: "clh9x8j0a0001f7a8h1b2c3d", displayName: "Alice", color: "#E86A33" },
      { id: "clh9x8j0a0002f7a8h1b2c3d", displayName: "Bob", color: "#4B9CE2" },
    ]);
    dbMocks.recurrenceRuleCreate.mockResolvedValue({ id: "rec-1" });
    dbMocks.assignmentRuleCreate.mockResolvedValue({ id: "assign-1" });
    dbMocks.taskTemplateCreate.mockResolvedValue({ id: "task-1" });
    dbMocks.taskTemplateFindFirstOrThrow.mockResolvedValue({
      id: "task-1",
      householdId: "clh9x8j0a0000f7a8h1b2c3d",
      title: "Sortir les poubelles",
      description: null,
      category: null,
      room: null,
      color: "#D8643D",
      estimatedMinutes: 15,
      isActive: true,
      startsOn: new Date("2026-04-22T00:00:00.000Z"),
      endsOn: null,
      createdAt: new Date("2026-04-22T09:00:00.000Z"),
      updatedAt: new Date("2026-04-22T09:00:00.000Z"),
      recurrenceRule: {
        type: "every_x_days",
        interval: 3,
        weekdays: null,
        dayOfMonth: null,
        anchorDate: new Date("2026-04-22T00:00:00.000Z"),
        dueOffsetDays: 0,
      },
      assignmentRule: {
        mode: "strict_alternation",
        eligibleMemberIds: ["clh9x8j0a0001f7a8h1b2c3d", "clh9x8j0a0002f7a8h1b2c3d"],
        fixedMemberId: null,
        rotationOrder: ["clh9x8j0a0001f7a8h1b2c3d", "clh9x8j0a0002f7a8h1b2c3d"],
        fairnessWindowDays: 14,
        rebalanceOnMemberAbsence: true,
        lockAssigneeAfterGeneration: true,
      },
    });

    const task = await createOpenClawTask({
      householdId: "clh9x8j0a0000f7a8h1b2c3d",
      title: "Sortir les poubelles",
      estimatedMinutes: 15,
      startsOn: "2026-04-22",
      recurrence: {
        type: "every_x_days",
        interval: 3,
        dueOffsetDays: 0,
      },
      assignment: {
        mode: "strict_alternation",
      },
    });

    expect(task.assignment.eligibleMemberIds).toEqual([
      "clh9x8j0a0001f7a8h1b2c3d",
      "clh9x8j0a0002f7a8h1b2c3d",
    ]);
    expect(dbMocks.assignmentRuleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eligibleMemberIds: ["clh9x8j0a0001f7a8h1b2c3d", "clh9x8j0a0002f7a8h1b2c3d"],
        }),
      }),
    );
    expect(schedulingMocks.syncHouseholdOccurrences).toHaveBeenCalledWith(
      "clh9x8j0a0000f7a8h1b2c3d",
    );
  });

  it("disables a recurring task while preserving manual future occurrences by default", async () => {
    dbMocks.taskTemplateFindFirst.mockResolvedValue({
      id: "task-1",
      householdId: "clh9x8j0a0000f7a8h1b2c3d",
    });
    dbMocks.taskTemplateUpdate.mockResolvedValue({ id: "task-1", isActive: false });
    dbMocks.taskOccurrenceUpdateMany.mockResolvedValue({ count: 4 });

    const result = await deleteOpenClawTask({
      taskId: "task-1",
      householdId: "clh9x8j0a0000f7a8h1b2c3d",
    });

    expect(result).toEqual({
      id: "task-1",
      cancelledOccurrences: 4,
      keptManualOccurrences: true,
    });
    expect(dbMocks.taskOccurrenceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          taskTemplateId: "task-1",
          isManuallyModified: false,
        }),
      }),
    );
  });

  it("builds a discovery manifest with stable endpoints for external tools", async () => {
    dbMocks.householdFindUnique.mockResolvedValue({
      id: "clh9x8j0a0000f7a8h1b2c3d",
      name: "Maison",
      timezone: "Europe/Paris",
    });

    const manifest = await buildOpenClawDiscovery(
      new Request("http://localhost/api/integrations/mcp/openclaw/discovery", {
        headers: {
          host: "192.168.1.132",
        },
      }),
      "clh9x8j0a0000f7a8h1b2c3d",
    );

    expect(manifest?.provider).toBe("mcp_openclaw");
    expect(manifest?.endpoints.discovery.url).toContain("householdId=clh9x8j0a0000f7a8h1b2c3d");
    expect(manifest?.endpoints.addTask.url).toContain(
      "/api/integrations/mcp/openclaw/tasks?householdId=clh9x8j0a0000f7a8h1b2c3d",
    );
    expect(manifest?.endpoints.listUpcoming.url).toContain(
      "/api/integrations/mcp/openclaw/upcoming?householdId=clh9x8j0a0000f7a8h1b2c3d",
    );
    expect(manifest?.mcpReady.tools.map((tool) => tool.name)).toContain("rebalance");
  });
});
