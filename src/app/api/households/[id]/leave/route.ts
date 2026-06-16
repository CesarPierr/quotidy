import { requireUser } from "@/lib/auth";
import { leaveHousehold } from "@/lib/household-management";
import { redirectTo } from "@/lib/request";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;
  const result = await leaveHousehold({
    householdId: id,
    userId: user.id,
  });

  if (result.status === "left") {
    return redirectTo(
      request,
      result.nextHouseholdId ? `/app?household=${result.nextHouseholdId}` : "/app?onboarding=1",
    );
  }

  return redirectTo(request, `/app/foyer/foyers?household=${id}&leave=${result.status}`);
}
