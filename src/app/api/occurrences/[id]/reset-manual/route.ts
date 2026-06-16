import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageHousehold } from "@/lib/households";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;
  const formData = await request.formData();
  const householdId = formData.get("householdId")?.toString();
  const taskId = formData.get("taskId")?.toString();

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

  await db.taskOccurrence.update({
    where: {
      id,
      householdId,
    },
    data: {
      isManuallyModified: false,
    },
  });

  // Redirect back to the overrides page or my-tasks
  const url = taskId 
    ? `/app/taches/routines/overrides/${taskId}?household=${householdId}` 
    : `/app/taches/aujourd-hui?household=${householdId}`;
    
  return NextResponse.redirect(new URL(url, request.url), 303);
}
