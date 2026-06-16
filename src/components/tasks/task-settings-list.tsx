"use client";

import Link from "next/link";
import { useState } from "react";
import { describeRecurrence } from "@/lib/scheduling/recurrence";
import { hexToRgba } from "@/lib/colors";
import { useFormAction } from "@/lib/use-form-action";
import { Dialog } from "@/components/ui/dialog";
import { TaskTemplateEditForm } from "@/components/tasks/task-template-edit-form";

type Task = {
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
    mode: "FIXED" | "SLIDING";
    interval: number;
    weekdays: unknown;
    dayOfMonth: number | null;
    anchorDate: Date;
    dueOffsetDays: number;
    config?: unknown;
  };
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

const assignmentLabels: Record<string, { label: string; description: string }> = {
  fixed: {
    label: "Fixe",
    description: "Toujours la meme personne.",
  },
  manual: {
    label: "Manuelle",
    description: "Aucune auto-assignation, choix manuel sur chaque occurrence.",
  },
  strict_alternation: {
    label: "Alternance stricte",
    description: "Tour de role strict, en suivant l'ordre des membres eligibles.",
  },
  round_robin: {
    label: "Round-robin",
    description: "Distribution circulaire reguliere selon l'ordre de rotation.",
  },
  least_assigned_count: {
    label: "Charge (nombre)",
    description: "Priorite au membre ayant le moins de taches assignees.",
  },
  least_assigned_minutes: {
    label: "Charge (minutes)",
    description: "Priorite au membre ayant le moins de minutes assignees.",
  },
};

export function TaskSettingsList({
  tasks,
  householdId,
  manualOverridesByTaskId,
  autoEditTaskId,
}: {
  tasks: Task[];
  householdId: string;
  manualOverridesByTaskId: Record<string, number>;
  autoEditTaskId?: string | null;
}) {
  const initialEditingTask = autoEditTaskId
    ? tasks.find((task) => task.id === autoEditTaskId) ?? null
    : null;
  const [editingTask, setEditingTask] = useState<Task | null>(initialEditingTask);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const { submit: submitDelete, isSubmitting: isSubmittingDelete } = useFormAction({
    action: deletingTask ? `/api/tasks/${deletingTask.id}` : "",
    method: "POST",
    successMessage: "Tâche supprimée.",
    errorMessage: "Erreur lors de la suppression de la tâche.",
    onSuccess: () => setDeletingTask(null),
    refreshOnSuccess: true,
  });

  const manualOverrideCountForDelete = deletingTask ? (manualOverridesByTaskId[deletingTask.id] ?? 0) : 0;

  return (
    <div className="mt-5 space-y-3">
      {tasks.length === 0 && (
        <p className="text-ink-700">Aucune tâche configurée.</p>
      )}

      {/* Edit Task Dialog */}
      <Dialog
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        title="Modifier la tâche"
      >
        {editingTask ? (
          <TaskTemplateEditForm
            task={editingTask}
            householdId={householdId}
            onCancel={() => setEditingTask(null)}
            onSuccess={() => {
              setEditingTask(null);
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
          />
        ) : null}
      </Dialog>
      {tasks.map((task) => {
        const method = assignmentLabels[task.assignmentRule.mode] ?? {
          label: task.assignmentRule.mode.replace(/_/g, " "),
          description: "",
        };
        const manualOverrideCount = manualOverridesByTaskId[task.id] ?? 0;

        return (
        <article
          key={task.id}
          className="soft-panel p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral-500)]"
          onClick={() => setEditingTask(task)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setEditingTask(task);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Modifier la tâche « ${task.title} »`}
          style={{
            borderColor: hexToRgba(task.color ?? "#D8643D", 0.18),
            background: `linear-gradient(135deg, ${hexToRgba(task.color ?? "#D8643D", 0.1)}, rgba(255, 255, 255, 0.72))`,
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full" style={{ backgroundColor: task.color ?? "#D8643D" }} />
                <h4 className="text-lg font-semibold">{task.title}</h4>
              </div>
              <p className="text-sm text-ink-700 mt-1">
                {describeRecurrence({
                  type: task.recurrenceRule.type,
                  mode: task.recurrenceRule.mode,
                  interval: task.recurrenceRule.interval,
                  weekdays: Array.isArray(task.recurrenceRule.weekdays)
                    ? task.recurrenceRule.weekdays.map(Number)
                    : undefined,
                  dayOfMonth: task.recurrenceRule.dayOfMonth,
                  anchorDate: task.recurrenceRule.anchorDate,
                  dueOffsetDays: task.recurrenceRule.dueOffsetDays,
                  config: task.recurrenceRule.config,
                })}
              </p>
              <p className="mt-1 text-sm text-ink-700">
                {method.label} · {method.description}
              </p>
              {manualOverrideCount > 0 ? (
                <Link
                  className="mt-1 inline-flex items-center rounded-full border border-[rgba(216,100,61,0.16)] bg-[rgba(216,100,61,0.08)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-coral-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[rgba(216,100,61,0.14)] hover:shadow-[0_12px_24px_rgba(216,100,61,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(216,100,61,0.3)]"
                  href={`/app/taches/routines/overrides/${task.id}?household=${householdId}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {manualOverrideCount} occurrence{manualOverrideCount > 1 ? "s" : ""} future{manualOverrideCount > 1 ? "s" : ""} modifiée{manualOverrideCount > 1 ? "s" : ""}
                </Link>
              ) : null}
            </div>
            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              <span className="stat-pill px-3 py-1 text-sm">{method.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTask(task);
                }}
                className="text-sm font-semibold text-coral-600 hover:underline"
              >
                Modifier
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingTask(task);
                }}
                className="text-sm font-semibold text-red-600 hover:underline"
              >
                Supprimer
              </button>
            </div>
          </div>
        </article>
        );
      })}

      <Dialog
        isOpen={!!deletingTask}
        onClose={() => setDeletingTask(null)}
        title={`Supprimer "${deletingTask?.title}" ?`}
        type="danger"
      >
        {deletingTask && (
          <form id="delete-form" action={`/api/tasks/${deletingTask.id}`} method="post" onSubmit={async (event) => {
            event.preventDefault();
            if (isSubmittingDelete) return;
            const formData = new FormData(event.currentTarget);
            await submitDelete(formData);
          }}>
            <input type="hidden" name="_method" value="DELETE" />
            <input type="hidden" name="householdId" value={householdId} />
            
            {manualOverrideCountForDelete > 0 ? (
              <>
                <p className="text-ink-700 mb-4 leading-relaxed">
                  <strong>Attention :</strong> {manualOverrideCountForDelete} occurrence{manualOverrideCountForDelete > 1 ? "s" : ""} future{manualOverrideCountForDelete > 1 ? "s" : ""} a{manualOverrideCountForDelete > 1 ? "ve" : ""}nt été modifiée{manualOverrideCountForDelete > 1 ? "s" : ""} manuellement. Souhaitez-vous également les supprimer ?
                </p>
                <label className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 cursor-pointer hover:bg-red-100 transition-colors">
                  <input name="deleteManual" type="checkbox" className="mt-1" />
                  <span className="text-red-900 font-medium">
                    Oui, annuler toutes les occurrences futures associées.
                  </span>
                </label>
              </>
            ) : (
              <p className="text-ink-700 leading-relaxed">
                Cette tâche ne sera plus générée à l&apos;avenir. Ses occurrences passées seront conservées dans l&apos;historique.
              </p>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button className="btn-secondary px-5 py-2.5 font-semibold" type="button" onClick={() => setDeletingTask(null)} disabled={isSubmittingDelete}>
                Annuler
              </button>
              <button className="btn-primary bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 font-semibold border-none disabled:opacity-50" type="submit" disabled={isSubmittingDelete}>
                Confirmer la suppression
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
