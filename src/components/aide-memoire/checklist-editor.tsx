"use client";

import { useState, type FormEvent } from "react";
import {
  ChevronDown,
  ChevronUp,
  Circle,
  CheckCircle2,
  Link2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { postForm } from "@/lib/api-client";
import type { SerializedChecklist } from "@/lib/aide-memoire";
import { taskPalette } from "@/lib/constants";
import { cn } from "@/lib/utils";

type TaskOption = { id: string; title: string };

type ChecklistEditorProps = {
  householdId: string;
  checklist: SerializedChecklist | null;
  tasks: TaskOption[];
  isOpen: boolean;
  onClose: () => void;
  onChange: (checklist: SerializedChecklist) => void;
  onDeleted: (id: string) => void;
};

export function ChecklistEditor({
  householdId,
  checklist,
  tasks,
  isOpen,
  onClose,
  onChange,
  onDeleted,
}: ChecklistEditorProps) {
  const { error: showError, success } = useToast();
  const [current, setCurrent] = useState<SerializedChecklist | null>(checklist);
  const [name, setName] = useState(checklist?.name ?? "");
  const [color, setColor] = useState(checklist?.color ?? "#D8643D");
  const [taskTemplateId, setTaskTemplateId] = useState(checklist?.taskTemplateId ?? "");
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const base = current ? `/api/households/${householdId}/checklists/${current.id}` : "";

  function apply(updated: SerializedChecklist) {
    setCurrent(updated);
    onChange(updated);
  }

  async function createChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const response = await postForm(`/api/households/${householdId}/checklists`, {
        name: name.trim(),
        color,
        taskTemplateId,
      });
      const json = (await response.json()) as { checklist: SerializedChecklist };
      apply(json.checklist);
    } catch {
      showError("Impossible de créer la liste.");
    } finally {
      setBusy(false);
    }
  }

  async function updateChecklist(data: Record<string, string>) {
    if (!current) return;
    setBusy(true);
    try {
      const response = await postForm(base, { _action: "update", ...data });
      const json = (await response.json()) as { checklist: SerializedChecklist };
      apply(json.checklist);
    } catch {
      showError("Modification impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function itemAction(itemId: string, action: string, extra?: Record<string, string>) {
    if (!current) return;
    setBusy(true);
    try {
      const response = await postForm(`${base}/items/${itemId}`, { _action: action, ...extra });
      const json = (await response.json()) as { checklist: SerializedChecklist };
      apply(json.checklist);
    } catch {
      showError("Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current || !newItem.trim() || busy) return;
    setBusy(true);
    try {
      const response = await postForm(`${base}/items`, { label: newItem.trim() });
      const json = (await response.json()) as { checklist: SerializedChecklist };
      apply(json.checklist);
      setNewItem("");
    } catch {
      showError("Impossible d'ajouter l'élément.");
    } finally {
      setBusy(false);
    }
  }

  async function resetChecklist() {
    if (!current) return;
    setBusy(true);
    try {
      const response = await postForm(base, { _action: "reset" });
      const json = (await response.json()) as { checklist: SerializedChecklist };
      apply(json.checklist);
      success("Liste réinitialisée.");
    } catch {
      showError("Réinitialisation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteChecklist() {
    if (!current) return;
    setBusy(true);
    try {
      await postForm(base, { _action: "delete" });
      onDeleted(current.id);
      success("Liste supprimée.");
      setConfirmDelete(false);
      onClose();
    } catch {
      showError("Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={current ? current.name : "Nouvelle liste"}
    >
      {!current ? (
        // ── Create form ───────────────────────────────────────────────
        <form className="space-y-4" onSubmit={createChecklist}>
          <label className="field-label">
            <span>Nom de la liste</span>
            <input
              autoFocus
              className="field"
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Sac pour le trek"
              type="text"
              value={name}
            />
          </label>
          <div className="field-label">
            <span>Couleur</span>
            <div className="flex flex-wrap gap-2">
              {taskPalette.slice(0, 10).map((c) => (
                <button
                  aria-label={`Couleur ${c}`}
                  aria-pressed={color === c}
                  className={cn(
                    "size-8 rounded-full transition-transform",
                    color === c ? "scale-110 ring-2 ring-offset-2 ring-ink-950/30" : "hover:scale-105",
                  )}
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  type="button"
                />
              ))}
            </div>
          </div>
          {tasks.length > 0 ? (
            <label className="field-label">
              <span>Tâche liée (facultatif)</span>
              <select
                className="field"
                onChange={(e) => setTaskTemplateId(e.target.value)}
                value={taskTemplateId}
              >
                <option value="">Aucune tâche liée</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            className="btn-primary w-full px-5 py-3 text-sm font-semibold disabled:opacity-50"
            disabled={!name.trim() || busy}
            type="submit"
          >
            Créer la liste
          </button>
        </form>
      ) : (
        // ── Item editor ───────────────────────────────────────────────
        <div className="space-y-4">
          {/* Header fields */}
          <div className="space-y-3 rounded-2xl border border-line bg-white/50 p-3 dark:bg-white/[0.03]">
            <label className="field-label">
              <span>Nom</span>
              <input
                className="field"
                defaultValue={current.name}
                maxLength={80}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== current.name) updateChecklist({ name: v });
                }}
                type="text"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {taskPalette.slice(0, 10).map((c) => (
                <button
                  aria-label={`Couleur ${c}`}
                  aria-pressed={current.color === c}
                  className={cn(
                    "size-7 rounded-full transition-transform",
                    current.color === c ? "scale-110 ring-2 ring-offset-2 ring-ink-950/30" : "hover:scale-105",
                  )}
                  key={c}
                  onClick={() => updateChecklist({ color: c })}
                  style={{ backgroundColor: c }}
                  type="button"
                />
              ))}
            </div>
            {tasks.length > 0 ? (
              <label className="field-label">
                <span className="flex items-center gap-1.5">
                  <Link2 className="size-3.5" /> Tâche liée
                </span>
                <select
                  className="field"
                  onChange={(e) => updateChecklist({ taskTemplateId: e.target.value })}
                  value={current.taskTemplateId ?? ""}
                >
                  <option value="">Aucune tâche liée</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {/* Progress */}
          <div className="flex items-center justify-between px-1 text-sm">
            <span className="font-semibold text-ink-700">
              {current.checkedCount}/{current.totalCount} fait
              {current.checkedCount > 1 ? "s" : ""}
            </span>
            {current.checkedCount > 0 ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-sky-600 transition-colors hover:bg-sky-500/10 disabled:opacity-50"
                disabled={busy}
                onClick={resetChecklist}
                type="button"
              >
                <RotateCcw className="size-3.5" /> Réinitialiser
              </button>
            ) : null}
          </div>

          {/* Items */}
          {current.items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink-500">
              Ajoutez les éléments à ne pas oublier.
            </p>
          ) : (
            <ul className="space-y-1.5" aria-label="Éléments de la liste" aria-live="polite">
              {current.items.map((item, index) => (
                <li
                  className="flex items-center gap-2 rounded-2xl border border-line bg-white/50 px-2 py-1.5 dark:bg-white/[0.03]"
                  key={item.id}
                >
                  <button
                    aria-label={item.isChecked ? "Décocher" : "Cocher"}
                    aria-pressed={item.isChecked}
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50",
                      item.isChecked ? "text-leaf-600" : "text-ink-400 hover:text-ink-700",
                    )}
                    disabled={busy}
                    onClick={() => itemAction(item.id, "toggle")}
                    type="button"
                  >
                    {item.isChecked ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                  </button>
                  <span
                    className={cn(
                      "min-w-0 flex-1 break-words text-sm",
                      item.isChecked ? "text-ink-400 line-through" : "text-ink-900",
                    )}
                  >
                    {item.label}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      aria-label="Monter"
                      className="flex size-11 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-black/[0.05] hover:text-ink-700 disabled:opacity-30"
                      disabled={busy || index === 0}
                      onClick={() => itemAction(item.id, "move", { direction: "up" })}
                      type="button"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      aria-label="Descendre"
                      className="flex size-11 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-black/[0.05] hover:text-ink-700 disabled:opacity-30"
                      disabled={busy || index === current.items.length - 1}
                      onClick={() => itemAction(item.id, "move", { direction: "down" })}
                      type="button"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                    <button
                      aria-label="Supprimer l'élément"
                      className="ml-0.5 flex size-11 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      disabled={busy}
                      onClick={() => itemAction(item.id, "delete")}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Add item */}
          <form className="flex items-center gap-2" onSubmit={addItem}>
            <input
              aria-label="Nouvel élément"
              className="field h-11 flex-1"
              maxLength={200}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Ajouter un élément…"
              type="text"
              value={newItem}
            />
            <button
              aria-label="Ajouter l'élément"
              className="btn-primary inline-flex size-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
              disabled={!newItem.trim() || busy}
              type="submit"
            >
              <Plus className="size-5" />
            </button>
          </form>

          {/* Danger zone */}
          <div className="flex justify-end pt-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
              type="button"
            >
              <Trash2 className="size-4" /> Supprimer la liste
            </button>
          </div>

          <Dialog
            isOpen={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            title="Supprimer cette liste ?"
            type="danger"
            footer={
              <>
                <button className="btn-quiet px-4 py-2.5 text-sm font-semibold" onClick={() => setConfirmDelete(false)} type="button">
                  Annuler
                </button>
                <button
                  className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  disabled={busy}
                  onClick={deleteChecklist}
                  type="button"
                >
                  Supprimer
                </button>
              </>
            }
          >
            <p className="text-sm text-ink-700">
              « {current.name} » et tous ses éléments seront définitivement supprimés.
            </p>
          </Dialog>
        </div>
      )}
    </BottomSheet>
  );
}
