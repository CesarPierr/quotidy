import { Calendar, CalendarClock, TimerReset, LayoutGrid, Plus, Users, User, Clock, Hash, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AVAILABLE_ICONS, type IconName } from "@/lib/room-icons";
import { roomSuggestions, taskPalette } from "@/lib/constants";

export type DraftTask = {
  kind: "single" | "recurring";
  title: string;
  estimatedMinutes: string;
  category: string;
  room: string;
  color: string;
  startsOn: string;
  recurrenceType: string;
  recurrenceMode: "FIXED" | "SLIDING";
  interval: string;
  assignmentMode: string;
  eligibleMemberIds: string[];
  isCollective: boolean;
  icon: string;
};

export const recurrenceOptions = [
  { value: "daily", label: "Quotidien", icon: CalendarClock },
  { value: "weekly", label: "Chaque semaine", icon: CalendarClock },
  { value: "monthly_simple", label: "Chaque mois", icon: CalendarClock },
  { value: "every_x_days", label: "Tous les X jours", icon: TimerReset },
  { value: "every_x_weeks", label: "Toutes les X sem.", icon: TimerReset },
];

export const assignmentOptions = [
  { value: "strict_alternation", label: "Alternance", icon: Users, description: "Chaque membre s'occupe de la tâche à tour de rôle de manière équitable." },
  { value: "fixed", label: "Fixe", icon: User, description: "Une seule personne s'occupe toujours de cette tâche." },
  { value: "least_assigned_count", label: "Équité", icon: Hash, description: "Le système choisit la personne qui a le moins de tâches assignées au total." },
  { value: "least_assigned_minutes", label: "Équité temps", icon: Clock, description: "Le système choisit la personne qui a le moins de minutes de travail cumulées." },
  { value: "round_robin", label: "Rotation", icon: TimerReset, description: "Distribution circulaire simple entre les membres éligibles." },
  { value: "manual", label: "Manuelle", icon: Check, description: "La tâche apparaît sans personne assignée, vous choisissez au moment de faire." },
];

type BaseStepProps = {
  draft: DraftTask;
  updateDraft: <K extends keyof DraftTask>(key: K, value: DraftTask[K]) => void;
};

export function WizardStep1({
  draft,
  updateDraft,
  showIconGrid,
  setShowIconGrid,
}: BaseStepProps & { showIconGrid: boolean; setShowIconGrid: (v: boolean) => void }) {
  const SelectedIcon = draft.icon ? AVAILABLE_ICONS[draft.icon as IconName] : null;
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex gap-4">
        <label className="field-label flex-1">
          <span>C&apos;est quoi ?</span>
          <input
            autoFocus
            className="field h-14 text-lg font-semibold"
            onChange={(e) => updateDraft("title", e.target.value)}
            placeholder="Ex: Passer l'aspirateur"
            value={draft.title}
          />
        </label>
        <div className="space-y-2">
          <span className="field-label">Icône</span>
          <button
            type="button"
            onClick={() => setShowIconGrid(!showIconGrid)}
            className={cn(
              "flex size-14 items-center justify-center rounded-2xl border-2 transition-all bg-glass-bg text-2xl",
              showIconGrid ? "border-sky-500" : "border-line"
            )}
          >
            {SelectedIcon ? <SelectedIcon className="size-6" /> : <LayoutGrid className="size-6 opacity-40" />}
          </button>
        </div>
      </div>

      {showIconGrid && (
        <div className="mx-auto max-w-[320px] grid grid-cols-6 gap-2 rounded-2xl bg-sand-100 border border-line p-3 animate-in zoom-in-95 duration-200">
          {(Object.keys(AVAILABLE_ICONS) as IconName[]).map((name) => {
            const IconComp = AVAILABLE_ICONS[name];
            return (
              <button
                key={name}
                onClick={() => {
                  updateDraft("icon", name);
                  setShowIconGrid(false);
                }}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-xl transition-all",
                  draft.icon === name ? "bg-coral-500 text-white" : "bg-glass-bg hover:bg-sand-200"
                )}
              >
                <IconComp className="size-5" />
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <span className="field-label px-1">Dans quelle pièce ?</span>
        <div className="flex flex-wrap gap-2">
          {roomSuggestions.map((room) => (
            <button
              key={room}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-semibold transition-all",
                draft.room === room
                  ? "border-sky-500 bg-sky-500/10 text-sky-600"
                  : "border-line bg-glass-bg text-[var(--ink-600)]"
              )}
              onClick={() => updateDraft("room", room)}
              type="button"
            >
              {room}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WizardStep2({ draft, updateDraft }: BaseStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <p className="field-label px-1 text-lg">Quel est le rythme ?</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className={cn(
            "flex flex-col items-center gap-4 rounded-3xl border-2 p-6 transition-all text-center",
            draft.kind === "single"
              ? "border-coral-500 bg-[var(--coral-50)]/30"
              : "border-line bg-white/50 dark:bg-surface/50 grayscale opacity-60"
          )}
          onClick={() => updateDraft("kind", "single")}
          type="button"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white dark:bg-surface shadow-sm">
            <Calendar className="size-7 text-coral-500" />
          </div>
          <div>
            <p className="font-bold text-ink-950 text-lg">Une seule fois</p>
            <p className="mt-1 text-xs text-[var(--ink-600)]">Tâche ponctuelle</p>
          </div>
        </button>
        <button
          className={cn(
            "flex flex-col items-center gap-4 rounded-3xl border-2 p-6 transition-all text-center",
            draft.kind === "recurring"
              ? "border-coral-500 bg-coral-500/10"
              : "border-line bg-glass-bg grayscale opacity-60"
          )}
          onClick={() => updateDraft("kind", "recurring")}
          type="button"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white dark:bg-surface shadow-sm">
            <CalendarClock className="size-7 text-coral-500" />
          </div>
          <div>
            <p className="font-bold text-ink-950 text-lg">Récurrente</p>
            <p className="mt-1 text-xs text-[var(--ink-600)]">Se répète dans le temps</p>
          </div>
        </button>
      </div>
    </div>
  );
}

export function WizardStep3({ draft, updateDraft }: BaseStepProps) {
  const isSingleTask = draft.kind === "single";

  if (isSingleTask) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="space-y-4">
          <p className="field-label px-1 text-lg">C&apos;est pour quand ?</p>
          <input
            className="field h-14 text-lg text-center"
            onChange={(e) => updateDraft("startsOn", e.target.value)}
            type="date"
            value={draft.startsOn}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="space-y-4">
        <p className="field-label px-1 text-lg">À quelle fréquence ?</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {recurrenceOptions.map((opt) => (
            <button
              key={opt.value}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all",
                draft.recurrenceType === opt.value
                  ? "border-sky-500 bg-sky-500/10 text-sky-600"
                  : "border-line bg-glass-bg text-[var(--ink-600)]"
              )}
              onClick={() => updateDraft("recurrenceType", opt.value)}
              type="button"
            >
              <opt.icon className="size-5 shrink-0" />
              <span className="text-xs font-bold">{opt.label}</span>
            </button>
          ))}
        </div>
        {(draft.recurrenceType === "every_x_days" || draft.recurrenceType === "every_x_weeks") && (
          <div className="flex items-center gap-3 pt-2">
            <span className="text-sm font-medium">Tous les</span>
            <input
              className="field w-20 text-center"
              min="1"
              onChange={(e) => updateDraft("interval", e.target.value)}
              type="number"
              value={draft.interval}
            />
            <span className="text-sm font-medium">
              {draft.recurrenceType === "every_x_days" ? "jours" : "semaines"}
            </span>
          </div>
        )}

        <div className="pt-4 border-t border-line">
          <p className="field-label px-1 text-sm">Mode de planification</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={() => updateDraft("recurrenceMode", "SLIDING")}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all",
                draft.recurrenceMode === "SLIDING"
                  ? "border-sky-500 bg-sky-500/10 text-sky-600"
                  : "border-line bg-glass-bg text-[var(--ink-600)]"
              )}
            >
              <TimerReset className="size-4" />
              <span className="text-[11px] font-bold">Glissant</span>
            </button>
            <button
              type="button"
              onClick={() => updateDraft("recurrenceMode", "FIXED")}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all",
                draft.recurrenceMode === "FIXED"
                  ? "border-sky-500 bg-sky-500/10 text-sky-600"
                  : "border-line bg-glass-bg text-[var(--ink-600)]"
              )}
            >
              <Calendar className="size-4" />
              <span className="text-[11px] font-bold">Fixe</span>
            </button>
          </div>
          <p className="mt-2 px-1 text-[10px] text-ink-500 leading-tight">
            {draft.recurrenceMode === "SLIDING"
              ? "Recommandé pour l'entretien (aspirateur, serpillère...) : la tâche se décale si vous êtes en retard."
              : "Recommandé pour l'administratif ou poubelles : la tâche reste ancrée à des jours précis."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function WizardStep4({
  draft,
  updateDraft,
  members,
  toggleMember,
}: BaseStepProps & {
  members: { id: string; displayName: string; color?: string }[];
  toggleMember: (memberId: string) => void;
}) {
  const isSingleTask = draft.kind === "single";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="space-y-6">
        {!isSingleTask && (
          <div className="space-y-3">
            <p className="field-label px-1">Qui s&apos;en occupe ?</p>
            <div className="grid grid-cols-3 gap-2">
              {assignmentOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all",
                    draft.assignmentMode === opt.value
                      ? "border-sky-500 bg-sky-500/10"
                      : "border-line bg-glass-bg opacity-60"
                  )}
                  onClick={() => {
                    updateDraft("assignmentMode", opt.value);
                    if (opt.value === "fixed") {
                      updateDraft("eligibleMemberIds", [members[0]?.id]);
                    }
                  }}
                  type="button"
                >
                  <opt.icon className="size-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 rounded-xl bg-[var(--ink-50)] p-3 text-[11px] leading-relaxed text-[var(--ink-600)] animate-in fade-in slide-in-from-top-1">
              {assignmentOptions.find((o) => o.value === draft.assignmentMode)?.description}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="field-label px-1">Personnes éligibles</p>
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-white dark:bg-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-600)] transition-all hover:bg-black/[0.02]">
              <input
                type="checkbox"
                checked={draft.isCollective}
                onChange={(e) => updateDraft("isCollective", e.target.checked)}
                className="size-3.5 rounded border-line text-coral-500 focus:ring-[var(--coral-500)]"
              />
              <span>Tâche collective</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                  draft.eligibleMemberIds.includes(m.id)
                    ? "border-current bg-current/10"
                    : "border-line bg-glass-bg text-ink-500 grayscale"
                )}
                onClick={() => toggleMember(m.id)}
                style={{ color: draft.eligibleMemberIds.includes(m.id) ? m.color : undefined }}
                type="button"
              >
                <div className="size-2 rounded-full" style={{ backgroundColor: m.color }} />
                {m.displayName}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          <label className="field-label">
            <span>Temps estimé (min)</span>
            <div className="flex flex-wrap gap-2">
              {["5", "15", "30", "45", "60"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateDraft("estimatedMinutes", m)}
                  className={cn(
                    "flex-1 min-w-[48px] rounded-xl border py-2.5 text-sm font-bold transition-all",
                    draft.estimatedMinutes === m
                      ? "bg-ink-950 text-white border-ink-950"
                      : "bg-white dark:bg-surface border-line"
                  )}
                >
                  {m}
                </button>
              ))}
              <div className="relative flex-1 min-w-[80px]">
                <input
                  className="field h-full w-full text-center text-sm font-bold px-2"
                  onChange={(e) => updateDraft("estimatedMinutes", e.target.value)}
                  placeholder="Autre..."
                  type="number"
                  value={["5", "15", "30", "45", "60"].includes(draft.estimatedMinutes) ? "" : draft.estimatedMinutes}
                />
              </div>
            </div>
          </label>

          <div className="space-y-2">
            <span className="field-label">Couleur</span>
            <div className="flex flex-wrap gap-2">
              {taskPalette.map((c) => (
                <button
                  key={c}
                  className={cn(
                    "size-8 rounded-full border-2 transition-all",
                    draft.color === c ? "border-black/20 scale-110 shadow-md" : "border-transparent"
                  )}
                  onClick={() => updateDraft("color", c)}
                  style={{ backgroundColor: c }}
                  type="button"
                />
              ))}
              <div className="relative size-8 rounded-full border-2 border-dashed border-line flex items-center justify-center overflow-hidden hover:border-ink-400 transition-all">
                <input
                  type="color"
                  className="absolute inset-0 size-full scale-150 cursor-pointer opacity-0"
                  onChange={(e) => updateDraft("color", e.target.value)}
                  value={taskPalette.includes(draft.color) ? "#000000" : draft.color}
                />
                {!taskPalette.includes(draft.color) ? (
                  <div className="size-full" style={{ backgroundColor: draft.color }} />
                ) : (
                  <Plus className="size-4 text-ink-400" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
