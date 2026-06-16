"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Coffee,
  History,
  MessageSquare,
  Pencil,
  RotateCcw,
  SkipForward,
  Sunrise,
  Users,
} from "lucide-react";

import { BottomSheetAction } from "@/components/ui/bottom-sheet";
import { formatRelative } from "@/lib/relative-date";
import { formatMinutes } from "@/lib/utils";

type Mode = "main" | "complete-details" | "reschedule" | "reassign" | "skip-note";

type Occurrence = {
  id: string;
  scheduledDate: Date | string;
  status: string;
  notes: string | null;
  actualMinutes: number | null;
  isManuallyModified?: boolean;
  taskTemplate: {
    title: string;
    room?: string | null;
    estimatedMinutes: number;
    isCollective?: boolean;
  };
  assignedMember: { id: string; displayName: string } | null;
};

export type TaskDetailOccurrenceProps = {
  occurrence: Occurrence;
  members: { id: string; displayName: string }[];
  canEditOccurrence: boolean;
  canEditTemplate: boolean;
  archived: boolean;
  statusLabel: string;
  isSubmitting: boolean;
  householdId?: string;
  taskTemplateId?: string;
  onSubmit: (url: string, body?: Record<string, string>) => void;
  onSetTab: (tab: "template" | "history" | "comments") => void;
  active: boolean;
};

export function TaskDetailOccurrence({
  occurrence,
  members,
  canEditOccurrence,
  canEditTemplate,
  archived,
  statusLabel,
  isSubmitting,
  householdId,
  taskTemplateId,
  onSubmit,
  onSetTab,
  active,
}: TaskDetailOccurrenceProps) {
  const [mode, setMode] = useState<Mode>("main");

  if (!active) {
    // Reset mode when hidden
    if (mode !== "main") setMode("main");
    return null;
  }

  const scheduledDate =
    occurrence.scheduledDate instanceof Date ? occurrence.scheduledDate : new Date(occurrence.scheduledDate);

  function backToMain() {
    setMode("main");
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="rounded-[1.3rem] border border-line bg-white/70 dark:bg-surface/70 p-4">
        <p className="section-kicker">À faire</p>
        <h3 className="mt-2 text-xl font-semibold text-ink-950">{occurrence.taskTemplate.title}</h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-700">
          {occurrence.taskTemplate.room ? (
            <span className="stat-pill px-3 py-1 font-semibold">{occurrence.taskTemplate.room}</span>
          ) : null}
          <span className="stat-pill px-3 py-1 font-semibold">
            {formatMinutes(occurrence.taskTemplate.estimatedMinutes)}
          </span>
          <span className="stat-pill px-3 py-1 font-semibold">{statusLabel}</span>
          {occurrence.assignedMember ? (
            <span className="stat-pill px-3 py-1 font-semibold">{occurrence.assignedMember.displayName}</span>
          ) : null}
          {occurrence.actualMinutes !== null ? (
            <span className="stat-pill px-3 py-1 font-semibold">
              Réel {formatMinutes(occurrence.actualMinutes)}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-6 text-ink-700">
          Prévue {formatRelative(scheduledDate, { style: "long" })}{" "}
          <span className="text-ink-500">
            ({format(scheduledDate, "EEEE d MMMM", { locale: fr })})
          </span>
        </p>
        {occurrence.notes ? (
          <p className="mt-2 text-sm leading-6 text-ink-700">{occurrence.notes}</p>
        ) : null}
        {occurrence.isManuallyModified ? (
          <p className="mt-2 text-sm font-medium text-coral-600">
            Cette tâche a déjà été ajustée à la main.
          </p>
        ) : null}
      </div>

      {/* Mode body */}
      {mode === "main" ? (
        <div className="space-y-2">
          {canEditOccurrence && !archived ? (
            <>
              <button
                className="btn-primary w-full px-4 py-3 text-sm font-semibold disabled:opacity-50"
                disabled={isSubmitting}
                onClick={() => onSubmit(`/api/occurrences/${occurrence.id}/complete`)}
                type="button"
              >
                Terminer
              </button>
              <BottomSheetAction
                icon={CheckCircle2}
                label="Terminer avec détails"
                hint="Minutes réelles, note, options"
                variant="success"
                onClick={() => setMode("complete-details")}
              />
              <BottomSheetAction
                icon={Calendar}
                label="Faire plus tard"
                hint="Choisir une nouvelle date"
                onClick={() => setMode("reschedule")}
              />
              <BottomSheetAction
                icon={Users}
                label="Changer la personne"
                hint="Confier à quelqu'un d'autre"
                onClick={() => setMode("reassign")}
              />
              <BottomSheetAction
                icon={SkipForward}
                label="Passer avec une note"
                hint="Ne pas la faire cette fois"
                onClick={() => setMode("skip-note")}
              />
            </>
          ) : null}

          {canEditOccurrence && archived ? (
            <button
              className="btn-secondary w-full px-4 py-3 text-sm font-semibold disabled:opacity-50"
              disabled={isSubmitting}
              onClick={() => onSubmit(`/api/occurrences/${occurrence.id}/reopen`)}
              type="button"
            >
              <RotateCcw className="mr-2 inline size-4" />
              Remettre à faire
            </button>
          ) : null}

          {canEditTemplate && householdId && taskTemplateId ? (
            <BottomSheetAction
              icon={Pencil}
              label="Modifier le modèle"
              hint="Récurrence, titre, attribution"
              onClick={() => onSetTab("template")}
            />
          ) : null}
          {taskTemplateId ? (
            <BottomSheetAction
              icon={History}
              label="Historique de la tâche"
              hint="Les dernières exécutions"
              onClick={() => onSetTab("history")}
            />
          ) : null}
          <BottomSheetAction
            icon={MessageSquare}
            label="Commentaires"
            hint="Voir ou ajouter un message"
            onClick={() => onSetTab("comments")}
          />
        </div>
      ) : null}

      {mode === "complete-details" ? (
        <form
          className="space-y-3 rounded-[1.3rem] border border-line bg-white/70 dark:bg-surface/70 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const body: Record<string, string> = {};
            const actualMinutes = formData.get("actualMinutes") as string;
            const notes = formData.get("notes") as string;
            if (actualMinutes) body.actualMinutes = actualMinutes;
            if (notes) body.notes = notes;
            if (formData.get("wasCompletedAlone")) body.wasCompletedAlone = "on";
            onSubmit(`/api/occurrences/${occurrence.id}/complete`, body);
          }}
        >
          <button type="button" onClick={backToMain} className="text-xs font-semibold text-ink-500 inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" /> Retour
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              <span>Minutes réelles</span>
              <input
                className="field"
                defaultValue={occurrence.actualMinutes ?? ""}
                min="0"
                name="actualMinutes"
                placeholder="Ex: 15"
                type="number"
              />
            </label>
            <label className="field-label">
              <span>Note</span>
              <input
                className="field"
                defaultValue={occurrence.notes ?? ""}
                name="notes"
                placeholder="Optionnel"
                type="text"
              />
            </label>
          </div>
          <p className="rounded-xl border border-line bg-white/70 dark:bg-surface/70 px-3 py-2.5 text-xs leading-5 text-ink-500">
            Le calendrier suivant est automatiquement réaligné depuis aujourd&apos;hui.
          </p>
          {occurrence.taskTemplate.isCollective ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white/70 dark:bg-surface/70 px-3 py-2.5 text-xs font-medium text-ink-700">
              <input name="wasCompletedAlone" type="checkbox" />
              J&apos;ai fait cette tâche collective seul(e)
            </label>
          ) : null}
          <button className="btn-primary w-full px-4 py-3 text-sm font-semibold disabled:opacity-50" disabled={isSubmitting} type="submit">
            Enregistrer
          </button>
        </form>
      ) : null}

      {mode === "reschedule" ? (
        <div className="space-y-3 rounded-[1.3rem] border border-line bg-white/70 dark:bg-surface/70 p-4">
          <button type="button" onClick={backToMain} className="text-xs font-semibold text-ink-500 inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" /> Retour
          </button>

          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-500">
            Reporter rapidement à
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              { id: "tomorrow", label: "Demain", icon: Sunrise },
              { id: "after-tomorrow", label: "Après-demain", icon: null },
              { id: "weekend", label: "Week-end", icon: Coffee },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white/70 dark:bg-surface/70 px-3 py-2.5 text-sm font-semibold text-ink-700 transition-all hover:bg-white dark:bg-surface active:scale-[0.98] disabled:opacity-40"
                disabled={isSubmitting}
                onClick={() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const date = new Date(today);
                  if (id === "tomorrow") {
                    date.setDate(date.getDate() + 1);
                  } else if (id === "after-tomorrow") {
                    date.setDate(date.getDate() + 2);
                  } else {
                    const dayOfWeek = today.getDay();
                    const daysUntilSat = ((6 - dayOfWeek + 7) % 7) || 7;
                    date.setDate(date.getDate() + daysUntilSat);
                  }
                  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  onSubmit(`/api/occurrences/${occurrence.id}/reschedule`, { date: iso });
                }}
                type="button"
              >
                {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
                {label}
              </button>
            ))}
          </div>

          <form
            className="space-y-2 pt-2 border-t border-line"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const date = formData.get("date") as string;
              if (date) onSubmit(`/api/occurrences/${occurrence.id}/reschedule`, { date });
            }}
          >
            <label className="field-label">
              <span>Ou choisissez une date</span>
              <input className="field" name="date" required type="date" />
            </label>
            <button className="btn-primary w-full px-4 py-3 text-sm font-semibold disabled:opacity-50" disabled={isSubmitting} type="submit">
              Changer la date
            </button>
          </form>
        </div>
      ) : null}

      {mode === "reassign" ? (
        <div className="space-y-2 rounded-[1.3rem] border border-line bg-white/70 dark:bg-surface/70 p-4">
          <button type="button" onClick={backToMain} className="text-xs font-semibold text-ink-500 inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" /> Retour
          </button>
          {members.map((member) => (
            <button
              key={member.id}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white/70 dark:bg-surface/70 px-4 py-3 text-left text-sm font-semibold transition-all hover:bg-black/[0.04] active:scale-[0.98] disabled:opacity-50"
              disabled={isSubmitting}
              onClick={() => onSubmit(`/api/occurrences/${occurrence.id}/reassign`, { assignedMemberId: member.id })}
              type="button"
            >
              {member.displayName}
              {occurrence.assignedMember?.id === member.id ? (
                <span className="ml-auto rounded-full bg-leaf-500 px-2 py-0.5 text-[0.6rem] font-bold text-white">Actuel</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {mode === "skip-note" ? (
        <form
          className="space-y-3 rounded-[1.3rem] border border-line bg-white/70 dark:bg-surface/70 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const notes = (formData.get("notes") as string) ?? "";
            onSubmit(`/api/occurrences/${occurrence.id}/skip`, notes ? { notes } : undefined);
          }}
        >
          <button type="button" onClick={backToMain} className="text-xs font-semibold text-ink-500 inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" /> Retour
          </button>
          <label className="field-label">
            <span>Raison (facultatif)</span>
            <input className="field" name="notes" placeholder="Pourquoi sauter ?" type="text" />
          </label>
          <button className="btn-primary w-full px-4 py-3 text-sm font-semibold disabled:opacity-50" disabled={isSubmitting} type="submit">
            Passer cette tâche
          </button>
        </form>
      ) : null}
    </div>
  );
}
