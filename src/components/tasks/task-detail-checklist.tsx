"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ListChecks, RotateCcw } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { postForm } from "@/lib/api-client";
import type { SerializedChecklist } from "@/lib/aide-memoire";
import { cn } from "@/lib/utils";

type TaskDetailChecklistProps = {
  taskTemplateId: string;
  active: boolean;
};

export function TaskDetailChecklist({ taskTemplateId, active }: TaskDetailChecklistProps) {
  const { error: showError, success } = useToast();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<SerializedChecklist[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (!active || fetched.current) return;
    fetched.current = true;
    fetch(`/api/tasks/${taskTemplateId}/checklist`)
      .then((r) => r.json())
      .then((data: { householdId: string; checklists: SerializedChecklist[] }) => {
        setHouseholdId(data.householdId);
        setChecklists(data.checklists ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [active, taskTemplateId]);

  function replace(updated: SerializedChecklist) {
    setChecklists((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function toggleItem(checklistId: string, itemId: string) {
    if (!householdId) return;
    setBusy(true);
    try {
      const res = await postForm(
        `/api/households/${householdId}/checklists/${checklistId}/items/${itemId}`,
        { _action: "toggle" },
      );
      const json = (await res.json()) as { checklist: SerializedChecklist };
      replace(json.checklist);
    } catch {
      showError("Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function resetChecklist(checklistId: string) {
    if (!householdId) return;
    setBusy(true);
    try {
      const res = await postForm(`/api/households/${householdId}/checklists/${checklistId}`, {
        _action: "reset",
      });
      const json = (await res.json()) as { checklist: SerializedChecklist };
      replace(json.checklist);
      success("Liste réinitialisée.");
    } catch {
      showError("Réinitialisation impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!active) return null;

  if (loaded && checklists.length === 0) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-ink-500">Aucune checklist liée à cette tâche.</p>
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600"
          href={householdId ? `/app/aide-memoire?household=${householdId}` : "/app/aide-memoire"}
        >
          <ListChecks className="size-4" /> Créer ou lier une liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {checklists.map((checklist) => (
        <div className="rounded-2xl border border-line p-3" key={checklist.id}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-semibold text-ink-950">{checklist.name}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-500">
                {checklist.checkedCount}/{checklist.totalCount}
              </span>
              {checklist.checkedCount > 0 ? (
                <button
                  aria-label="Réinitialiser la liste"
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-sky-600 transition-colors hover:bg-sky-500/10 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => resetChecklist(checklist.id)}
                  type="button"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
          {checklist.items.length === 0 ? (
            <p className="text-xs text-ink-500">Liste vide.</p>
          ) : (
            <ul className="space-y-1" aria-live="polite">
              {checklist.items.map((item) => (
                <li key={item.id}>
                  <button
                    aria-pressed={item.isChecked}
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-black/[0.03] disabled:opacity-50"
                    disabled={busy}
                    onClick={() => toggleItem(checklist.id, item.id)}
                    type="button"
                  >
                    {item.isChecked ? (
                      <CheckCircle2 className="size-5 shrink-0 text-leaf-600" />
                    ) : (
                      <Circle className="size-5 shrink-0 text-ink-400" />
                    )}
                    <span className={cn("text-sm", item.isChecked ? "text-ink-400 line-through" : "text-ink-900")}>
                      {item.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
