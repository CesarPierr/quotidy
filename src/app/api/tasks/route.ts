import { NextResponse } from "next/server";


import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageHousehold } from "@/lib/households";
import { redirectTo } from "@/lib/request";
import { syncHouseholdOccurrences } from "@/lib/scheduling/service";
import { taskTemplateSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const householdId = url.searchParams.get("household");

  const membership = await db.householdMember.findFirst({
    where: {
      userId: user.id,
      ...(householdId ? { householdId } : {}),
    },
  });

  if (!membership) {
    return NextResponse.json([]);
  }

  const tasks = await db.taskTemplate.findMany({
    where: {
      householdId: membership.householdId,
    },
    include: {
      recurrenceRule: true,
      assignmentRule: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const householdId = String(formData.get("householdId"));
  const startsOnRaw = String(formData.get("startsOn"));
  const requestedRecurrenceType = String(formData.get("recurrenceType"));
  const singleRun = requestedRecurrenceType === "single" || formData.get("singleRun") === "on";
  const normalizedRecurrenceType = singleRun ? "daily" : requestedRecurrenceType;
  const requestedEligibleMemberIds = formData.getAll("eligibleMemberIds").map(String).filter(Boolean);
  const assignmentMode = singleRun ? "fixed" : String(formData.get("assignmentMode"));
  const householdMembers = await db.householdMember.findMany({
    where: {
      householdId,
      isActive: true,
    },
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
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
      mode: formData.get("recurrenceMode") || "SLIDING",
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

  const membership = await db.householdMember.findFirst({
    where: {
      householdId,
      userId: user.id,
    },
  });

  if (!membership || !canManageHousehold(membership.role) || !eligibleMemberIds.length) {
    return redirectTo(request, `/app/taches/routines?household=${householdId}`);
  }

  if (!parsedTask.success) {
    return redirectTo(request, `/app/taches/routines?household=${householdId}`);
  }

  const validated = parsedTask.data;

  const recurrenceRule = await db.recurrenceRule.create({
    data: {
      type: singleRun ? "daily" : validated.recurrence.type,
      mode: validated.recurrence.mode,
      interval: singleRun ? 1 : validated.recurrence.interval,
      anchorDate: validated.startsOn,
      dueOffsetDays: validated.recurrence.dueOffsetDays,
      config: singleRun ? { singleRun: true } : undefined,
    },
  });

  const assignmentRule = await db.assignmentRule.create({
    data: {
      mode: validated.assignment.mode,
      eligibleMemberIds,
      fixedMemberId: validated.assignment.mode === "fixed" ? eligibleMemberIds[0] : null,
      rotationOrder: eligibleMemberIds,
      fairnessWindowDays: validated.assignment.fairnessWindowDays,
      rebalanceOnMemberAbsence: validated.assignment.rebalanceOnMemberAbsence,
      lockAssigneeAfterGeneration: validated.assignment.lockAssigneeAfterGeneration,
    },
  });

  await db.taskTemplate.create({
    data: {
      householdId,
      title: validated.title,
      description: validated.description ?? null,
      category: validated.category ?? null,
      room: validated.room ?? null,
      icon: validated.icon ?? null,
      color: validated.color,
      estimatedMinutes: validated.estimatedMinutes,
      priority: 2,
      isCollective: formData.get("isCollective") === "on",
      startsOn: validated.startsOn,
      endsOn: singleRun ? validated.startsOn : validated.endsOn ?? null,
      recurrenceRuleId: recurrenceRule.id,
      assignmentRuleId: assignmentRule.id,
      createdByMemberId: membership.id,
    },
  });

  await syncHouseholdOccurrences(householdId);

  return redirectTo(request, `/app/taches/routines?household=${householdId}`);
}
