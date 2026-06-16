import { CheckCircle2 } from "lucide-react";
import { CollapsibleList } from "@/components/shared/collapsible-list";
import { OccurrenceCard } from "./occurrence-card";

type CompletedTasksDialogProps = {
  tasks: Array<{
    id: string;
    scheduledDate: Date | string;
    status: string;
    notes: string | null;
    actualMinutes: number | null;
    isManuallyModified?: boolean;
    taskTemplate: { title: string; category: string | null; estimatedMinutes: number; color: string };
    assignedMember: { id: string; displayName: string; color: string } | null;
  }>;
  members: { id: string; displayName: string }[];
  currentMemberId?: string | null;
};

export function CompletedTasksDialog({ tasks, members, currentMemberId }: CompletedTasksDialogProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-[1.4rem] border border-line bg-white/80 dark:bg-surface/80 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full border border-line bg-white dark:bg-surface text-leaf-600">
            <CheckCircle2 className="size-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink-950">Historique des validations</h4>
            <p className="text-xs text-ink-700">{tasks.length} action{tasks.length > 1 ? "s" : ""} clôturée{tasks.length > 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {tasks.length > 0 ? (
        <CollapsibleList
          initialCount={3}
          label="Voir l&apos;historique complet des validations"
          items={tasks.map((occurrence) => (
            <OccurrenceCard
              key={occurrence.id}
              occurrence={occurrence}
              members={members}
              currentMemberId={currentMemberId}
            />
          ))}
        />
      ) : (
        <div className="soft-panel py-8 text-center text-ink-700">Aucune tâche clôturée pour le moment.</div>
      )}
    </div>
  );
}
