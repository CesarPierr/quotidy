"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition, type SyntheticEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Coffee,
  MoreHorizontal,
  RotateCcw,
  SkipForward,
  Sunrise,
} from "lucide-react";

import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { useToast } from "@/components/ui/toast";
import { classifyRelative, formatRelative } from "@/lib/relative-date";
import { getRoomIcon } from "@/lib/room-icons";
import { formatMinutes } from "@/lib/utils";

type OccurrenceCardProps = {
  occurrence: {
    id: string;
    scheduledDate: Date | string;
    status: string;
    notes: string | null;
    actualMinutes: number | null;
    isManuallyModified?: boolean;
    rescheduleCount?: number;
    taskTemplate: {
      title: string;
      category: string | null;
      room?: string | null;
      icon?: string | null;
      estimatedMinutes: number;
      color: string;
      isCollective?: boolean;
    };
    assignedMember: { id: string; displayName: string; color: string } | null;
    wasCompletedAlone?: boolean | null;
  };
  members: { id: string; displayName: string }[];
  currentMemberId?: string | null;
  compact?: boolean;
  returnTo?: string;
  householdId?: string;
  canEditTemplate?: boolean;
  taskTemplateId?: string;
};

type StatusMeta = {
  label: string;
  hint: string;
  icon: typeof CheckCircle2;
  accent: string;
  surface: string;
  border: string;
  /** When set, the card pulses softly to flag a long delay. */
  pulse?: boolean;
};

function getStatusMeta(status: string, scheduledDate: Date): StatusMeta {
  if (status === "completed") {
    return { 
      label: "Terminée", 
      hint: "Déjà faite", 
      icon: CheckCircle2, 
      accent: "var(--status-completed-accent)", 
      surface: "var(--status-completed-surface)", 
      border: "var(--status-completed-border)" 
    };
  }
  if (status === "skipped") {
    return { 
      label: "Sautée", 
      hint: "Mise de côté", 
      icon: SkipForward, 
      accent: "var(--status-skipped-accent)", 
      surface: "var(--status-skipped-surface)", 
      border: "var(--status-skipped-border)" 
    };
  }
  if (status === "rescheduled") {
    return { 
      label: "Reportée", 
      hint: "Nouvelle date", 
      icon: RotateCcw, 
      accent: "var(--status-rescheduled-accent)", 
      surface: "var(--status-rescheduled-surface)", 
      border: "var(--status-rescheduled-border)" 
    };
  }
  if (status === "overdue") {
    const cls = classifyRelative(scheduledDate);
    if (cls.kind === "very-late") {
      return {
        label: `${cls.daysLate} j de retard`,
        hint: "À rattraper en priorité",
        icon: AlertCircle,
        accent: "var(--status-overdue-accent)",
        surface: "var(--status-overdue-surface)",
        border: "var(--status-overdue-border)",
        pulse: true,
      };
    }
    return {
      label: cls.daysLate ? `${cls.daysLate} j de retard` : "En retard",
      hint: "À rattraper",
      icon: AlertCircle,
      accent: "var(--status-overdue-accent)",
      surface: "var(--status-overdue-surface)",
      border: "var(--status-overdue-border)",
    };
  }
  if (status === "due") {
    return { 
      label: "Aujourd'hui", 
      hint: "À faire maintenant", 
      icon: Clock3, 
      accent: "var(--status-due-accent)", 
      surface: "var(--status-due-surface)", 
      border: "var(--status-due-border)" 
    };
  }
  return { 
    label: "À faire", 
    hint: "Prévue à venir", 
    icon: CircleDashed, 
    accent: "var(--status-planned-accent)", 
    surface: "var(--status-planned-surface)", 
    border: "var(--status-planned-border)" 
  };
}

export function OccurrenceCard({
  occurrence,
  members,
  currentMemberId,
  compact = false,
  returnTo,
  householdId,
  canEditTemplate = false,
  taskTemplateId,
}: OccurrenceCardProps) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [isPending, startTransition] = useTransition();
  // useOptimistic syncs back to occurrence.status when the server response
  // arrives, so we don't need a manual rollback on error — React drops the
  // optimistic value once the surrounding transition resolves.
  const [optimisticStatus, applyOptimisticStatus] = useOptimistic(occurrence.status);
  const [showSheet, setShowSheet] = useState(false);

  const isSubmitting = isPending;
  const currentStatus = optimisticStatus;
  const canEditOccurrence = currentStatus !== "cancelled";
  const archived = ["completed", "skipped", "cancelled"].includes(currentStatus);
  const scheduledDate =
    occurrence.scheduledDate instanceof Date ? occurrence.scheduledDate : new Date(occurrence.scheduledDate);
  const meta = getStatusMeta(currentStatus, scheduledDate);
  const StatusIcon = meta.icon;
  const relativeLabel = formatRelative(scheduledDate);

  function stopEvent<T extends SyntheticEvent>(event: T) {
    event.stopPropagation();
  }

  function submitAction(url: string, body?: Record<string, string>) {
    if (isSubmitting) return;

    startTransition(async () => {
      if (url.endsWith("/complete")) applyOptimisticStatus("completed");
      else if (url.endsWith("/skip")) applyOptimisticStatus("skipped");
      else if (url.endsWith("/reopen")) applyOptimisticStatus("planned");

      try {
        const formData = new FormData();
        formData.set("memberId", currentMemberId ?? "");
        if (returnTo) formData.set("nextPath", returnTo);
        if (body) {
          for (const [key, value] of Object.entries(body)) {
            formData.set(key, value);
          }
        }

        const csrfToken = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/)?.[1] ?? "";
        const response = await fetch(url, {
          method: "POST",
          body: formData,
          headers: {
            Accept: "application/json",
            "x-requested-with": "fetch",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        success("Action enregistrée");
        router.refresh();
        setShowSheet(false);
      } catch {
        showError("Impossible d'effectuer cette action.");
      }
    });
  }

  const cardBg = { borderColor: meta.border, background: `linear-gradient(135deg, ${meta.surface}, var(--card-end))` };

  function quickReschedule(target: "tomorrow" | "after-tomorrow" | "weekend") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(today);
    if (target === "tomorrow") {
      date.setDate(date.getDate() + 1);
    } else if (target === "after-tomorrow") {
      date.setDate(date.getDate() + 2);
    } else {
      // Next Saturday (or this Saturday if today is before Saturday)
      const dayOfWeek = today.getDay(); // 0 Sun .. 6 Sat
      const daysUntilSat = ((6 - dayOfWeek + 7) % 7) || 7;
      date.setDate(date.getDate() + daysUntilSat);
    }
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    submitAction(`/api/occurrences/${occurrence.id}/reschedule`, { date: iso });
  }

  return (
    <>
      <article
        className={`relative overflow-hidden rounded-[1.15rem] border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] sm:rounded-[1.7rem] sm:p-5 ${meta.pulse ? "ring-2 ring-[rgba(127,29,29,0.18)] shadow-[0_8px_24px_rgba(127,29,29,0.18)]" : ""}`}
        onClick={() => setShowSheet(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setShowSheet(true);
          }
        }}
        role="button"
        style={cardBg}
        tabIndex={0}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.5 sm:h-1.5"
          style={{ backgroundColor: meta.accent }}
        />

        <div className="flex items-start gap-3 pt-1">
          <span
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full sm:size-10"
            style={{ backgroundColor: meta.surface, color: meta.accent, border: `1px solid ${meta.border}` }}
          >
            <StatusIcon className="size-3.5 sm:size-5" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-sm font-bold leading-tight sm:text-lg">
                  {occurrence.taskTemplate.title}
                  {occurrence.taskTemplate.isCollective && !archived ? (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-[rgba(47,109,136,0.12)] px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-sky-600">
                      Coll.
                    </span>
                  ) : null}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[0.68rem] text-ink-700 sm:gap-1.5 sm:text-xs">
                  {occurrence.taskTemplate.room ? (() => {
                    const RoomIcon = getRoomIcon(occurrence.taskTemplate.room, occurrence.taskTemplate.icon);
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-glass-bg px-1.5 py-0.5 font-medium sm:px-2">
                        <RoomIcon className="size-3 opacity-85" />
                        {occurrence.taskTemplate.room}
                      </span>
                    );
                  })() : null}
                  <span className="rounded-full border border-line bg-glass-bg px-1.5 py-0.5 font-medium sm:px-2">
                    {formatMinutes(occurrence.taskTemplate.estimatedMinutes)}
                  </span>
                  {occurrence.actualMinutes !== null ? (
                    <span className="rounded-full border border-line bg-glass-bg px-1.5 py-0.5 font-medium sm:px-2">
                      Réel {formatMinutes(occurrence.actualMinutes)}
                    </span>
                  ) : null}
                  {occurrence.assignedMember ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-glass-bg px-1.5 py-0.5 font-medium sm:px-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: occurrence.assignedMember.color }} />
                      {occurrence.assignedMember.displayName}
                    </span>
                  ) : null}
                  {occurrence.rescheduleCount && occurrence.rescheduleCount > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium sm:px-2"
                      style={{ borderColor: "rgba(216, 100, 61, 0.25)", backgroundColor: "rgba(216, 100, 61, 0.08)", color: "var(--coral-600)" }}
                      title={`Reportée ${occurrence.rescheduleCount} fois`}
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      Reportée ×{occurrence.rescheduleCount}
                    </span>
                  ) : null}
                  <span className="font-semibold" style={{ color: meta.accent }}>
                    {meta.label}
                  </span>
                </div>
              </div>

              <span
                className="shrink-0 rounded-lg border border-line bg-glass-bg px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.08em] sm:px-2 sm:py-1 sm:text-[0.65rem] sm:tracking-wider"
                style={{ color: meta.accent }}
                title={scheduledDate.toLocaleDateString("fr-FR")}
              >
                {relativeLabel}
              </span>
            </div>

            {occurrence.notes && !compact ? (
              <p className="mt-2 text-xs leading-5 text-[var(--ink-600)] sm:text-sm">{occurrence.notes}</p>
            ) : null}

            {occurrence.isManuallyModified && !compact ? (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[var(--status-overdue-border)] bg-[var(--status-overdue-surface)] px-2 py-1 text-[0.65rem] font-semibold text-[var(--status-overdue-accent)]">
                <AlertCircle className="size-3" />
                Date déplacée manuellement
              </div>
            ) : null}
          </div>
        </div>

        {!compact && canEditOccurrence && !archived && (currentStatus === "overdue" || currentStatus === "due") ? (
          <div className="mt-2.5 hidden flex-wrap items-center gap-1.5 pt-1 sm:flex">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-500">
              Reporter à :
            </span>
            <button
              className="inline-flex items-center gap-1 rounded-full border border-line bg-glass-bg px-2.5 py-1 text-[0.7rem] font-semibold text-ink-700 transition-all hover:bg-white dark:bg-[#262830] active:scale-95 disabled:opacity-40"
              disabled={isSubmitting}
              onClick={(event) => {
                stopEvent(event);
                quickReschedule("tomorrow");
              }}
              type="button"
            >
              <Sunrise className="size-3" aria-hidden="true" />
              Demain
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-full border border-line bg-white/70 dark:bg-[#262830]/70 px-2.5 py-1 text-[0.7rem] font-semibold text-ink-700 transition-all hover:bg-white dark:bg-[#262830] active:scale-95 disabled:opacity-40"
              disabled={isSubmitting}
              onClick={(event) => {
                stopEvent(event);
                quickReschedule("after-tomorrow");
              }}
              type="button"
            >
              Après-demain
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-full border border-line bg-glass-bg px-2.5 py-1 text-[0.7rem] font-semibold text-ink-700 transition-all hover:bg-sand-100 active:scale-95 disabled:opacity-40"
              disabled={isSubmitting}
              onClick={(event) => {
                stopEvent(event);
                quickReschedule("weekend");
              }}
              type="button"
            >
              <Coffee className="size-3" aria-hidden="true" />
              Week-end
            </button>
          </div>
        ) : null}

        {!compact && canEditOccurrence && !archived ? (
          <div className="mt-2.5 grid grid-cols-[1fr_1fr_2.75rem] items-center gap-2 pt-1 sm:mt-3 sm:flex">
            <button
              aria-label={`Marquer "${occurrence.taskTemplate.title}" comme terminée`}
              className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--status-completed-border)] bg-[var(--status-completed-surface)] px-2 py-2 text-xs font-bold text-[var(--status-completed-accent)] transition-all active:scale-[0.97] disabled:opacity-40 sm:min-h-[44px] sm:px-3 sm:py-3 sm:text-sm"
              aria-busy={isSubmitting}
              disabled={isSubmitting}
              onClick={(event) => {
                stopEvent(event);
                submitAction(`/api/occurrences/${occurrence.id}/complete`);
              }}
              type="button"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              <span>Terminer</span>
            </button>

            <button
              aria-label={`Passer "${occurrence.taskTemplate.title}"`}
              className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-glass-bg px-2 py-2 text-xs font-bold text-ink-700 transition-all active:scale-[0.97] disabled:opacity-40 sm:min-h-[44px] sm:px-3 sm:py-3 sm:text-sm"
              aria-busy={isSubmitting}
              disabled={isSubmitting}
              onClick={(event) => {
                stopEvent(event);
                submitAction(`/api/occurrences/${occurrence.id}/skip`);
              }}
              type="button"
            >
              <SkipForward className="size-4" aria-hidden="true" />
              <span>Passer</span>
            </button>

            <button
              aria-label={`Plus d'actions pour ${occurrence.taskTemplate.title}`}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-glass-bg text-ink-500 transition-all active:scale-90 sm:size-11"
              onClick={(event) => {
                stopEvent(event);
                setShowSheet(true);
              }}
              type="button"
            >
              <MoreHorizontal className="size-5" />
            </button>
          </div>
        ) : null}

        {!compact && canEditOccurrence && archived ? (
          <div className="mt-2.5 grid grid-cols-[1fr_2.75rem] items-center gap-2 pt-1 sm:mt-3 sm:flex">
            <button
              className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[rgba(47,109,136,0.16)] bg-glass-bg px-2 py-2 text-xs font-bold text-sky-600 transition-all active:scale-[0.97] disabled:opacity-40 sm:min-h-[44px] sm:px-3 sm:py-3 sm:text-sm"
              disabled={isSubmitting}
              onClick={(event) => {
                stopEvent(event);
                submitAction(`/api/occurrences/${occurrence.id}/reopen`);
              }}
              type="button"
            >
              <RotateCcw className="size-4" />
              <span>Remettre à faire</span>
            </button>
            <button
              aria-label={`Plus d'actions pour ${occurrence.taskTemplate.title}`}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-glass-bg text-ink-500 transition-all active:scale-90 sm:size-11"
              onClick={(event) => {
                stopEvent(event);
                setShowSheet(true);
              }}
              type="button"
            >
              <MoreHorizontal className="size-5" />
            </button>
          </div>
        ) : null}
      </article>

      <TaskDetailSheet
        isOpen={showSheet}
        onClose={() => setShowSheet(false)}
        occurrence={occurrence}
        members={members}
        currentMemberId={currentMemberId}
        householdId={householdId}
        canEditTemplate={canEditTemplate}
        taskTemplateId={taskTemplateId}
        archived={archived}
        canEditOccurrence={canEditOccurrence}
        statusLabel={meta.label}
        isSubmitting={isSubmitting}
        onSubmit={submitAction}
        onTemplateSaved={() => router.refresh()}
      />
    </>
  );
}
