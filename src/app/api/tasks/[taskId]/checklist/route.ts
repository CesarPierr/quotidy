import { NextResponse } from "next/server";

import { checklistInclude, serializeChecklist } from "@/lib/aide-memoire";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Read the checklists linked to a task template. Used by the "Checklist" tab in
 * the task detail sheet so a member can tick items off while doing the task.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const user = await requireUser();
  const { taskId } = await params;

  const task = await db.taskTemplate.findFirst({
    where: {
      id: taskId,
      household: { members: { some: { userId: user.id, isActive: true } } },
    },
    select: { id: true, householdId: true },
  });

  if (!task) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const checklists = await db.checklist.findMany({
    where: { taskTemplateId: taskId, isArchived: false },
    include: checklistInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    householdId: task.householdId,
    checklists: checklists.map(serializeChecklist),
  });
}
