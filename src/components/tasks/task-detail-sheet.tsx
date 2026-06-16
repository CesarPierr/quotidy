"use client";

import { useState } from "react";
import { TaskHistoryPanel, TemplateEditPanel } from "@/components/tasks/task-detail-panels";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TaskDetailOccurrence } from "@/components/tasks/task-detail-occurrence";
import { TaskDetailChecklist } from "@/components/tasks/task-detail-checklist";
import { TaskDetailComments } from "@/components/tasks/task-detail-comments";

type TabId = "occurrence" | "template" | "history" | "checklist" | "comments";

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

export type TaskDetailSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  occurrence: Occurrence;
  members: { id: string; displayName: string }[];
  currentMemberId?: string | null;
  householdId?: string;
  canEditTemplate?: boolean;
  taskTemplateId?: string;
  archived: boolean;
  canEditOccurrence: boolean;
  statusLabel: string;
  isSubmitting: boolean;
  onSubmit: (url: string, body?: Record<string, string>) => void;
  onTemplateSaved?: () => void;
};

export function TaskDetailSheet({
  isOpen,
  onClose,
  occurrence,
  members,
  currentMemberId,
  householdId,
  canEditTemplate = false,
  taskTemplateId,
  archived,
  canEditOccurrence,
  statusLabel,
  isSubmitting,
  onSubmit,
  onTemplateSaved,
}: TaskDetailSheetProps) {
  const [tab, setTab] = useState<TabId>("occurrence");

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: "occurrence", label: "Cette fois-ci", show: true },
    { id: "template", label: "Modèle", show: Boolean(canEditTemplate && householdId && taskTemplateId) },
    { id: "history", label: "Historique", show: Boolean(taskTemplateId) },
    { id: "checklist", label: "Checklist", show: Boolean(taskTemplateId) },
    { id: "comments", label: "Commentaires", show: true },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={occurrence.taskTemplate.title}>
      <div className="space-y-4">
        {/* Tabs */}
        <div role="tablist" aria-label="Sections de la tâche" className="flex gap-1 overflow-x-auto rounded-full border border-line bg-[rgba(30,31,34,0.04)] p-1">
          {tabs.filter((t) => t.show).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              type="button"
              className={
                tab === t.id
                  ? "shrink-0 rounded-full bg-white dark:bg-[#262830] px-4 py-1.5 text-sm font-bold text-ink-950 shadow-sm"
                  : "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold text-ink-500"
              }
              onClick={() => {
                setTab(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <TaskDetailOccurrence
          active={tab === "occurrence"}
          occurrence={occurrence}
          members={members}
          canEditOccurrence={canEditOccurrence}
          canEditTemplate={canEditTemplate}
          archived={archived}
          statusLabel={statusLabel}
          isSubmitting={isSubmitting}
          householdId={householdId}
          taskTemplateId={taskTemplateId}
          onSubmit={onSubmit}
          onSetTab={setTab}
        />

        {tab === "template" && canEditTemplate && householdId && taskTemplateId ? (
          <TemplateEditPanel
            taskId={taskTemplateId}
            householdId={householdId}
            open={isOpen && tab === "template"}
            onCancel={() => setTab("occurrence")}
            onSuccess={() => {
              setTab("occurrence");
              onTemplateSaved?.();
            }}
          />
        ) : null}

        {tab === "history" && taskTemplateId ? (
          <TaskHistoryPanel taskId={taskTemplateId} open={isOpen && tab === "history"} />
        ) : null}

        {taskTemplateId ? (
          <TaskDetailChecklist active={tab === "checklist"} taskTemplateId={taskTemplateId} />
        ) : null}

        <TaskDetailComments
          active={tab === "comments"}
          occurrenceId={occurrence.id}
          currentMemberId={currentMemberId}
        />
      </div>
    </BottomSheet>
  );
}
