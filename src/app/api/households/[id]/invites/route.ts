import { withHousehold } from "@/lib/api";
import { createHouseholdInvite } from "@/lib/household-management";
import { redirectTo } from "@/lib/request";
import { householdInviteSchema } from "@/lib/validation";

export const POST = withHousehold<{ id: string }>(
  async ({ request, params, membership, formData }) => {
    const fallback = `/app/foyer/invitations?household=${params.id}`;

    const parsed = householdInviteSchema.safeParse({
      householdId: params.id,
      role: formData.get("role") || "member",
      expiresInDays: formData.get("expiresInDays") || 7,
    });

    if (!parsed.success) {
      return redirectTo(request, `${fallback}&invite=invalid`);
    }

    await createHouseholdInvite({
      householdId: params.id,
      createdByMemberId: membership.id,
      role: parsed.data.role,
      expiresInDays: parsed.data.expiresInDays,
    });

    return redirectTo(request, `${fallback}&invite=created`);
  },
  { requireManage: true },
);
