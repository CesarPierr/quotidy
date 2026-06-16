import { NextResponse } from "next/server";

import { withHousehold } from "@/lib/api";
import { deleteHoliday } from "@/lib/holidays";
import { isDataRequest, redirectTo } from "@/lib/request";

export const POST = withHousehold<{ id: string; holidayId: string }>(
  async ({ request, params }) => {
    await deleteHoliday({ holidayId: params.holidayId, householdId: params.id });

    if (isDataRequest(request)) {
      return NextResponse.json({ ok: true });
    }

    return redirectTo(request, `/app/taches/disponibilites?household=${params.id}&deleted=1`);
  },
  { requireManage: true },
);
