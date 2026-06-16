import { withHousehold } from "@/lib/api";
import { db } from "@/lib/db";
import { redirectTo } from "@/lib/request";
import {
  addMemberToExistingAssignments,
  syncHouseholdOccurrences,
} from "@/lib/scheduling/service";
import { memberSchema } from "@/lib/validation";

export const POST = withHousehold<{ id: string }>(
  async ({ request, params, formData }) => {
    const fallback = `/app/foyer/membres?household=${params.id}`;

    const parsed = memberSchema.safeParse({
      householdId: params.id,
      displayName: formData.get("displayName"),
      role: formData.get("role"),
      color: formData.get("color"),
      weeklyCapacityMinutes: formData.get("weeklyCapacityMinutes") || undefined,
    });

    if (!parsed.success) {
      return redirectTo(request, fallback);
    }

    const createdMember = await db.householdMember.create({
      data: parsed.data,
    });

    const includeInExistingTasks = String(formData.get("includeInExistingTasks") ?? "on") !== "off";

    if (includeInExistingTasks) {
      await addMemberToExistingAssignments({
        householdId: params.id,
        memberId: createdMember.id,
      });
    } else {
      await syncHouseholdOccurrences(params.id);
    }

    return redirectTo(request, fallback);
  },
  { requireManage: true },
);
