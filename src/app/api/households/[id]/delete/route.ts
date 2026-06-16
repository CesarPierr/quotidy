import { requireUser } from "@/lib/auth";
import { deleteHousehold } from "@/lib/household-management";
import { redirectTo } from "@/lib/request";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;
  const formData = await request.formData();
  const confirmed = formData.get("confirmDelete") === "on";

  if (!confirmed) {
    return redirectTo(request, `/app/foyer/zone-sensible?household=${id}&delete=confirm_required`);
  }

  const result = await deleteHousehold({
    householdId: id,
    userId: user.id,
  });

  if (result.status === "deleted") {
    return redirectTo(
      request,
      result.nextHouseholdId ? `/app?household=${result.nextHouseholdId}` : "/app?onboarding=1",
    );
  }

  return redirectTo(request, `/app/foyer/zone-sensible?household=${id}&delete=${result.status}`);
}
