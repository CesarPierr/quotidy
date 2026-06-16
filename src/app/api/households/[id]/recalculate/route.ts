import { withHousehold } from "@/lib/api";
import { redirectTo } from "@/lib/request";
import { syncHouseholdOccurrences } from "@/lib/scheduling/service";

export const POST = withHousehold<{ id: string }>(
  async ({ request, params, formData }) => {
    const forceOverwriteManual = formData.get("forceOverwriteManual") === "on";
    const skipLoadPolicy = String(formData.get("skipLoadPolicy") || "no_carry_over");
    const preserveRotationOnSkipOverride =
      skipLoadPolicy === "carry_over"
        ? false
        : skipLoadPolicy === "no_carry_over"
          ? true
          : null;

    await syncHouseholdOccurrences(params.id, {
      forceOverwriteManual,
      preserveRotationOnSkipOverride,
    });

    const result = forceOverwriteManual ? "done_overwrite" : "done";
    return redirectTo(
      request,
      `/app/taches/disponibilites?household=${params.id}&rebalance=${result}`,
    );
  },
  { requireManage: true },
);
