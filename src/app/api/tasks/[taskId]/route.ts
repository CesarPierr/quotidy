import { startOfDay } from "date-fns";

import { withHousehold } from "@/lib/api";
import { db } from "@/lib/db";
import { redirectTo } from "@/lib/request";
import { syncHouseholdOccurrences } from "@/lib/scheduling/service";
import { taskTemplateSchema } from "@/lib/validation";

export const POST = withHousehold<{ taskId: string }>(
  async ({ request, params, formData }) => {
    const { taskId } = params;
    const householdId = String(formData.get("householdId"));
    const fallback = `/app/taches/routines?household=${householdId}`;
    const method = formData.get("_method");

    if (method === "DELETE") {
      const deleteManual = formData.get("deleteManual") === "on";

      const task = await db.taskTemplate.findFirst({
        where: { id: taskId, householdId },
      });

      if (!task) {
        return redirectTo(request, fallback);
      }

      await db.taskTemplate.update({
        where: { id: taskId },
        data: { isActive: false },
      });

      const conditions: {
        taskTemplateId: string;
        status: { in: ["planned", "due", "overdue", "rescheduled"] };
        scheduledDate: { gte: Date };
        isManuallyModified?: boolean;
      } = {
        taskTemplateId: taskId,
        status: { in: ["planned", "due", "overdue", "rescheduled"] },
        scheduledDate: { gte: startOfDay(new Date()) },
      };

      if (!deleteManual) {
        conditions.isManuallyModified = false;
      }

      await db.taskOccurrence.updateMany({
        where: conditions,
        data: { status: "cancelled" },
      });

      return redirectTo(request, fallback);
    }

    // PUT-as-POST default branch.
    const forceOverwriteManual = formData.get("forceOverwriteManual") === "on";
    const startsOnRaw = String(formData.get("startsOn"));
    const requestedRecurrenceType = String(formData.get("recurrenceType"));
    const singleRun =
      requestedRecurrenceType === "single" || formData.get("singleRun") === "on";
    const normalizedRecurrenceType = singleRun ? "daily" : requestedRecurrenceType;
    const requestedEligibleMemberIds = formData
      .getAll("eligibleMemberIds")
      .map(String)
      .filter(Boolean);
    const assignmentMode = singleRun ? "fixed" : String(formData.get("assignmentMode"));

    const householdMembers = await db.householdMember.findMany({
      where: { householdId, isActive: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    const defaultEligibleMemberIds = householdMembers.map((member) => member.id);
    const eligibleMemberIds = requestedEligibleMemberIds.length
      ? requestedEligibleMemberIds
      : defaultEligibleMemberIds;

    const parsedTask = taskTemplateSchema.safeParse({
      householdId,
      title: formData.get("title"),
      category: formData.get("category") || undefined,
      room: formData.get("room") || undefined,
      icon: formData.get("icon") || undefined,
      color: formData.get("color") || undefined,
      estimatedMinutes: formData.get("estimatedMinutes"),
      startsOn: startsOnRaw,
      endsOn: singleRun ? startsOnRaw : formData.get("endsOn") || undefined,
      recurrence: {
        type: normalizedRecurrenceType,
        mode: (formData.get("recurrenceMode") as "FIXED" | "SLIDING") || "SLIDING",
        interval: formData.get("interval"),
        anchorDate: startsOnRaw,
        dueOffsetDays: 0,
      },
      assignment: {
        mode: assignmentMode,
        eligibleMemberIds,
        rotationOrder: eligibleMemberIds,
        fairnessWindowDays: 14,
        rebalanceOnMemberAbsence: true,
        lockAssigneeAfterGeneration: true,
      },
    });

    if (!parsedTask.success || !eligibleMemberIds.length) {
      return redirectTo(request, fallback);
    }

    const task = await db.taskTemplate.findFirst({
      where: { id: taskId, householdId },
      include: { recurrenceRule: true, assignmentRule: true },
    });

    if (!task) {
      return redirectTo(request, fallback);
    }

    await db.recurrenceRule.update({
      where: { id: task.recurrenceRuleId },
      data: {
        type: parsedTask.data.recurrence.type,
        mode: parsedTask.data.recurrence.mode,
        interval: singleRun ? 1 : parsedTask.data.recurrence.interval,
        anchorDate: parsedTask.data.recurrence.anchorDate,
        config: singleRun ? { singleRun: true } : undefined,
      },
    });

    await db.assignmentRule.update({
      where: { id: task.assignmentRuleId },
      data: {
        mode: parsedTask.data.assignment.mode,
        eligibleMemberIds: parsedTask.data.assignment.eligibleMemberIds,
        fixedMemberId:
          parsedTask.data.assignment.mode === "fixed"
            ? parsedTask.data.assignment.eligibleMemberIds[0]
            : null,
        rotationOrder: parsedTask.data.assignment.eligibleMemberIds,
      },
    });

    await db.taskTemplate.update({
      where: { id: taskId },
      data: {
        title: parsedTask.data.title,
        description: parsedTask.data.description,
        category: parsedTask.data.category,
        room: parsedTask.data.room,
        icon: parsedTask.data.icon,
        color: parsedTask.data.color,
        estimatedMinutes: parsedTask.data.estimatedMinutes,
        startsOn: parsedTask.data.startsOn,
        endsOn: singleRun ? parsedTask.data.startsOn : parsedTask.data.endsOn ?? null,
      },
    });

    await syncHouseholdOccurrences(householdId, { taskId, forceOverwriteManual });

    return redirectTo(request, fallback);
  },
  {
    requireManage: true,
    resolveHouseholdId: (_params, formData) => formData.get("householdId")?.toString(),
  },
);
