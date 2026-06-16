import { NextResponse } from "next/server";

import { checklistInclude, listChecklists, serializeChecklist } from "@/lib/aide-memoire";
import { dataErrorOrRedirect, dataOrRedirect, withHousehold } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checklistCreateSchema } from "@/lib/validation";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: householdId } = await ctx.params;

  const membership = await db.householdMember.findFirst({
    where: { householdId, userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const checklists = await listChecklists(householdId);
  return NextResponse.json({ checklists });
}

export const POST = withHousehold<{ id: string }>(async ({ request, params, membership, formData }) => {
  const householdId = params.id;
  const fallback = `/app/aide-memoire?household=${householdId}&error=invalid`;

  const parsed = checklistCreateSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
    taskTemplateId: formData.get("taskTemplateId") || undefined,
  });
  if (!parsed.success) {
    return dataErrorOrRedirect(request, 400, "Liste invalide.", fallback);
  }

  // Guard the optional task link: it must belong to this household.
  if (parsed.data.taskTemplateId) {
    const template = await db.taskTemplate.findFirst({
      where: { id: parsed.data.taskTemplateId, householdId },
      select: { id: true },
    });
    if (!template) {
      return dataErrorOrRedirect(request, 400, "Tâche liée introuvable.", fallback);
    }
  }

  const last = await db.checklist.findFirst({
    where: { householdId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const nextOrder = (last?.sortOrder ?? -1) + 1;

  const checklist = await db.checklist.create({
    data: {
      householdId,
      createdByMemberId: membership.id,
      name: parsed.data.name,
      icon: parsed.data.icon ?? null,
      color: parsed.data.color,
      taskTemplateId: parsed.data.taskTemplateId ?? null,
      sortOrder: nextOrder,
    },
    include: checklistInclude,
  });

  return dataOrRedirect(
    request,
    `/app/aide-memoire?household=${householdId}&created=${checklist.id}`,
    { checklist: serializeChecklist(checklist) },
    false,
  );
});
