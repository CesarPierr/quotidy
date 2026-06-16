import "server-only";

import { Prisma } from "@prisma/client";
import { subDays } from "date-fns";

import { db } from "@/lib/db";

/**
 * Purge completed foyer notes whose retention window has elapsed. Runs lazily
 * on read (mirrors the savings auto-fill catch-up pattern) so no cron is
 * required. `retentionDays` comes from the household setting.
 */
export async function purgeExpiredNotes(householdId: string, retentionDays: number) {
  const cutoff = subDays(new Date(), Math.max(1, retentionDays));
  await db.householdNote.deleteMany({
    where: {
      householdId,
      completedAt: { not: null, lt: cutoff },
    },
  });
}

export type SerializedNote = {
  id: string;
  title: string | null;
  body: string;
  color: string;
  isPinned: boolean;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  createdByName: string | null;
  completedByName: string | null;
};

export function serializeNote(note: {
  id: string;
  title: string | null;
  body: string;
  color: string;
  isPinned: boolean;
  sortOrder: number;
  completedAt: Date | null;
  createdAt: Date;
  createdByMember: { displayName: string } | null;
  completedByMember: { displayName: string } | null;
}): SerializedNote {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    color: note.color,
    isPinned: note.isPinned,
    sortOrder: note.sortOrder,
    completedAt: note.completedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
    createdByName: note.createdByMember?.displayName ?? null,
    completedByName: note.completedByMember?.displayName ?? null,
  };
}

/**
 * List a household's foyer notes, purging expired completed notes first.
 * Active notes: pinned first, then oldest-first (FIFO). Done notes: most
 * recently completed first.
 */
export async function listHouseholdNotes(householdId: string, retentionDays: number) {
  await purgeExpiredNotes(householdId, retentionDays);

  const notes = await db.householdNote.findMany({
    where: { householdId },
    include: {
      createdByMember: { select: { displayName: true } },
      completedByMember: { select: { displayName: true } },
    },
    orderBy: [
      { isPinned: "desc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
  });

  const active: SerializedNote[] = [];
  const done: SerializedNote[] = [];
  for (const note of notes) {
    (note.completedAt ? done : active).push(serializeNote(note));
  }
  // Most recently completed first in the "Fait" list.
  done.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  return { active, done };
}

export type SerializedChecklistItem = {
  id: string;
  label: string;
  isChecked: boolean;
  sortOrder: number;
};

export type SerializedChecklist = {
  id: string;
  name: string;
  icon: string | null;
  color: string;
  sortOrder: number;
  taskTemplateId: string | null;
  taskTitle: string | null;
  items: SerializedChecklistItem[];
  checkedCount: number;
  totalCount: number;
};

/** The Prisma include needed to serialize a checklist. */
export const checklistInclude = Prisma.validator<Prisma.ChecklistInclude>()({
  items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  taskTemplate: { select: { title: true } },
});

export function serializeChecklist(checklist: {
  id: string;
  name: string;
  icon: string | null;
  color: string;
  sortOrder: number;
  taskTemplateId: string | null;
  taskTemplate: { title: string } | null;
  items: { id: string; label: string; isChecked: boolean; sortOrder: number }[];
}): SerializedChecklist {
  return {
    id: checklist.id,
    name: checklist.name,
    icon: checklist.icon,
    color: checklist.color,
    sortOrder: checklist.sortOrder,
    taskTemplateId: checklist.taskTemplateId,
    taskTitle: checklist.taskTemplate?.title ?? null,
    items: checklist.items.map((item) => ({
      id: item.id,
      label: item.label,
      isChecked: item.isChecked,
      sortOrder: item.sortOrder,
    })),
    checkedCount: checklist.items.filter((item) => item.isChecked).length,
    totalCount: checklist.items.length,
  };
}

/** List a household's active checklists with their items and progress. */
export async function listChecklists(householdId: string): Promise<SerializedChecklist[]> {
  const checklists = await db.checklist.findMany({
    where: { householdId, isArchived: false },
    include: checklistInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return checklists.map(serializeChecklist);
}
