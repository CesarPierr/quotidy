import { NextResponse } from "next/server";
import { z } from "zod";

import { dataErrorOrRedirect, withHousehold } from "@/lib/api";
import { parseDateInput } from "@/lib/date-input";
import { declareHoliday } from "@/lib/holidays";
import { isDataRequest, redirectTo } from "@/lib/request";

const schema = z.object({
  startDate: z.preprocess((value) => parseDateInput(String(value ?? "")), z.date()),
  endDate: z.preprocess((value) => parseDateInput(String(value ?? "")), z.date()),
  label: z.string().max(60).optional(),
});

export const POST = withHousehold<{ id: string }>(
  async ({ request, params, membership, formData }) => {
    const householdId = params.id;
    const fallback = `/app/taches/disponibilites?household=${householdId}`;

    const parsed = schema.safeParse({
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      label: formData.get("label") || undefined,
    });

    if (!parsed.success) {
      return dataErrorOrRedirect(request, 400, "Dates invalides.", `${fallback}&error=invalid`);
    }

    if (parsed.data.endDate < parsed.data.startDate) {
      return dataErrorOrRedirect(
        request,
        400,
        "Date de fin antérieure à la date de début.",
        `${fallback}&error=order`,
      );
    }

    const result = await declareHoliday({
      householdId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      label: parsed.data.label,
      actorMemberId: membership.id,
    });

    if (isDataRequest(request)) {
      return NextResponse.json({ ok: true, ...result });
    }

    return redirectTo(request, `${fallback}&shifted=${result.shiftedCount}`);
  },
  { requireManage: true },
);
