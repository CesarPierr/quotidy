"use client";

import { useState } from "react";
import { ListChecks, Link2, Plus } from "lucide-react";

import { ChecklistEditor } from "@/components/aide-memoire/checklist-editor";
import type { SerializedChecklist } from "@/lib/aide-memoire";
import { hexToRgba } from "@/lib/colors";

type TaskOption = { id: string; title: string };

type ChecklistListProps = {
  householdId: string;
  initialChecklists: SerializedChecklist[];
  tasks: TaskOption[];
};

export function ChecklistList({ householdId, initialChecklists, tasks }: ChecklistListProps) {
  const [checklists, setChecklists] = useState<SerializedChecklist[]>(initialChecklists);
  const [editing, setEditing] = useState<SerializedChecklist | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openExisting(checklist: SerializedChecklist) {
    setEditing(checklist);
    setEditorOpen(true);
  }

  function onChange(updated: SerializedChecklist) {
    setChecklists((prev) =>
      prev.some((c) => c.id === updated.id)
        ? prev.map((c) => (c.id === updated.id ? updated : c))
        : [...prev, updated],
    );
    // Keep the open editor pointed at the freshly-created/updated checklist.
    setEditing(updated);
  }

  function onDeleted(id: string) {
    setChecklists((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {checklists.map((checklist) => {
          const pct = checklist.totalCount > 0 ? Math.round((checklist.checkedCount / checklist.totalCount) * 100) : 0;
          return (
            <button
              className="soft-panel interactive-surface flex flex-col gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
              key={checklist.id}
              onClick={() => openExisting(checklist)}
              style={{ background: hexToRgba(checklist.color, 0.1) }}
              type="button"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-lg"
                  style={{ background: hexToRgba(checklist.color, 0.2) }}
                >
                  {checklist.icon ? checklist.icon : <ListChecks className="size-5" style={{ color: checklist.color }} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-950">{checklist.name}</p>
                  <p className="text-xs text-ink-500">
                    {checklist.totalCount === 0
                      ? "Liste vide"
                      : `${checklist.checkedCount}/${checklist.totalCount} fait${checklist.checkedCount > 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>

              {checklist.totalCount > 0 ? (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: checklist.color }}
                  />
                </div>
              ) : null}

              {checklist.taskTitle ? (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-[0.65rem] font-semibold text-ink-600">
                  <Link2 className="size-3" /> {checklist.taskTitle}
                </span>
              ) : null}
            </button>
          );
        })}

        <button
          className="flex min-h-[5rem] items-center justify-center gap-2 rounded-[1.4rem] border-2 border-dashed border-line text-sm font-semibold text-ink-600 transition-colors hover:border-coral-500/40 hover:text-coral-600"
          onClick={openNew}
          type="button"
        >
          <Plus className="size-5" /> Nouvelle liste
        </button>
      </div>

      {editorOpen ? (
        <ChecklistEditor
          checklist={editing}
          householdId={householdId}
          isOpen={editorOpen}
          onChange={onChange}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
          onDeleted={onDeleted}
          tasks={tasks}
        />
      ) : null}
    </div>
  );
}
