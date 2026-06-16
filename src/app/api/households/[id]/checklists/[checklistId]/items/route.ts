import { checklistInclude, serializeChecklist } from "@/lib/aide-memoire";
import { dataErrorOrRedirect, dataOrRedirect, withHousehold } from "@/lib/api";
import { db } from "@/lib/db";
import { checklistItemCreateSchema } from "@/lib/validation";

export const POST = withHousehold<{ id: string; checklistId: string }>(
  async ({ request, params, formData }) => {
    const householdId = params.id;
    const checklistId = params.checklistId;
    const fallback = `/app/aide-memoire?household=${householdId}&error=invalid`;

    const checklist = await db.checklist.findFirst({
      where: { id: checklistId, householdId },
      select: { id: true },
    });
    if (!checklist) {
      return dataErrorOrRedirect(request, 404, "Liste introuvable.", fallback);
    }

    const parsed = checklistItemCreateSchema.safeParse({ label: formData.get("label") });
    if (!parsed.success) {
      return dataErrorOrRedirect(request, 400, "Élément invalide.", fallback);
    }

    const last = await db.checklistItem.findFirst({
      where: { checklistId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const nextOrder = (last?.sortOrder ?? -1) + 1;

    await db.checklistItem.create({
      data: { checklistId, label: parsed.data.label, sortOrder: nextOrder },
    });

    const updated = await db.checklist.findUniqueOrThrow({
      where: { id: checklistId },
      include: checklistInclude,
    });

    return dataOrRedirect(
      request,
      `/app/aide-memoire?household=${householdId}`,
      { checklist: serializeChecklist(updated) },
      false,
    );
  },
);
