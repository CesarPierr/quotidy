"use client";

import { useState, type FormEvent } from "react";

import { useToast } from "@/components/ui/toast";
import { roomSuggestions, taskPalette } from "@/lib/constants";
import { formatDateInput } from "@/lib/date-input";
import { AVAILABLE_ICONS } from "@/lib/room-icons";
import { cn } from "@/lib/utils";

export type TaskTemplateEditable = {
  id: string;
  title: string;
  estimatedMinutes: number;
  category: string | null;
  room: string | null;
  color: string | null;
  startsOn: Date | string;
  endsOn?: Date | string | null;
  recurrenceRule: {
    type: "daily" | "every_x_days" | "weekly" | "every_x_weeks" | "monthly_simple";
    interval: number;
    weekdays: unknown;
    dayOfMonth: number | null;
    mode: "FIXED" | "SLIDING";
    anchorDate: Date | string;
    dueOffsetDays: number;
    config?: unknown;
  };
  icon?: string | null;
  assignmentRule: {
    mode:
      | "fixed"
      | "manual"
      | "strict_alternation"
      | "round_robin"
      | "least_assigned_count"
      | "least_assigned_minutes";
    eligibleMemberIds: unknown;
  };
};

function isSingleRunTask(task: TaskTemplateEditable): boolean {
  const config = task.recurrenceRule.config;
  if (config && typeof config === "object" && !Array.isArray(config) && "singleRun" in config) {
    return (config as { singleRun?: unknown }).singleRun === true;
  }
  if (!task.endsOn) return false;
  return new Date(task.endsOn).toDateString() === new Date(task.startsOn).toDateString();
}

type Props = {
  task: TaskTemplateEditable;
  householdId: string;
  onCancel: () => void;
  onSuccess: () => void;
};

export function TaskTemplateEditForm({ task, householdId, onCancel, onSuccess }: Props) {
  const { success, error: showError } = useToast();
  const [recurrenceType, setRecurrenceType] = useState<string>(
    isSingleRunTask(task) ? "single" : task.recurrenceRule.type,
  );
  const [selectedIcon, setSelectedIcon] = useState<string>(task.icon ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const csrf = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/)?.[1] ?? "";
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
          "x-requested-with": "fetch",
          ...(csrf ? { "x-csrf-token": csrf } : {}),
        },
      });
      if (!res.ok && !res.redirected) throw new Error(`HTTP ${res.status}`);
      success("Tâche modifiée.");
      onSuccess();
    } catch {
      showError("Erreur lors de la modification de la tâche.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const startsOnIso = formatDateInput(new Date(task.startsOn));

  return (
    <form className="compact-form-grid" onSubmit={handleSubmit}>
      <input type="hidden" name="_method" value="PUT" />
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="singleRun" value={recurrenceType === "single" ? "on" : ""} />
      <input
        type="hidden"
        name="endsOn"
        value={recurrenceType === "single" ? startsOnIso : ""}
      />
      <input type="hidden" name="icon" value={selectedIcon} />
      {Array.isArray(task.assignmentRule.eligibleMemberIds) &&
        task.assignmentRule.eligibleMemberIds.map((memberId: unknown) => (
          <input key={String(memberId)} type="hidden" name="eligibleMemberIds" value={String(memberId)} />
        ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          <span>Titre</span>
          <input className="field" type="text" name="title" defaultValue={task.title} required />
        </label>
        <label className="field-label">
          <span>Durée (min)</span>
          <input
            className="field"
            type="number"
            min="1"
            name="estimatedMinutes"
            defaultValue={task.estimatedMinutes}
            required
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
        <label className="field-label">
          <span>Catégorie</span>
          <input className="field" type="text" name="category" defaultValue={task.category ?? ""} />
        </label>
        <label className="field-label">
          <span>Pièce</span>
          <input
            className="field"
            type="text"
            name="room"
            list="task-room-suggestions"
            defaultValue={task.room ?? ""}
          />
        </label>
      </div>
      <datalist id="task-room-suggestions">
        {roomSuggestions.map((room) => (
          <option key={room} value={room} />
        ))}
      </datalist>

      <div className="mt-4 field-label">
        <span>Icône (optionnel)</span>
        <div className="flex flex-wrap gap-2 overflow-y-auto max-h-40 rounded-2xl border border-line bg-white/50 dark:bg-surface/50 p-3">
          <button
            className={cn(
              "flex size-10 items-center justify-center rounded-lg border-2 transition-all",
              selectedIcon === "" ? "border-coral-500 bg-[var(--coral-50)]" : "border-transparent hover:bg-black/5"
            )}
            onClick={() => setSelectedIcon("")}
            title="Utiliser l'icône par défaut de la pièce"
            type="button"
          >
            <div className="size-5 opacity-40 flex items-center justify-center">?</div>
          </button>
          {Object.entries(AVAILABLE_ICONS).map(([name, IconComponent]) => (
            <button
              key={name}
              className={cn(
                "flex size-10 items-center justify-center rounded-lg border-2 transition-all",
                selectedIcon === name ? "border-coral-500 bg-[var(--coral-50)]" : "border-transparent hover:bg-black/5"
              )}
              onClick={() => setSelectedIcon(name)}
              title={name}
              type="button"
            >
              <IconComponent className="size-5" />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-ink-950">Couleur</span>
        <input
          className="size-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
          type="color"
          name="color"
          defaultValue={task.color ?? taskPalette[0]}
        />
        <div className="flex flex-wrap gap-1.5">
          {taskPalette.slice(0, 4).map((color) => (
            <span
              key={color}
              className="size-5 rounded-full border border-black/10"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-line bg-white/60 dark:bg-surface/60 p-4">
        <p className="text-sm font-bold uppercase tracking-wider text-ink-950">Planification</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            <span>Date de référence</span>
            <input
              className="field"
              type="date"
              name="startsOn"
              defaultValue={startsOnIso}
              required
            />
          </label>
          <label className="field-label">
            <span>Répétition</span>
            <select
              className="field"
              name="recurrenceType"
              onChange={(event) => setRecurrenceType(event.currentTarget.value)}
              value={recurrenceType}
            >
              <option value="single">Une seule fois</option>
              <option value="daily">Tous les jours</option>
              <option value="every_x_days">Tous les X jours</option>
              <option value="weekly">Chaque semaine</option>
              <option value="every_x_weeks">Toutes les X semaines</option>
              <option value="monthly_simple">Chaque mois</option>
            </select>
          </label>
          {recurrenceType === "single" ? (
            <input type="hidden" name="interval" value="1" />
          ) : (
            <label className="field-label">
              <span>Intervalle (X)</span>
              <input
                className="field"
                type="number"
                min="1"
                name="interval"
                defaultValue={task.recurrenceRule.interval}
                required
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
          )}
          <label className="field-label">
            <span>Mode</span>
            <select
              className="field"
              name="recurrenceMode"
              defaultValue={task.recurrenceRule.mode}
            >
              <option value="SLIDING">Glissant (Auto-décalage)</option>
              <option value="FIXED">Fixe (Ancré au calendrier)</option>
            </select>
          </label>
          <label className="field-label">
            <span>Attribution</span>
            <select className="field" name="assignmentMode" defaultValue={task.assignmentRule.mode}>
              <option value="fixed">Fixe</option>
              <option value="manual">Manuelle</option>
              <option value="strict_alternation">Alternance</option>
              <option value="round_robin">Round-robin</option>
              <option value="least_assigned_count">Équité (nombre)</option>
              <option value="least_assigned_minutes">Équité (minutes)</option>
            </select>
          </label>
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 transition-colors hover:bg-blue-100">
        <input name="forceOverwriteManual" type="checkbox" className="mt-1" />
        <span className="text-sm leading-tight text-blue-900">
          <strong>Réinitialiser les occurrences :</strong> écraser les modifications manuelles avec ces
          nouveaux réglages.
        </span>
      </label>

      <div className="mt-6 flex justify-end gap-3">
        <button
          className="btn-secondary px-5 py-2.5 font-semibold"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Annuler
        </button>
        <button className="btn-primary px-5 py-2.5 font-semibold" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
