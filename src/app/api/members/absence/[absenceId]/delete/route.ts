import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageHousehold } from "@/lib/households";
import { redirectTo } from "@/lib/request";
import { syncHouseholdOccurrences } from "@/lib/scheduling/service";

type Params = {
  params: Promise<{ absenceId: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const user = await requireUser();
  const { absenceId } = await params;

  const absence = await db.memberAvailability.findUnique({
    where: {
      id: absenceId,
    },
    include: {
      member: true,
    },
  });

  if (!absence || absence.type !== "date_range_absence") {
    return redirectTo(request, "/app/taches/disponibilites?absence=invalid");
  }

  const membership = await db.householdMember.findFirst({
    where: {
      householdId: absence.member.householdId,
      userId: user.id,
    },
  });

  if (!membership || !canManageHousehold(membership.role)) {
    return redirectTo(request, `/app/taches/disponibilites?household=${absence.member.householdId}&absence=forbidden`);
  }

  await db.memberAvailability.delete({
    where: {
      id: absenceId,
    },
  });

  await syncHouseholdOccurrences(absence.member.householdId, {
    forceOverwriteManual: true,
  });

  return redirectTo(request, `/app/taches/disponibilites?household=${absence.member.householdId}&absence=removed`);
}
