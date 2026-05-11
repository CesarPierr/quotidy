import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { db } from "@/lib/db";

for (const candidate of [".env.local", ".env.production", ".env", ".env.example"]) {
  const filePath = path.join(process.cwd(), candidate);

  if (fs.existsSync(filePath)) {
    process.loadEnvFile(filePath);
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  assert(databaseUrl, "DATABASE_URL is required for the MCP smoke test.");

  const now = Date.now();
  const household = await db.household.create({
    data: {
      name: `Smoke MCP ${now}`,
      timezone: "Europe/Paris",
      createdByUserId: (
        await db.user.create({
          data: {
            email: `mcp-smoke-${now}@quotidy.local`,
            passwordHash: "not-used",
            displayName: "MCP Smoke",
          },
        })
      ).id,
    },
  });

  const firstMember = await db.householdMember.create({
    data: {
      householdId: household.id,
      displayName: "Alex",
      color: "#2E6D88",
      role: "owner",
      isActive: true,
    },
  });

  await db.householdMember.create({
    data: {
      householdId: household.id,
      displayName: "Sam",
      color: "#C56A3A",
      role: "member",
      isActive: true,
    },
  });

  const client = new Client({
    name: "quotidy-mcp-smoke",
    version: "1.0.0",
  });

  const transport = new StdioClientTransport({
    command: "./node_modules/.bin/tsx",
    args: ["scripts/mcp/server.ts"],
    cwd: process.cwd(),
    env: {
      DATABASE_URL: databaseUrl,
      QUOTIDY_MCP_HOUSEHOLD_ID: household.id,
    },
    stderr: "pipe",
  });

  transport.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    assert(tools.tools.some((tool) => tool.name === "create_task"));

    const created = await client.callTool({
      name: "create_task",
      arguments: {
        title: "Test MCP simple",
        estimatedMinutes: 12,
        startsOn: new Date().toISOString().slice(0, 10),
        room: "Cuisine",
        recurrence: {
          type: "weekly",
          oneTime: true,
        },
        assignment: {
          mode: "fixed",
          eligibleMemberIds: [firstMember.id],
          fixedMemberId: firstMember.id,
        },
      },
    });

    const createdTask = (created as { structuredContent?: { id?: string; recurrence?: { oneTime?: boolean } } }).structuredContent;
    assert(createdTask?.id);
    assert.equal(createdTask?.recurrence?.oneTime, true);

    const upcoming = await client.callTool({
      name: "list_upcoming",
      arguments: {
        limit: 10,
      },
    });

    const upcomingOccurrences = (upcoming as { structuredContent?: { occurrences?: Array<{ task?: { title?: string } }> } }).structuredContent?.occurrences ?? [];
    assert(upcomingOccurrences.some((occurrence) => occurrence.task?.title === "Test MCP simple"));

    const updated = await client.callTool({
      name: "update_task",
      arguments: {
        taskId: createdTask.id,
        patch: {
          title: "Test MCP simple modifié",
          recurrence: {
            oneTime: true,
          },
        },
      },
    });

    const updatedTask = (updated as { structuredContent?: { title?: string } }).structuredContent;
    assert.equal(updatedTask?.title, "Test MCP simple modifié");

    const deleted = await client.callTool({
      name: "delete_task",
      arguments: {
        taskId: createdTask.id,
      },
    });

    const deletionResult = (deleted as { structuredContent?: { id?: string } }).structuredContent;
    assert.equal(deletionResult?.id, createdTask.id);

    console.log("MCP smoke test passed.");
  } finally {
    await transport.close();
    await db.household.delete({ where: { id: household.id } }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("MCP smoke test failed:", error);
  process.exit(1);
});
