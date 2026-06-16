import { serializeNote } from "@/lib/aide-memoire";
import { dataErrorOrRedirect, dataOrRedirect, withHousehold } from "@/lib/api";
import { db } from "@/lib/db";
import { householdNoteUpdateSchema } from "@/lib/validation";

const noteInclude = {
  createdByMember: { select: { displayName: true } },
  completedByMember: { select: { displayName: true } },
} as const;

export const POST = withHousehold<{ id: string; noteId: string }>(
  async ({ request, params, membership, formData }) => {
    const householdId = params.id;
    const noteId = params.noteId;
    const fallback = `/app/aide-memoire?household=${householdId}&error=invalid`;
    const action = formData.get("_action")?.toString() ?? "update";

    const note = await db.householdNote.findFirst({ where: { id: noteId, householdId } });
    if (!note) {
      return dataErrorOrRedirect(request, 404, "Note introuvable.", fallback);
    }

    if (action === "delete") {
      await db.householdNote.delete({ where: { id: noteId } });
      return dataOrRedirect(
        request,
        `/app/aide-memoire?household=${householdId}&deleted=1`,
        { ok: true },
        false,
      );
    }

    if (action === "complete" || action === "uncomplete") {
      const updated = await db.householdNote.update({
        where: { id: noteId },
        data:
          action === "complete"
            ? { completedAt: new Date(), completedByMemberId: membership.id, isPinned: false }
            : { completedAt: null, completedByMemberId: null },
        include: noteInclude,
      });
      return dataOrRedirect(
        request,
        `/app/aide-memoire?household=${householdId}`,
        { note: serializeNote(updated) },
        false,
      );
    }

    if (action === "pin") {
      const updated = await db.householdNote.update({
        where: { id: noteId },
        data: { isPinned: !note.isPinned },
        include: noteInclude,
      });
      return dataOrRedirect(
        request,
        `/app/aide-memoire?household=${householdId}`,
        { note: serializeNote(updated) },
        false,
      );
    }

    // update
    const parsed = householdNoteUpdateSchema.safeParse({
      title: formData.get("title") ?? undefined,
      body: formData.get("body") || undefined,
      color: formData.get("color") || undefined,
      isPinned: formData.has("isPinned")
        ? formData.get("isPinned") === "on" || formData.get("isPinned") === "true"
        : undefined,
      sortOrder: formData.get("sortOrder") || undefined,
    });
    if (!parsed.success) {
      return dataErrorOrRedirect(request, 400, "Note invalide.", fallback);
    }

    const updated = await db.householdNote.update({
      where: { id: noteId },
      data: {
        title: parsed.data.title !== undefined ? parsed.data.title || null : undefined,
        body: parsed.data.body ?? undefined,
        color: parsed.data.color ?? undefined,
        isPinned: parsed.data.isPinned ?? undefined,
        sortOrder: parsed.data.sortOrder ?? undefined,
      },
      include: noteInclude,
    });

    return dataOrRedirect(
      request,
      `/app/aide-memoire?household=${householdId}&updated=1`,
      { note: serializeNote(updated) },
      false,
    );
  },
);
