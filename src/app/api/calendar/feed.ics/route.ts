import { NextResponse } from "next/server";
import ical from "ical-generator";
import { addDays } from "date-fns";

import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdContext } from "@/lib/households";
import { verifyIcalToken } from "@/lib/ical-token";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawToken = url.searchParams.get("token");

  let context: Awaited<ReturnType<typeof getCurrentHouseholdContext>>;

  if (rawToken) {
    const payload = verifyIcalToken(rawToken);
    if (!payload) {
      return new NextResponse("Invalid token", { status: 401 });
    }
    const household = await db.household.findUnique({
      where: { id: payload.householdId },
      include: {
        members: {
          include: {
            availabilities: true,
          },
        },
      },
    });
    if (!household) {
      return new NextResponse("No household", { status: 404 });
    }
    // Build a minimal context to reuse the same rendering logic
    const occurrences = await db.taskOccurrence.findMany({
      where: { householdId: payload.householdId, status: { not: "cancelled" } },
      include: {
        taskTemplate: true,
        assignedMember: true,
      },
      orderBy: { scheduledDate: "asc" },
    });
    context = { household, occurrences } as unknown as Awaited<ReturnType<typeof getCurrentHouseholdContext>>;
  } else {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });
    const householdId = url.searchParams.get("household");
    context = await getCurrentHouseholdContext(user.id, householdId);
  }

  if (!context) {
    return new NextResponse("No household", { status: 404 });
  }

  const calendar = ical({
    name: `Quotidy - ${context.household.name}`,
    timezone: context.household.timezone,
  });

  context.occurrences.forEach((occurrence) => {
    calendar.createEvent({
      start: occurrence.scheduledDate,
      end: occurrence.dueDate,
      summary: occurrence.taskTemplate.title,
      description: `Assigné à ${occurrence.assignedMember?.displayName ?? "non attribué"} · ${occurrence.status}`,
    });
  });

  context.household.members.forEach((member) => {
    member.availabilities
      .filter((availability) => availability.type === "date_range_absence")
      .forEach((availability) => {
        calendar.createEvent({
          start: availability.startDate,
          end: addDays(availability.endDate, 1),
          allDay: true,
          summary: `Absence · ${member.displayName}`,
          description: availability.notes ?? "Indisponibilité déclarée",
        });
      });
  });

  return new NextResponse(calendar.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${context.household.name}.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
