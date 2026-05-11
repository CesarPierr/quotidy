import { NextResponse } from "next/server";
import ical from "ical-generator";
import { addDays } from "date-fns";

import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdContext } from "@/lib/households";
import { verifyIcalToken } from "@/lib/ical-token";
import { db } from "@/lib/db";

type Params = {
  params: Promise<{ memberId: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const { memberId } = await params;
  const url = new URL(request.url);
  const rawToken = url.searchParams.get("token");

  let targetMember: { id: string; displayName: string; availabilities: { type: string; startDate: Date; endDate: Date; notes: string | null }[] } | undefined;
  let householdTimezone: string;
  let filteredOccurrences: Array<{ scheduledDate: Date; dueDate: Date; taskTemplate: { title: string }; status: string }>;

  if (rawToken) {
    const payload = verifyIcalToken(rawToken);
    if (!payload) {
      return new NextResponse("Invalid token", { status: 401 });
    }
    // Token can be scoped to a household or to a specific member
    if (payload.memberId && payload.memberId !== memberId) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const member = await db.householdMember.findUnique({
      where: { id: memberId, householdId: payload.householdId },
      include: {
        availabilities: true,
        household: true,
      },
    });
    if (!member) return new NextResponse("No member", { status: 404 });

    targetMember = member;
    householdTimezone = member.household.timezone;

    const occurrences = await db.taskOccurrence.findMany({
      where: { householdId: payload.householdId, assignedMemberId: memberId, status: { not: "cancelled" } },
      include: { taskTemplate: true },
      orderBy: { scheduledDate: "asc" },
    });
    filteredOccurrences = occurrences;
  } else {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const householdId = url.searchParams.get("household");
    const context = await getCurrentHouseholdContext(user.id, householdId);
    if (!context) return new NextResponse("No household", { status: 404 });

    const found = context.household.members.find((member) => member.id === memberId);
    if (!found) return new NextResponse("No member", { status: 404 });

    targetMember = found;
    householdTimezone = context.household.timezone;
    filteredOccurrences = context.occurrences.filter((occ) => occ.assignedMemberId === memberId);
  }

  const calendar = ical({
    name: `Quotidy - ${targetMember.displayName}`,
    timezone: householdTimezone,
  });

  filteredOccurrences.forEach((occurrence) => {
    calendar.createEvent({
      start: occurrence.scheduledDate,
      end: occurrence.dueDate,
      summary: occurrence.taskTemplate.title,
      description: `Assigné à ${targetMember!.displayName} · ${occurrence.status}`,
    });
  });

  targetMember.availabilities
    .filter((availability) => availability.type === "date_range_absence")
    .forEach((availability) => {
      calendar.createEvent({
        start: availability.startDate,
        end: addDays(availability.endDate, 1),
        allDay: true,
        summary: `Absence · ${targetMember!.displayName}`,
        description: availability.notes ?? "Indisponibilité déclarée",
      });
    });

  return new NextResponse(calendar.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${targetMember.displayName}.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
