"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ListChecks, Sparkles, Users } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { isoDateKey } from "@/lib/time";
import { useRouter } from "next/navigation";

type OnboardingWizardProps = {
  householdId: string;
  householdName: string;
  currentMemberName: string;
};

// Stable keys identify tasks across localStorage restores (indices would drift
// if the catalogue ever changes order). Each task reuses the exact payload the
// previous wizard sent to POST /api/tasks.
const SUGGESTED_TASKS = [
  { key: "aspirateur", title: "Aspirateur salon", room: "Salon", estimatedMinutes: 15, emoji: "🧹", recurrenceLabel: "Hebdo" },
  { key: "vaisselle", title: "Vaisselle", room: "Cuisine", estimatedMinutes: 10, emoji: "🍽️", recurrenceLabel: "Quotidien" },
  { key: "poubelles", title: "Poubelles", room: "Cuisine", estimatedMinutes: 5, emoji: "🗑️", recurrenceLabel: "Hebdo" },
  { key: "sdb", title: "Nettoyage salle de bain", room: "Salle de bain", estimatedMinutes: 20, emoji: "🚿", recurrenceLabel: "Hebdo" },
  { key: "lessive", title: "Lessive", room: "Buanderie", estimatedMinutes: 10, emoji: "👕", recurrenceLabel: "Hebdo" },
  { key: "courses", title: "Courses", room: "Tout l'appartement", estimatedMinutes: 45, emoji: "🛒", recurrenceLabel: "Hebdo" },
  { key: "draps", title: "Changer les draps", room: "Chambre parentale", estimatedMinutes: 10, emoji: "🛏️", recurrenceLabel: "Bi-hebdo" },
  { key: "plantes", title: "Plantes & arrosage", room: "Tout l'appartement", estimatedMinutes: 5, emoji: "🪴", recurrenceLabel: "Hebdo" },
  { key: "cuisine", title: "Nettoyage cuisine en profondeur", room: "Cuisine", estimatedMinutes: 25, emoji: "🧽", recurrenceLabel: "Hebdo" },
] as const;

type SuggestedTask = (typeof SUGGESTED_TASKS)[number];
const TASK_BY_KEY = new Map<string, SuggestedTask>(SUGGESTED_TASKS.map((t) => [t.key, t]));
const ALL_KEYS: string[] = SUGGESTED_TASKS.map((t) => t.key);

type PersonaId = "solo" | "couple" | "coloc" | "famille";

// Each persona pre-selects a curation tuned to the shape of that household.
// PURE state — no API calls. The user can still toggle individual chips.
const PERSONAS: Array<{ id: PersonaId; emoji: string; label: string; desc: string; taskKeys: string[] }> = [
  {
    id: "solo",
    emoji: "🧍",
    label: "Solo",
    desc: "L'essentiel, sans surcharge",
    taskKeys: ["vaisselle", "poubelles", "lessive", "courses", "plantes"],
  },
  {
    id: "couple",
    emoji: "💑",
    label: "Couple",
    desc: "Équité et rotation à deux",
    taskKeys: ["aspirateur", "vaisselle", "poubelles", "sdb", "lessive", "courses"],
  },
  {
    id: "coloc",
    emoji: "🏠",
    label: "Coloc",
    desc: "Trois personnes ou plus",
    taskKeys: ["aspirateur", "vaisselle", "poubelles", "sdb", "lessive", "courses", "cuisine"],
  },
  {
    id: "famille",
    emoji: "👨‍👩‍👧",
    label: "Famille",
    desc: "Adultes et enfants, plus large",
    taskKeys: ALL_KEYS,
  },
];

const STORAGE_KEY = "mm.onboarding.v2";
const STEPS = ["welcome", "profile", "ready"] as const;
type Step = (typeof STEPS)[number];

type PersistedState = {
  step: Step;
  persona: PersonaId | null;
  selectedTaskKeys: string[];
  monthlyIncome: string;
};

function sendBeacon(payload: object) {
  const body = JSON.stringify(payload);
  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    navigator.sendBeacon("/api/metrics", new Blob([body], { type: "application/json" }));
    return;
  }
  fetch("/api/metrics", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => undefined);
}

function loadPersisted(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const step = STEPS.includes(parsed.step as Step) ? (parsed.step as Step) : "welcome";
    const persona = PERSONAS.some((p) => p.id === parsed.persona) ? (parsed.persona as PersonaId) : null;
    const selectedTaskKeys = Array.isArray(parsed.selectedTaskKeys)
      ? parsed.selectedTaskKeys.filter((k): k is string => typeof k === "string" && TASK_BY_KEY.has(k))
      : [];
    const monthlyIncome = typeof parsed.monthlyIncome === "string" ? parsed.monthlyIncome : "";
    return { step, persona, selectedTaskKeys, monthlyIncome };
  } catch {
    return null;
  }
}

function clearPersisted() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — persistence is best-effort.
  }
}

export function OnboardingWizard({ householdId, householdName, currentMemberName }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [persona, setPersona] = useState<PersonaId | null>(null);
  const [selectedTaskKeys, setSelectedTaskKeys] = useState<Set<string>>(new Set());
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const { success, error: showError } = useToast();

  // ── Restore from localStorage + fire onboarding.started once on mount ──────
  useEffect(() => {
    const saved = loadPersisted();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (saved) {
      setStep(saved.step);
      setPersona(saved.persona);
      setSelectedTaskKeys(new Set(saved.selectedTaskKeys));
      setMonthlyIncome(saved.monthlyIncome);
    }
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    sendBeacon({ event: "onboarding.started", props: { householdId } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist on every change (after the initial restore) ────────────────────
  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          step,
          persona,
          selectedTaskKeys: [...selectedTaskKeys],
          monthlyIncome,
        } satisfies PersistedState),
      );
    } catch {
      // ignore — persistence is best-effort.
    }
  }, [restored, step, persona, selectedTaskKeys, monthlyIncome]);

  // ── onboarding.step_viewed on each step change ─────────────────────────────
  useEffect(() => {
    sendBeacon({ event: "onboarding.step_viewed", props: { householdId, step } });
  }, [householdId, step]);

  function choosePersona(p: (typeof PERSONAS)[number]) {
    setPersona(p.id);
    setSelectedTaskKeys(new Set(p.taskKeys));
  }

  function toggleTask(key: string) {
    setSelectedTaskKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Final action — all DB writes happen here ───────────────────────────────
  const finish = useCallback(
    async (withTasks: boolean) => {
      if (isBusy) return;
      setIsBusy(true);
      try {
        const csrfMatch = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/);
        const csrfHeaders: HeadersInit = csrfMatch?.[1] ? { "x-csrf-token": csrfMatch[1] } : {};

        if (withTasks) {
          const tasks = [...selectedTaskKeys].map((k) => TASK_BY_KEY.get(k)!).filter(Boolean);
          const startsOn = isoDateKey(new Date());
          for (const task of tasks) {
            const formData = new FormData();
            formData.set("householdId", householdId);
            formData.set("title", task.title);
            formData.set("room", task.room);
            formData.set("estimatedMinutes", String(task.estimatedMinutes));
            formData.set("startsOn", startsOn);
            formData.set("interval", "1");
            formData.set("recurrenceType", "weekly");
            formData.set("assignmentMode", "round_robin");
            formData.set("priority", "2");

            const res = await fetch(`/api/tasks`, { method: "POST", body: formData, headers: csrfHeaders });
            if (!res.ok) throw new Error("task-create-failed");
          }
        }

        // Optional household income — best-effort, never blocks completion.
        const income = monthlyIncome.trim();
        if (income) {
          try {
            const incomeForm = new FormData();
            incomeForm.set("_action", "income.create");
            incomeForm.set("label", "Revenu du foyer");
            incomeForm.set("amount", income);
            await fetch(`/api/households/${householdId}/budget`, {
              method: "POST",
              body: incomeForm,
              headers: csrfHeaders,
            });
          } catch {
            // ignore — income is optional and must not block onboarding.
          }
        }

        const completion = await fetch(`/api/households/${householdId}/onboarding`, {
          method: "POST",
          headers: csrfHeaders,
        });
        if (!completion.ok) throw new Error("completion-failed");

        sendBeacon({ event: "onboarding.completed", props: { householdId } });
        clearPersisted();
        if (withTasks) {
          const count = selectedTaskKeys.size;
          success(`${count} tâche${count > 1 ? "s" : ""} créée${count > 1 ? "s" : ""} !`);
        }
        router.refresh();
      } catch {
        showError("Erreur lors de la finalisation.");
        setIsBusy(false);
      }
    },
    [householdId, isBusy, monthlyIncome, router, selectedTaskKeys, showError, success],
  );

  const stepIndex = STEPS.indexOf(step);
  const selectedCount = selectedTaskKeys.size;

  return (
    <div className="mx-auto max-w-2xl">
      {/* 3-dot progress */}
      <div className="mb-6 flex items-center justify-center gap-2" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`h-2 rounded-full transition-all duration-500 ${
              i === stepIndex
                ? "w-8 bg-coral-500"
                : i < stepIndex
                  ? "w-2 bg-coral-500/60"
                  : "w-2 bg-black/10 dark:bg-white/15"
            }`}
          />
        ))}
      </div>

      {/* Step 1 — Bienvenue */}
      {step === "welcome" && (
        <div className="app-surface rounded-[2rem] p-6 text-center animate-in fade-in slide-in-from-bottom-4 sm:p-8">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-600">
            <Sparkles className="size-10" />
          </div>
          <h2 className="display-title text-3xl sm:text-4xl">
            Bienvenue dans
            <br />
            {householdName} !
          </h2>
          <p className="mt-4 leading-7 text-ink-700">
            Bonjour <strong>{currentMemberName}</strong>. Préparons votre foyer en quelques secondes — vous pourrez tout
            ajuster ensuite.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-2.5 text-left">
            {[
              { c: "coral", t: "Tâches partagées", d: "Réparties automatiquement et équitablement." },
              { c: "leaf", t: "Budget en temps réel", d: "Suivez salaires, charges et dépenses." },
              { c: "sky", t: "Démarrage rapide", d: "Un profil et c'est prêt, sans paperasse." },
              { c: "coral", t: "Toujours ajustable", d: "Modifiez tâches et budget à tout moment." },
            ].map((v) => (
              <div key={v.t} className="rounded-2xl border border-line bg-glass-bg p-4">
                <span
                  className={`flex size-9 items-center justify-center rounded-xl ${
                    v.c === "coral"
                      ? "bg-coral-500/10 text-coral-600"
                      : v.c === "leaf"
                        ? "bg-leaf-600/10 text-leaf-600"
                        : "bg-sky-500/10 text-sky-600"
                  }`}
                >
                  <CheckCircle2 className="size-4" />
                </span>
                <p className="mt-3 text-sm font-semibold">{v.t}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{v.d}</p>
              </div>
            ))}
          </div>
          <button
            className="btn-primary mt-7 inline-flex w-full items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold sm:w-auto"
            onClick={() => setStep("profile")}
            type="button"
          >
            C&apos;est parti <ArrowRight className="size-4" />
          </button>
          <div className="mt-4">
            <button
              className="min-h-11 px-4 text-sm font-semibold text-ink-500 underline-offset-4 hover:text-ink-800 hover:underline disabled:opacity-50"
              onClick={() => finish(false)}
              disabled={isBusy}
              type="button"
            >
              Explorer directement
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Profil */}
      {step === "profile" && (
        <div className="app-surface space-y-5 rounded-[2rem] p-6 animate-in fade-in slide-in-from-right-8 sm:p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[rgba(56,115,93,0.12)] text-leaf-600">
              <Users className="size-7" />
            </div>
            <h2 className="display-title text-2xl sm:text-3xl">Quel type de foyer ?</h2>
            <p className="mt-2 text-sm text-ink-700">
              Choisissez un profil pour pré-sélectionner des tâches adaptées. Ajustez librement ensuite.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PERSONAS.map((p) => {
              const active = persona === p.id;
              return (
                <button
                  key={p.id}
                  className={`flex min-h-11 items-center gap-4 rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                    active
                      ? "border-coral-500 bg-coral-500/10 shadow-sm"
                      : "border-line bg-glass-bg hover:border-coral-400 hover:bg-sand-100"
                  }`}
                  onClick={() => choosePersona(p)}
                  type="button"
                  aria-pressed={active}
                >
                  <span className="text-3xl leading-none">{p.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink-950">{p.label}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{p.desc}</p>
                  </div>
                  {active && <CheckCircle2 className="ml-auto size-5 shrink-0 text-coral-600" />}
                </button>
              );
            })}
          </div>

          {persona && (
            <div className="space-y-3 animate-in fade-in">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Tâches sélectionnées</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_TASKS.map((task) => {
                  const selected = selectedTaskKeys.has(task.key);
                  return (
                    <button
                      key={task.key}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-all ${
                        selected
                          ? "border-coral-500 bg-coral-500/10 font-semibold text-ink-950"
                          : "border-line bg-glass-bg text-ink-500 hover:border-ink-300"
                      }`}
                      onClick={() => toggleTask(task.key)}
                      type="button"
                      aria-pressed={selected}
                    >
                      <span>{task.emoji}</span>
                      <span>{task.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              className="btn-quiet min-h-11 flex-1 px-4 py-3 text-sm font-semibold"
              onClick={() => setStep("welcome")}
              type="button"
            >
              Retour
            </button>
            <button
              className="btn-primary inline-flex min-h-11 flex-[2] items-center justify-center gap-2 px-4 py-3 text-sm font-bold"
              onClick={() => setStep("ready")}
              type="button"
            >
              Continuer <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Prêt */}
      {step === "ready" && (
        <div className="app-surface space-y-6 rounded-[2rem] p-6 text-center animate-in fade-in slide-in-from-right-8 sm:p-8">
          <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-[rgba(56,115,93,0.12)] text-leaf-600">
            <ListChecks className="size-10" />
          </div>
          <div>
            <h2 className="display-title text-3xl sm:text-4xl">
              {selectedCount > 0 ? `${selectedCount} tâche${selectedCount > 1 ? "s" : ""} prête${selectedCount > 1 ? "s" : ""}` : "Tout est prêt"}
            </h2>
            <p className="mx-auto mt-3 max-w-md leading-7 text-ink-700">
              {selectedCount > 0
                ? "On crée ces tâches et on les répartit automatiquement dans votre foyer. Vous pourrez en ajouter d'autres quand vous voulez."
                : "Aucune tâche sélectionnée pour l'instant — vous pourrez en créer directement depuis le tableau de bord."}
            </p>
          </div>

          {selectedCount > 0 && (
            <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2">
              {[...selectedTaskKeys].map((k) => {
                const task = TASK_BY_KEY.get(k);
                if (!task) return null;
                return (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-glass-bg px-3 py-1.5 text-xs font-medium text-ink-700"
                  >
                    <span>{task.emoji}</span>
                    {task.title}
                  </span>
                );
              })}
            </div>
          )}

          <div className="mx-auto w-full max-w-sm text-left">
            <label htmlFor="onboarding-income" className="text-xs font-bold uppercase tracking-wider text-ink-500">
              Revenu mensuel du foyer (facultatif)
            </label>
            <input
              id="onboarding-income"
              className="field mt-2 w-full text-center tabular-nums"
              type="text"
              inputMode="decimal"
              placeholder="Ex. 3500"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
              disabled={isBusy}
            />
            <p className="mt-2 text-center text-xs leading-relaxed text-ink-400">
              On l&apos;ajoute à votre budget. Modifiable à tout moment.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <button
              className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold disabled:opacity-50 sm:w-auto sm:self-center"
              onClick={() => finish(selectedCount > 0)}
              disabled={isBusy}
              type="button"
            >
              {isBusy ? "Finalisation…" : selectedCount > 0 ? "Créer et démarrer" : "Démarrer"}
              {!isBusy && <ArrowRight className="size-4" />}
            </button>
            {selectedCount > 0 && (
              <button
                className="min-h-11 px-4 text-sm font-semibold text-ink-500 underline-offset-4 hover:text-ink-800 hover:underline disabled:opacity-50"
                onClick={() => finish(false)}
                disabled={isBusy}
                type="button"
              >
                Démarrer à vide
              </button>
            )}
            <button
              className="min-h-11 px-4 text-xs font-medium text-ink-400 hover:text-ink-700 disabled:opacity-50"
              onClick={() => setStep("profile")}
              disabled={isBusy}
              type="button"
            >
              Modifier mon profil
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
