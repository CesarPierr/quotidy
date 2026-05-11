"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { useFormAction } from "@/lib/use-form-action";
import { taskPalette } from "@/lib/constants";
import { isoDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  WizardStep1,
  WizardStep2,
  WizardStep3,
  WizardStep4,
  type DraftTask,
} from "./task-creation-steps";

type TaskCreationWizardProps = {
  householdId: string;
  members: { id: string; displayName: string; color?: string }[];
  compact?: boolean;
};

function buildInitialDraft(memberIds: string[]): DraftTask {
  return {
    kind: "recurring",
    title: "",
    estimatedMinutes: "20",
    category: "",
    room: "",
    color: taskPalette[0],
    startsOn: isoDateKey(new Date()),
    recurrenceType: "weekly",
    recurrenceMode: "SLIDING",
    interval: "1",
    assignmentMode: "strict_alternation",
    eligibleMemberIds: memberIds,
    isCollective: false,
    icon: "",
  };
}

export function TaskCreationWizard({ members, compact = false }: TaskCreationWizardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<DraftTask>(() => buildInitialDraft(members.map((m) => m.id)));
  const [showIconGrid, setShowIconGrid] = useState(false);
  
  const { submit, isSubmitting } = useFormAction({
    action: "/api/tasks",
    successMessage: "Tâche créée.",
    errorMessage: "Impossible de créer la tâche.",
    refreshOnSuccess: false,
    onSuccess: () => resetWizard(),
  });

  const isSingleTask = draft.kind === "single";
  const canGoNext = useMemo(() => {
    if (step === 1) return draft.title.trim().length > 0;
    if (step === 2) return true;
    if (step === 3) return true;
    if (step === 4) return draft.eligibleMemberIds.length > 0;
    return true;
  }, [step, draft]);

  function resetWizard() {
    setIsOpen(false);
    setStep(1);
    setShowIconGrid(false);
    setDraft(buildInitialDraft(members.map((m) => m.id)));
  }

  function updateDraft<K extends keyof DraftTask>(key: K, value: DraftTask[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleMember(memberId: string) {
    const isSingleOrFixed = draft.kind === "single" || draft.assignmentMode === "fixed";
    setDraft((current) => ({
      ...current,
      eligibleMemberIds: isSingleOrFixed
        ? [memberId]
        : current.eligibleMemberIds.includes(memberId)
          ? current.eligibleMemberIds.filter(id => id !== memberId)
          : [...current.eligibleMemberIds, memberId]
    }));
  }

  const handleNext = () => setStep(s => Math.min(4, s + 1));
  const handleBack = () => setStep(s => Math.max(1, s - 1));

  const trigger = compact ? (
    <button
      className="flex size-10 items-center justify-center rounded-full bg-coral-500 text-white shadow-lg transition-all active:scale-95 hover:bg-coral-600 sm:size-11"
      onClick={() => setIsOpen(true)}
      type="button"
      title="Nouvelle tâche"
    >
      <Plus className="size-5 sm:size-6" />
    </button>
  ) : (
    <button
      className="app-surface flex w-full items-center gap-4 rounded-[2rem] p-5 text-left sm:p-6"
      onClick={() => setIsOpen(true)}
      type="button"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-[rgba(47,109,136,0.12)] text-sky-600">
        <Plus className="size-6" />
      </span>
      <div>
        <p className="section-kicker">Nouvelle tâche</p>
        <h3 className="display-title mt-1 text-2xl">Créer une nouvelle tâche</h3>
        <p className="mt-1 text-sm text-ink-700">Simple une fois ou récurrente, sans configuration lourde.</p>
      </div>
    </button>
  );

  return (
    <>
      {trigger}

      <BottomSheet 
        isOpen={isOpen} 
        onClose={resetWizard}
        title={step === 1 ? "Nouvelle tâche" : draft.title || "Nouvelle tâche"}
      >
        <div className="flex flex-col min-h-[460px]">
          {/* Progress bar */}
          <div className="mb-6 flex gap-1.5 px-1">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i} 
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-300",
                  step >= i ? "bg-coral-500" : "bg-line"
                )} 
              />
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-1 pb-4">
            {step === 1 && (
              <WizardStep1
                draft={draft}
                updateDraft={updateDraft}
                showIconGrid={showIconGrid}
                setShowIconGrid={setShowIconGrid}
              />
            )}

            {step === 2 && <WizardStep2 draft={draft} updateDraft={updateDraft} />}

            {step === 3 && <WizardStep3 draft={draft} updateDraft={updateDraft} />}

            {step === 4 && (
              <WizardStep4
                draft={draft}
                updateDraft={updateDraft}
                members={members}
                toggleMember={toggleMember}
              />
            )}
          </div>

          {/* Footer actions */}
          <div className="mt-auto pt-6 flex items-center justify-center gap-4 w-full max-w-sm mx-auto">
            {step > 1 && (
              <button
                className="btn-quiet flex size-14 items-center justify-center rounded-full shrink-0 border border-line"
                onClick={handleBack}
                type="button"
                title="Retour"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}
            
            <button
              className={cn(
                "btn-primary flex-1 h-14 text-lg font-bold shadow-lg shadow-coral-200/50 rounded-2xl flex items-center justify-center",
                !canGoNext || isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              )}
              disabled={!canGoNext || (step === 4 && isSubmitting)}
              onClick={() => {
                if (step < 4) {
                  handleNext();
                } else {
                  const body: Record<string, string> = {
                    title: draft.title,
                    estimatedMinutes: draft.estimatedMinutes,
                    category: draft.category,
                    room: draft.room,
                    color: draft.color,
                    startsOn: draft.startsOn,
                    recurrenceType: draft.recurrenceType,
                    recurrenceMode: draft.recurrenceMode,
                    interval: draft.interval,
                    assignmentMode: isSingleTask ? "fixed" : draft.assignmentMode,
                    eligibleMemberIds: draft.eligibleMemberIds.join(","),
                    isCollective: draft.isCollective ? "on" : "off",
                    icon: draft.icon,
                    kind: draft.kind,
                  };
                  submit(body);
                }
              }}
              type="button"
            >
              <span>{step < 4 ? "Continuer" : (isSubmitting ? "Création..." : "Créer la tâche")}</span>
              {step < 4 && <ChevronRight className="size-5 ml-2" />}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
