import { NextResponse } from "next/server";
import { startOfDay } from "date-fns";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageHousehold } from "@/lib/households";
import { syncHouseholdOccurrences } from "@/lib/scheduling/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const user = await requireUser();
  const { taskId } = await params;
  const formData = await request.formData();
  const householdId = formData.get("householdId")?.toString();

  if (!householdId) {
    return new NextResponse("Missing householdId", { status: 400 });
  }

  const membership = await db.householdMember.findUnique({
    where: {
      householdId_userId: {
        householdId,
        userId: user.id,
      },
    },
  });

  if (!membership || !canManageHousehold(membership.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Reset all future manual overrides for this task
  await db.taskOccurrence.updateMany({
    where: {
      taskTemplateId: taskId,
      householdId,
      isManuallyModified: true,
      scheduledDate: {
        gte: startOfDay(new Date()),
      },
    },
    data: {
      isManuallyModified: false,
    },
  });

  // Re-sync occurrences for this task to re-apply rules
  await syncHouseholdOccurrences(householdId, {
    taskId,
    forceOverwriteManual: true, // We already reset them, but this ensures a clean sync
  });

  return NextResponse.redirect(new URL(`/app/taches/routines?household=${householdId}`, request.url), 303);
}
