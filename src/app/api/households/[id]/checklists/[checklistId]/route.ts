import { checklistInclude, serializeChecklist } from "@/lib/aide-memoire";
import { dataErrorOrRedirect, dataOrRedirect, withHousehold } from "@/lib/api";
import { db } from "@/lib/db";
import { checklistUpdateSchema } from "@/lib/validation";

export const POST = withHousehold<{ id: string; checklistId: string }>(
  async ({ request, params, formData }) => {
    const householdId = params.id;
    const checklistId = params.checklistId;
    const fallback = `/app/aide-memoire?household=${householdId}&error=invalid`;
    const action = formData.get("_action")?.toString() ?? "update";

    const checklist = await db.checklist.findFirst({ where: { id: checklistId, householdId } });
    if (!checklist) {
      return dataErrorOrRedirect(request, 404, "Liste introuvable.", fallback);
    }

    if (action === "delete") {
      await db.checklist.delete({ where: { id: checklistId } });
      return dataOrRedirect(
        request,
        `/app/aide-memoire?household=${householdId}&deleted=1`,
        { ok: true },
        false,
      );
    }

    if (action === "archive" || action === "unarchive") {
      const updated = await db.checklist.update({
        where: { id: checklistId },
        data: { isArchived: action === "archive" },
        include: checklistInclude,
      });
      return dataOrRedirect(
        request,
        `/app/aide-memoire?household=${householdId}`,
        { checklist: serializeChecklist(updated) },
        false,
      );
    }

    // Un-check every item so the reusable list is ready for next time.
    if (action === "reset") {
      await db.checklistItem.updateMany({
        where: { checklistId },
        data: { isChecked: false, checkedByMemberId: null },
      });
      const refreshed = await db.checklist.findUniqueOrThrow({
        where: { id: checklistId },
        include: checklistInclude,
      });
      return dataOrRedirect(
        request,
        `/app/aide-memoire?household=${householdId}&reset=1`,
        { checklist: serializeChecklist(refreshed) },
        false,
      );
    }

    // update
    const parsed = checklistUpdateSchema.safeParse({
      name: formData.get("name") || undefined,
      // Present-but-empty means "clear the icon"; absent means "leave unchanged".
      icon: formData.has("icon") ? formData.get("icon") : undefined,
      color: formData.get("color") || undefined,
      taskTemplateId: formData.has("taskTemplateId") ? formData.get("taskTemplateId") : undefined,
      isArchived: formData.has("isArchived")
        ? formData.get("isArchived") === "on" || formData.get("isArchived") === "true"
        : undefined,
      sortOrder: formData.get("sortOrder") || undefined,
    });
    if (!parsed.success) {
      return dataErrorOrRedirect(request, 400, "Liste invalide.", fallback);
    }

    // If a task link is being set, verify it belongs to this household.
    if (parsed.data.taskTemplateId) {
      const template = await db.taskTemplate.findFirst({
        where: { id: parsed.data.taskTemplateId, householdId },
        select: { id: true },
      });
      if (!template) {
        return dataErrorOrRedirect(request, 400, "Tâche liée introuvable.", fallback);
      }
    }

    const updated = await db.checklist.update({
      where: { id: checklistId },
      data: {
        name: parsed.data.name ?? undefined,
        // undefined = unchanged; empty string = explicit clear (store null).
        icon: parsed.data.icon === undefined ? undefined : parsed.data.icon || null,
        color: parsed.data.color ?? undefined,
        taskTemplateId:
          parsed.data.taskTemplateId === undefined ? undefined : parsed.data.taskTemplateId,
        isArchived: parsed.data.isArchived ?? undefined,
        sortOrder: parsed.data.sortOrder ?? undefined,
      },
      include: checklistInclude,
    });

    return dataOrRedirect(
      request,
      `/app/aide-memoire?household=${householdId}&updated=1`,
      { checklist: serializeChecklist(updated) },
      false,
    );
  },
);
