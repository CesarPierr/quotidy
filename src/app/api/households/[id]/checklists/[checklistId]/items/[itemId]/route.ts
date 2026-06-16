import { checklistInclude, serializeChecklist } from "@/lib/aide-memoire";
import { dataErrorOrRedirect, dataOrRedirect, withHousehold } from "@/lib/api";
import { db } from "@/lib/db";
import { checklistItemUpdateSchema } from "@/lib/validation";

export const POST = withHousehold<{ id: string; checklistId: string; itemId: string }>(
  async ({ request, params, membership, formData }) => {
    const householdId = params.id;
    const { checklistId, itemId } = params;
    const fallback = `/app/aide-memoire?household=${householdId}&error=invalid`;
    const action = formData.get("_action")?.toString() ?? "toggle";

    // Scope the item through its checklist to this household.
    const item = await db.checklistItem.findFirst({
      where: { id: itemId, checklistId, checklist: { householdId } },
    });
    if (!item) {
      return dataErrorOrRedirect(request, 404, "Élément introuvable.", fallback);
    }

    if (action === "delete") {
      await db.checklistItem.delete({ where: { id: itemId } });
    } else if (action === "toggle") {
      const next = !item.isChecked;
      await db.checklistItem.update({
        where: { id: itemId },
        data: { isChecked: next, checkedByMemberId: next ? membership.id : null },
      });
    } else if (action === "move") {
      const direction = formData.get("direction")?.toString();
      const siblings = await db.checklistItem.findMany({
        where: { checklistId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, sortOrder: true },
      });
      const index = siblings.findIndex((s) => s.id === itemId);
      const swapWith = direction === "up" ? index - 1 : index + 1;
      if (index !== -1 && swapWith >= 0 && swapWith < siblings.length) {
        const a = siblings[index];
        const b = siblings[swapWith];
        await db.$transaction([
          db.checklistItem.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
          db.checklistItem.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
        ]);
      }
    } else {
      // update label
      const parsed = checklistItemUpdateSchema.safeParse({
        label: formData.get("label") || undefined,
        sortOrder: formData.get("sortOrder") || undefined,
      });
      if (!parsed.success) {
        return dataErrorOrRedirect(request, 400, "Élément invalide.", fallback);
      }
      await db.checklistItem.update({
        where: { id: itemId },
        data: { label: parsed.data.label ?? undefined, sortOrder: parsed.data.sortOrder ?? undefined },
      });
    }

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
