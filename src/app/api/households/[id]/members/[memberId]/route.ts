import { withHousehold } from "@/lib/api";
import { db } from "@/lib/db";
import { canManageHousehold } from "@/lib/households";
import { redirectTo } from "@/lib/request";
import { memberSchema } from "@/lib/validation";

export const POST = withHousehold<{ id: string; memberId: string }>(
  async ({ request, params, user, membership: actorMembership, formData }) => {
    const fallback = `/app/foyer/membres?household=${params.id}`;

    if (formData.get("_method") !== "PUT") {
      return redirectTo(request, fallback);
    }

    const targetMember = await db.householdMember.findFirst({
      where: { id: params.memberId, householdId: params.id },
    });

    if (!targetMember) {
      return redirectTo(request, fallback);
    }

    const canManageTarget = canManageHousehold(actorMembership.role);
    const isSelf = targetMember.userId === user.id;

    if (!canManageTarget && !isSelf) {
      return redirectTo(request, fallback);
    }

    const parsed = memberSchema.safeParse({
      householdId: params.id,
      displayName: formData.get("displayName"),
      role: canManageTarget ? formData.get("role") : targetMember.role,
      color: formData.get("color"),
      weeklyCapacityMinutes: canManageTarget
        ? formData.get("weeklyCapacityMinutes") || undefined
        : targetMember.weeklyCapacityMinutes ?? undefined,
    });

    if (!parsed.success) {
      return redirectTo(request, `${fallback}&member=invalid`);
    }

    await db.householdMember.update({
      where: { id: targetMember.id },
      data: {
        displayName: parsed.data.displayName,
        color: parsed.data.color,
        role: canManageTarget ? parsed.data.role : targetMember.role,
        weeklyCapacityMinutes: canManageTarget
          ? parsed.data.weeklyCapacityMinutes ?? null
          : targetMember.weeklyCapacityMinutes,
      },
    });

    return redirectTo(request, `${fallback}&member=updated`);
  },
);
