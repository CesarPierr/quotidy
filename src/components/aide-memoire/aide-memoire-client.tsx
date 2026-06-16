"use client";

import { useState } from "react";
import { ListChecks, NotebookPen } from "lucide-react";

import { ChecklistList } from "@/components/aide-memoire/checklist-list";
import { NotesBoard } from "@/components/aide-memoire/notes-board";
import { useToast } from "@/components/ui/toast";
import { postForm } from "@/lib/api-client";
import type { SerializedChecklist, SerializedNote } from "@/lib/aide-memoire";

type TaskOption = { id: string; title: string };

type AideMemoireClientProps = {
  householdId: string;
  activeNotes: SerializedNote[];
  doneNotes: SerializedNote[];
  retentionDays: number;
  checklists: SerializedChecklist[];
  tasks: TaskOption[];
};

const RETENTION_OPTIONS = [1, 3, 7, 14, 30];

function RetentionControl({ householdId, value }: { householdId: string; value: number }) {
  const { error: showError, success } = useToast();
  const [days, setDays] = useState(value);
  const [saving, setSaving] = useState(false);

  async function change(next: number) {
    setDays(next);
    setSaving(true);
    try {
      await postForm(`/api/households/${householdId}/notes`, {
        _action: "retention",
        noteRetentionDays: String(next),
      });
      success("Durée de conservation mise à jour.");
    } catch {
      showError("Réglage impossible.");
      setDays(value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex items-center gap-2 text-xs text-ink-500">
      <span className="hidden sm:inline">Conserver les notes faites</span>
      <select
        aria-label="Durée de conservation des notes faites"
        className="rounded-full border border-line bg-white/70 px-2.5 py-1 text-xs font-semibold text-ink-700 dark:bg-white/[0.05]"
        disabled={saving}
        onChange={(e) => change(Number(e.target.value))}
        value={days}
      >
        {RETENTION_OPTIONS.map((d) => (
          <option key={d} value={d}>
            {d} jour{d > 1 ? "s" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AideMemoireClient({
  householdId,
  activeNotes,
  doneNotes,
  retentionDays,
  checklists,
  tasks,
}: AideMemoireClientProps) {
  return (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="px-1">
        <h2 className="display-title text-3xl leading-tight sm:text-4xl">Aide-mémoire</h2>
        <p className="mt-1 text-sm font-medium text-ink-500">
          Les rappels du foyer et vos listes réutilisables, au même endroit.
        </p>
      </header>

      {/* Notes */}
      <article className="app-surface rounded-[2rem] p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-[rgba(216,100,61,0.12)] text-coral-600">
              <NotebookPen className="size-5" />
            </span>
            <div>
              <h3 className="display-title text-xl leading-none">Notes du foyer</h3>
              <p className="mt-1 text-xs text-ink-500">Rappels rapides, à usage unique.</p>
            </div>
          </div>
          <RetentionControl householdId={householdId} value={retentionDays} />
        </div>
        <NotesBoard
          householdId={householdId}
          initialActive={activeNotes}
          initialDone={doneNotes}
          retentionDays={retentionDays}
        />
      </article>

      {/* Checklists */}
      <article className="app-surface rounded-[2rem] p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-[rgba(47,109,136,0.12)] text-sky-600">
            <ListChecks className="size-5" />
          </span>
          <div>
            <h3 className="display-title text-xl leading-none">Listes</h3>
            <p className="mt-1 text-xs text-ink-500">Modèles réutilisables — cochez, puis réinitialisez.</p>
          </div>
        </div>
        <ChecklistList householdId={householdId} initialChecklists={checklists} tasks={tasks} />
      </article>
    </section>
  );
}
