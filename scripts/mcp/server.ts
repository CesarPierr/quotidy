import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  createOpenClawTask,
  deleteOpenClawTask,
  listOpenClawTasks,
  listOpenClawUpcoming,
  rebalanceOpenClawHousehold,
  updateOpenClawTask,
} from "@/lib/integrations/openclaw";

function resolveHouseholdId(provided?: string) {
  const householdId = 
    provided?.trim() || 
    process.env.QUOTIDY_MCP_HOUSEHOLD_ID?.trim() || 
    process.env.MAKEMENAGE_MCP_HOUSEHOLD_ID?.trim();
  
  if (!householdId) {
    throw new Error("Missing householdId. Set QUOTIDY_MCP_HOUSEHOLD_ID or pass householdId to the tool.");
  }

  return householdId;
}

function asText(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function buildToolResult(payload: unknown) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      content: [{ type: "text" as const, text: asText(payload) }],
      structuredContent: payload as Record<string, unknown>,
    };
  }

  return {
    content: [{ type: "text" as const, text: asText(payload) }],
  };
}

const server = new McpServer({
  name: "quotidy-openclaw",
  version: "1.0.0",
});

server.registerTool(
  "list_tasks",
  {
    description: "List household task templates, including one-time and recurring tasks.",
    inputSchema: {
      householdId: z.string().optional(),
      includeInactive: z.boolean().optional(),
    },
  },
  async ({ householdId, includeInactive }) => {
    const resolvedHouseholdId = resolveHouseholdId(householdId);
    const tasks = await listOpenClawTasks(resolvedHouseholdId, { includeInactive });
    return buildToolResult({ householdId: resolvedHouseholdId, tasks });
  },
);

server.registerTool(
  "list_upcoming",
  {
    description: "List upcoming occurrences for a household or one member.",
    inputSchema: {
      householdId: z.string().optional(),
      memberId: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      includeCompleted: z.boolean().optional(),
    },
  },
  async ({ householdId, memberId, limit, includeCompleted }) => {
    const resolvedHouseholdId = resolveHouseholdId(householdId);
    const upcoming = await listOpenClawUpcoming({
      householdId: resolvedHouseholdId,
      memberId,
      limit: limit ?? 20,
      includeCompleted,
    });

    return buildToolResult({ householdId: resolvedHouseholdId, occurrences: upcoming });
  },
);

server.registerTool(
  "create_task",
  {
    description: "Create a new household task. Set recurrence.oneTime=true for a simple one-time task.",
    inputSchema: {
      householdId: z.string().optional(),
      title: z.string().min(2).max(80),
      description: z.string().max(280).optional(),
      category: z.string().max(40).optional(),
      room: z.string().max(40).optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      estimatedMinutes: z.number().int().min(1).max(480).optional(),
      startsOn: z.string(),
      recurrence: z.object({
        type: z.enum(["daily", "every_x_days", "weekly", "every_x_weeks", "monthly_simple"]).default("weekly"),
        interval: z.number().int().min(1).max(90).optional(),
        weekdays: z.array(z.number().int().min(0).max(6)).optional(),
        dayOfMonth: z.number().int().min(1).max(31).optional(),
        anchorDate: z.string().optional(),
        dueOffsetDays: z.number().int().min(0).max(30).optional(),
        oneTime: z.boolean().optional(),
      }),
      assignment: z.object({
        mode: z
          .enum([
            "fixed",
            "manual",
            "strict_alternation",
            "round_robin",
            "least_assigned_count",
            "least_assigned_minutes",
          ])
          .optional(),
        eligibleMemberIds: z.array(z.string()).optional(),
        fixedMemberId: z.string().optional(),
        rotationOrder: z.array(z.string()).optional(),
        fairnessWindowDays: z.number().int().min(1).max(90).optional(),
        rebalanceOnMemberAbsence: z.boolean().optional(),
        lockAssigneeAfterGeneration: z.boolean().optional(),
      }),
    },
  },
  async (input) => {
    const resolvedHouseholdId = resolveHouseholdId(input.householdId);
    const task = await createOpenClawTask({
      ...input,
      householdId: resolvedHouseholdId,
    });
    return buildToolResult(task);
  },
);

server.registerTool(
  "update_task",
  {
    description: "Update an existing task template.",
    inputSchema: {
      householdId: z.string().optional(),
      taskId: z.string(),
      patch: z.record(z.string(), z.unknown()),
    },
  },
  async ({ householdId, taskId, patch }) => {
    const resolvedHouseholdId = resolveHouseholdId(householdId);
    const task = await updateOpenClawTask(taskId, resolvedHouseholdId, patch);
    return buildToolResult(task);
  },
);

server.registerTool(
  "delete_task",
  {
    description: "Disable a task and cancel eligible future occurrences.",
    inputSchema: {
      householdId: z.string().optional(),
      taskId: z.string(),
      deleteManual: z.boolean().optional(),
    },
  },
  async ({ householdId, taskId, deleteManual }) => {
    const resolvedHouseholdId = resolveHouseholdId(householdId);
    const result = await deleteOpenClawTask({
      householdId: resolvedHouseholdId,
      taskId,
      deleteManual,
    });
    return buildToolResult(result);
  },
);

server.registerTool(
  "rebalance_household",
  {
    description: "Regenerate and rebalance future occurrences for the whole household or one task.",
    inputSchema: {
      householdId: z.string().optional(),
      taskId: z.string().optional(),
      forceOverwriteManual: z.boolean().optional(),
      preserveRotationOnSkipOverride: z.boolean().optional(),
    },
  },
  async ({ householdId, taskId, forceOverwriteManual, preserveRotationOnSkipOverride }) => {
    const resolvedHouseholdId = resolveHouseholdId(householdId);
    const result = await rebalanceOpenClawHousehold({
      householdId: resolvedHouseholdId,
      taskId,
      forceOverwriteManual,
      preserveRotationOnSkipOverride,
    });

    return buildToolResult(result);
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Quotidy MCP server running on stdio");
}

main().catch((error) => {
  console.error("Quotidy MCP server error:", error);
  process.exit(1);
});
