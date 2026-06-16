"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, SkipForward } from "lucide-react";

import { TaskTemplateEditForm, type TaskTemplateEditable } from "@/components/tasks/task-template-edit-form";
import { formatMinutes } from "@/lib/utils";

type TaskRecentRun = {
  id: string;
  scheduledDate: string;
  completedAt: string | null;
  status: string;
  actualMinutes: number | null;
  notes: string | null;
  completedBy: { displayName: string; color: string } | null;
};

type DetailsResponse = {
  task: TaskTemplateEditable;
  recentRuns: TaskRecentRun[];
};

function useTaskDetails(taskId: string, open: boolean) {
  const [data, setData] = useState<DetailsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    const controller = new AbortController();
    fetch(`/api/tasks/${taskId}/details`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DetailsResponse>;
      })
      .then((payload) => {
        setData(payload);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "load_failed");
      });
    return () => controller.abort();
  }, [taskId, open]);

  const loading = open && !data && !error;
  return { data, loading, error };
}

type TemplateEditPanelProps = {
  taskId: string;
  householdId: string;
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
};

export function TemplateEditPanel({
  taskId,
  householdId,
  open,
  onCancel,
  onSuccess,
}: TemplateEditPanelProps) {
  const { data, loading, error } = useTaskDetails(taskId, open);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-line bg-white/70 dark:bg-surface/70 p-6 text-center text-sm text-ink-700">
        Chargement du modèle…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        Impossible de charger le modèle de cette tâche.
      </div>
    );
  }
  if (!data) {
    return null;
  }

  return (
    <TaskTemplateEditForm
      task={data.task}
      householdId={householdId}
      onCancel={onCancel}
      onSuccess={onSuccess}
    />
  );
}

type TaskHistoryPanelProps = {
  taskId: string;
  open: boolean;
};

export function TaskHistoryPanel({ taskId, open }: TaskHistoryPanelProps) {
  const { data, loading, error } = useTaskDetails(taskId, open);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-line bg-white/70 dark:bg-surface/70 p-6 text-center text-sm text-ink-700">
        Chargement de l&apos;historique…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        Impossible de charger l&apos;historique.
      </div>
    );
  }
  if (!data) return null;

  if (data.recentRuns.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white/70 dark:bg-surface/70 p-4 text-center text-sm text-ink-700">
        Cette tâche n&apos;a pas encore d&apos;historique.
      </div>
    );
  }

  return (
    <ul aria-label="Historique des dernières exécutions" className="space-y-2">
      {data.recentRuns.map((run) => {
        const Icon = run.status === "completed" ? CheckCircle2 : SkipForward;
        const accent = run.status === "completed" ? "var(--leaf-600)" : "var(--ink-500)";
        return (
          <li
            key={run.id}
            className="flex items-start gap-3 rounded-2xl border border-line bg-white/80 dark:bg-surface/80 p-3"
          >
            <span
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${accent}14`, color: accent }}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-ink-950">
                {format(new Date(run.scheduledDate), "EEEE d MMMM", { locale: fr })}
              </p>
              <p className="text-[0.78rem] text-ink-700">
                {run.status === "completed" ? "Validée" : "Passée"}
                {run.completedBy ? ` · ${run.completedBy.displayName}` : ""}
                {run.actualMinutes != null ? ` · ${formatMinutes(run.actualMinutes)}` : ""}
              </p>
              {run.notes ? (
                <p className="mt-1 text-[0.78rem] leading-5 text-[var(--ink-600)]">{run.notes}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
