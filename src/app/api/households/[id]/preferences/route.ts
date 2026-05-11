import { NextResponse } from "next/server";

import { withHousehold } from "@/lib/api";
import { db } from "@/lib/db";
import { isDataRequest, redirectTo } from "@/lib/request";

// Toggles per-household feature preferences. Currently exposes one switch
// (`savingsEnabled`); reusing the same endpoint for future toggles avoids the
// proliferation of one-flag endpoints.
export const POST = withHousehold<{ id: string }>(
  async ({ request, params, formData }) => {
    const householdId = params.id;
    const fallback = `/app/settings/households?household=${householdId}`;

    const data: { savingsEnabled?: boolean } = {};
    if (formData.has("savingsEnabled")) {
      // Standard HTML trick: a hidden "false" sits before the checkbox so an
      // unchecked box still submits the field. When checked, both values are
      // present; we keep the last one (`true`) since browsers preserve order.
      const all = formData.getAll("savingsEnabled").map((v) => String(v).toLowerCase());
      const last = all[all.length - 1] ?? "";
      data.savingsEnabled = last === "true" || last === "on" || last === "1";
    }

    if (Object.keys(data).length === 0) {
      return isDataRequest(request)
        ? NextResponse.json({ ok: true, updated: 0 })
        : redirectTo(request, `${fallback}&pref=noop`);
    }

    await db.household.update({ where: { id: householdId }, data });

    if (isDataRequest(request)) {
      return NextResponse.json({ ok: true, updated: Object.keys(data).length });
    }

    return redirectTo(request, `${fallback}&pref=saved`);
  },
  { requireManage: true },
);
