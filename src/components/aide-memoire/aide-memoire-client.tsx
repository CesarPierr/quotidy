"use client";

import { useState } from "react";
import { ListChecks, NotebookPen } from "lucide-react";

import { ChecklistList } from "@/components/aide-memoire/checklist-list";
import { NotesBoard } from "@/components/aide-memoire/notes-board";
import { useToast } from "@/components/ui/toast";
import { postForm } from "@/lib/api-client";
import type { SerializedChecklist, SerializedNote } from "@/lib/aide-memoire";
import { cn } from "@/lib/utils";

type TaskOption = { id: string; title: string };
type Tab = "todo" | "checklist";

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
      <span className="hidden sm:inline">Conserver les faites</span>
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
  const [tab, setTab] = useState<Tab>("todo");

  const tabs = [
    { id: "todo" as const, label: "À faire", icon: NotebookPen, count: activeNotes.length },
    { id: "checklist" as const, label: "Checklist", icon: ListChecks, count: checklists.length },
  ];

  return (
    <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="px-1">
        <p className="section-kicker">Aide-mémoire</p>
        <h2 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">À ne pas oublier</h2>
        <p className="mt-1 text-sm text-ink-500">Vos rappels du foyer et vos checklists réutilisables.</p>
      </header>

      {/* Segmented menu — pick a box */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-white/60 p-1 dark:bg-surface/60">
        {tabs.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all active:scale-[0.98]",
                active ? "bg-white text-ink-950 shadow-sm dark:bg-surface" : "text-ink-500 hover:text-ink-800",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t.label}
              {t.count > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums",
                    active ? "bg-coral-500/15 text-coral-600" : "bg-black/[0.05] text-ink-500",
                  )}
                >
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "todo" ? (
        <article key="todo" className="app-surface rounded-[1.4rem] p-4 animate-in fade-in sm:rounded-[1.6rem] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(216,100,61,0.12)] text-coral-600">
                <NotebookPen className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="display-title text-lg leading-none">À faire</h3>
                <p className="mt-1 text-xs text-ink-500">Rappels rapides du foyer, à usage unique.</p>
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
      ) : (
        <article key="checklist" className="app-surface rounded-[1.4rem] p-4 animate-in fade-in sm:rounded-[1.6rem] sm:p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(47,109,136,0.12)] text-sky-600">
              <ListChecks className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="display-title text-lg leading-none">Checklist</h3>
              <p className="mt-1 text-xs text-ink-500">Modèles réutilisables — cochez, puis réinitialisez.</p>
            </div>
          </div>
          <ChecklistList householdId={householdId} initialChecklists={checklists} tasks={tasks} />
        </article>
      )}
    </section>
  );
}
