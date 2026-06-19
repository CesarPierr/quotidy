import { NextResponse } from "next/server";

import { listHouseholdNotes, serializeNote } from "@/lib/aide-memoire";
import { dataErrorOrRedirect, dataOrRedirect, withHousehold } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { householdNoteCreateSchema, noteRetentionSchema } from "@/lib/validation";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: householdId } = await ctx.params;

  const household = await db.household.findFirst({
    where: { id: householdId, members: { some: { userId: user.id } } },
    select: { noteRetentionDays: true },
  });
  if (!household) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { active, done } = await listHouseholdNotes(householdId, household.noteRetentionDays);
  return NextResponse.json({ active, done, retentionDays: household.noteRetentionDays });
}

export const POST = withHousehold<{ id: string }>(async ({ request, params, membership, formData }) => {
  const householdId = params.id;
  const fallback = `/app/aide-memoire?household=${householdId}&error=invalid`;
  const action = formData.get("_action")?.toString() ?? "create";

  // Update the shared retention window for completed notes.
  if (action === "retention") {
    const parsed = noteRetentionSchema.safeParse({
      noteRetentionDays: formData.get("noteRetentionDays"),
    });
    if (!parsed.success) {
      return dataErrorOrRedirect(request, 400, "Durée de conservation invalide.", fallback);
    }
    await db.household.update({
      where: { id: householdId },
      data: { noteRetentionDays: parsed.data.noteRetentionDays },
    });
    return dataOrRedirect(
      request,
      `/app/aide-memoire?household=${householdId}&settings=1`,
      { noteRetentionDays: parsed.data.noteRetentionDays },
      false,
    );
  }

  const parsed = householdNoteCreateSchema.safeParse({
    title: formData.get("title") || undefined,
    body: formData.get("body"),
    color: formData.get("color") || undefined,
  });
  if (!parsed.success) {
    return dataErrorOrRedirect(request, 400, "Note invalide.", fallback);
  }

  const include = {
    createdByMember: { select: { displayName: true } },
    completedByMember: { select: { displayName: true } },
  };
  const data = {
    householdId,
    createdByMemberId: membership.id,
    title: parsed.data.title ?? null,
    body: parsed.data.body,
    color: parsed.data.color,
  };

  // Offline-created notes carry a client id so a replay on reconnect is
  // idempotent (upsert no-ops the second time). Guard against an id that
  // collides with another household's note — fall back to a fresh create.
  const clientId = formData.get("id")?.toString();
  const usableId = clientId && clientId.length >= 8 && clientId.length <= 64 ? clientId : null;
  let note;
  if (usableId) {
    const existing = await db.householdNote.findUnique({ where: { id: usableId }, select: { householdId: true } });
    note =
      existing && existing.householdId !== householdId
        ? await db.householdNote.create({ data, include })
        : await db.householdNote.upsert({ where: { id: usableId }, create: { id: usableId, ...data }, update: {}, include });
  } else {
    note = await db.householdNote.create({ data, include });
  }

  return dataOrRedirect(
    request,
    `/app/aide-memoire?household=${householdId}&created=${note.id}`,
    { note: serializeNote(note) },
    false,
  );
});
