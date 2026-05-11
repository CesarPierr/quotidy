"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ListChecks,
  PiggyBank,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { isoDateKey } from "@/lib/time";
import { useRouter } from "next/navigation";

type OnboardingWizardProps = {
  householdId: string;
  householdName: string;
  currentMemberName: string;
};

const SUGGESTED_TASKS = [
  { title: "Aspirateur salon", room: "Salon", estimatedMinutes: 15, emoji: "🧹", recurrenceLabel: "Hebdo" },
  { title: "Vaisselle", room: "Cuisine", estimatedMinutes: 10, emoji: "🍽️", recurrenceLabel: "Quotidien" },
  { title: "Poubelles", room: "Cuisine", estimatedMinutes: 5, emoji: "🗑️", recurrenceLabel: "Hebdo" },
  { title: "Nettoyage salle de bain", room: "Salle de bain", estimatedMinutes: 20, emoji: "🚿", recurrenceLabel: "Hebdo" },
  { title: "Lessive", room: "Buanderie", estimatedMinutes: 10, emoji: "👕", recurrenceLabel: "Hebdo" },
  { title: "Courses", room: "Tout l'appartement", estimatedMinutes: 45, emoji: "🛒", recurrenceLabel: "Hebdo" },
  { title: "Changer les draps", room: "Chambre parentale", estimatedMinutes: 10, emoji: "🛏️", recurrenceLabel: "Bi-hebdo" },
  { title: "Plantes & arrosage", room: "Tout l'appartement", estimatedMinutes: 5, emoji: "🪴", recurrenceLabel: "Hebdo" },
  { title: "Nettoyage cuisine en profondeur", room: "Cuisine", estimatedMinutes: 25, emoji: "🧽", recurrenceLabel: "Hebdo" },
] as const;

// Each persona pre-cherche-picks a curation of suggested tasks designed for the
// shape of that household, NOT just a quantity slider. The user can adjust at
// the next step. Indices reference SUGGESTED_TASKS above.
type PackId = "solo" | "couple" | "coloc" | "famille" | "custom";

const PACKS: Array<{ id: PackId; emoji: string; label: string; desc: string; taskIndices: number[] }> = [
  {
    id: "solo",
    emoji: "🧍",
    label: "Solo",
    desc: "Une personne, l'essentiel sans surcharge",
    taskIndices: [1, 2, 4, 5, 7], // vaisselle, poubelles, lessive, courses, plantes
  },
  {
    id: "couple",
    emoji: "💑",
    label: "Couple",
    desc: "Deux adultes, équité et rotation",
    taskIndices: [0, 1, 2, 3, 4, 5], // base + sdb
  },
  {
    id: "coloc",
    emoji: "🏠",
    label: "Coloc",
    desc: "Trois personnes ou plus, rotation claire",
    taskIndices: [0, 1, 2, 3, 4, 5, 8], // base + cuisine en profondeur
  },
  {
    id: "famille",
    emoji: "👨‍👩‍👧",
    label: "Famille",
    desc: "Adultes et enfants, plus large",
    taskIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8], // tout sauf custom
  },
  {
    id: "custom",
    emoji: "✏️",
    label: "Personnalisé",
    desc: "Je choisis moi-même",
    taskIndices: [],
  },
];

const STEPS = [
  { id: "welcome", label: "Bienvenue" },
  { id: "pack", label: "Profil" },
  { id: "tasks", label: "Tâches" },
  { id: "savings", label: "Épargne" },
  { id: "box", label: "Caisse" },
  { id: "calc", label: "Calcul" },
  { id: "invite", label: "Équipe" },
  { id: "done", label: "C'est parti !" },
] as const;

type Step = (typeof STEPS)[number]["id"];

export function OnboardingWizard({ householdId, householdName, currentMemberName }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set([0, 1, 2]));
  const [isCreating, setIsCreating] = useState(false);
  const { success, error: showError } = useToast();

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);
  useEffect(() => {
    const payload = JSON.stringify({ event: "onboarding.step_viewed", props: { householdId, step } });
    if ("sendBeacon" in navigator) {
      navigator.sendBeacon("/api/metrics", new Blob([payload], { type: "application/json" }));
      return;
    }
    fetch("/api/metrics", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => undefined);
  }, [householdId, step]);

  function selectPack(pack: (typeof PACKS)[number]) {
    if (pack.id === "custom") {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(pack.taskIndices));
    }
    setStep("tasks");
  }

  async function createSelectedTasks() {
    setIsCreating(true);
    const tasksToCreate = [...selectedTasks].map((i) => SUGGESTED_TASKS[i]);
    const startsOn = isoDateKey(new Date());

    try {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/);
      const csrfHeaders: HeadersInit = csrfMatch?.[1] ? { "x-csrf-token": csrfMatch[1] } : {};

      for (const task of tasksToCreate) {
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

        const response = await fetch(`/api/tasks`, { method: "POST", body: formData, headers: csrfHeaders });
        if (!response.ok) {
          throw new Error("task-create-failed");
        }
      }
      success(`${tasksToCreate.length} tâches créées !`);
      setStep("invite");
    } catch {
      showError("Erreur lors de la création des tâches.");
    } finally {
      setIsCreating(false);
    }
  }

  function toggleTask(index: number) {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function disableSavingsForHousehold() {
    try {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/);
      const headers: HeadersInit = csrfMatch?.[1]
        ? { "x-csrf-token": csrfMatch[1], "x-requested-with": "fetch" }
        : { "x-requested-with": "fetch" };
      const formData = new FormData();
      formData.set("savingsEnabled", "false");
      await fetch(`/api/households/${householdId}/preferences`, {
        method: "POST",
        body: formData,
        headers,
      });
    } catch {
      // Best-effort — onboarding shouldn't fail on a preference toggle.
    }
  }

  async function completeOnboarding() {
    setIsCreating(true);
    try {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/);
      const csrfHeaders: HeadersInit = csrfMatch?.[1] ? { "x-csrf-token": csrfMatch[1] } : {};
      
      const res = await fetch(`/api/households/${householdId}/onboarding`, { 
        method: "POST",
        headers: csrfHeaders 
      });
      
      if (!res.ok) throw new Error("Failed to complete");
      navigator.sendBeacon?.(
        "/api/metrics",
        new Blob([JSON.stringify({ event: "onboarding.completed", props: { householdId } })], {
          type: "application/json",
        }),
      );
      
      router.refresh();
    } catch {
      showError("Erreur lors de la finalisation.");
      setIsCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress bar */}
      <div className="mb-6 flex items-center gap-1.5 px-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`h-1.5 w-full rounded-full transition-all duration-500 ${
                i <= currentStepIndex ? "bg-coral-500" : "bg-black/10 dark:bg-white/10"
              }`}
            />
            <span className={`hidden sm:block text-[0.55rem] font-bold uppercase tracking-wider ${
              i <= currentStepIndex ? "text-coral-600 dark:text-coral-400" : "text-ink-400 opacity-0"
            }`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Step: Welcome */}
      {step === "welcome" && (
        <div className="app-surface rounded-[2rem] p-6 sm:p-8 text-center animate-in fade-in slide-in-from-bottom-4">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-600">
            <Sparkles className="size-10" />
          </div>
          <h2 className="display-title text-3xl sm:text-4xl">
            Bienvenue dans<br />{householdName} !
          </h2>
          <p className="mt-4 text-ink-700 leading-7">
            Bonjour <strong>{currentMemberName}</strong>. Créez des tâches récurrentes, attribuez-les automatiquement à votre équipe ou votre foyer, et suivez votre épargne par enveloppes.
          </p>
          <div className="mt-8 grid gap-2.5 sm:grid-cols-3 text-left">
            <div className="flex flex-col gap-2 rounded-2xl border border-line bg-glass-bg p-4">
              <span className="flex size-9 items-center justify-center rounded-xl bg-coral-500/10 text-coral-600">
                <ListChecks className="size-4" />
              </span>
              <p className="text-sm font-semibold mt-1">Tâches</p>
              <p className="text-xs text-ink-500 leading-relaxed">Réparties automatiquement et équitablement entre vous.</p>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl border border-line bg-glass-bg p-4">
              <span className="flex size-9 items-center justify-center rounded-xl bg-leaf-600/10 text-leaf-600">
                <PiggyBank className="size-4" />
              </span>
              <p className="text-sm font-semibold mt-1">Épargne</p>
              <p className="text-xs text-ink-500 leading-relaxed">Gérez vos caisses communes et le budget partagé.</p>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl border border-line bg-glass-bg p-4">
              <span className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
                <Calculator className="size-4" />
              </span>
              <p className="text-sm font-semibold mt-1">Calculateurs</p>
              <p className="text-xs text-ink-500 leading-relaxed">Automatisez les calculs complexes (TVA, E85...).</p>
            </div>
          </div>
          <p className="mt-6 text-xs text-ink-500">Configuration en 2 minutes — vous pourrez tout ajuster ensuite.</p>
          <button
            className="btn-primary mt-3 inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold w-full sm:w-auto justify-center"
            onClick={() => setStep("pack")}
            type="button"
          >
            C&apos;est parti <ArrowRight className="size-4" />
          </button>
          <div className="mt-4">
            <button
              className="text-xs text-ink-400 hover:text-ink-700 font-medium"
              onClick={completeOnboarding}
              type="button"
            >
              Passer l&apos;introduction
            </button>
          </div>
        </div>
      )}

      {/* Step: Pack */}
      {step === "pack" && (
        <div className="app-surface rounded-[2rem] p-6 sm:p-8 space-y-5 animate-in fade-in slide-in-from-right-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[rgba(56,115,93,0.12)] text-leaf-600">
              <Users className="size-7" />
            </div>
            <h2 className="display-title text-2xl sm:text-3xl">Quel type de foyer ?</h2>
            <p className="mt-2 text-sm text-ink-700">
              On va pré-sélectionner les tâches adaptées. Vous pourrez les ajuster à l&apos;étape suivante.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PACKS.map((pack) => (
              <button
                key={pack.id}
                className="flex items-center gap-4 rounded-2xl border border-line bg-glass-bg p-4 text-left transition-all hover:border-coral-400 hover:bg-sand-100 hover:shadow-sm active:scale-[0.98]"
                onClick={() => selectPack(pack)}
                type="button"
              >
                <span className="text-3xl leading-none">{pack.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink-950">{pack.label}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{pack.desc}</p>
                </div>
                <ChevronRight className="ml-auto size-4 shrink-0 text-ink-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Tasks */}
      {step === "tasks" && (
        <div className="app-surface rounded-[2rem] p-6 sm:p-8 space-y-5 animate-in fade-in slide-in-from-right-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[rgba(216,100,61,0.12)] text-coral-600">
              <ListChecks className="size-7" />
            </div>
            <h2 className="display-title text-2xl sm:text-3xl">Choisissez vos tâches</h2>
            <p className="mt-2 text-sm text-ink-700">
              Sélectionnez les tâches à ajouter à votre foyer. Vous pourrez en créer d&apos;autres ensuite.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTED_TASKS.map((task, i) => {
              const selected = selectedTasks.has(i);
              return (
                <button
                  key={task.title}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                    selected
                      ? "border-coral-500 bg-coral-500/10 text-ink-950"
                      : "border-line bg-glass-bg text-ink-700 hover:border-ink-300 hover:bg-sand-100"
                  }`}
                  onClick={() => toggleTask(i)}
                  type="button"
                >
                  <span className="text-xl">{task.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{task.title}</p>
                    <p className="text-[0.7rem] text-ink-500">{task.room} · {task.estimatedMinutes} min · {task.recurrenceLabel}</p>
                  </div>
                  <div className={`size-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                    selected ? "border-coral-500 bg-coral-500" : "border-line"
                  }`}>
                    {selected && <CheckCircle2 className="size-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              className="btn-quiet flex-1 px-4 py-3 text-sm font-semibold"
              onClick={() => setStep("savings")}
              type="button"
            >
              Passer
            </button>
            <button
              className="btn-primary flex-[2] inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold disabled:opacity-50"
              disabled={selectedTasks.size === 0 || isCreating}
              onClick={createSelectedTasks}
              type="button"
            >
              {isCreating ? "Création…" : `Ajouter ${selectedTasks.size} tâche${selectedTasks.size > 1 ? "s" : ""}`}
              {!isCreating && <ArrowRight className="size-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Step: Savings Intro */}
      {step === "savings" && (
        <div className="app-surface rounded-[2rem] p-6 sm:p-8 space-y-6 text-center animate-in fade-in slide-in-from-right-8">
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-leaf-600/10 text-leaf-600">
            <PiggyBank className="size-8" />
          </div>
          <div>
            <h2 className="display-title text-2xl sm:text-3xl">Gérez votre budget</h2>
            <p className="mt-3 text-sm text-ink-700 max-w-md mx-auto leading-relaxed">
              Quotidy intègre un module <strong>Épargne</strong> pour suivre vos caisses communes, 
              les projets de vacances ou les dettes. Remplissez-les manuellement ou via des règles automatiques.
            </p>
          </div>
          
          <button
            className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold"
            onClick={() => setStep("box")}
            type="button"
          >
            Créer ma première caisse <ArrowRight className="size-4" />
          </button>
          <div className="flex flex-col gap-2 items-center pt-1">
            <button
              className="text-xs text-ink-500 hover:text-ink-800 font-medium"
              onClick={() => setStep("calc")}
              type="button"
            >
              Plus tard — passer pour l&apos;instant
            </button>
            <button
              className="text-xs text-ink-400 hover:text-coral-600 font-medium underline-offset-4 hover:underline"
              onClick={async () => {
                await disableSavingsForHousehold();
                setStep("invite");
              }}
              type="button"
            >
              Je n&apos;utilise pas le module Épargne
            </button>
          </div>
        </div>
      )}

      {/* Step: Create Box */}
      {step === "box" && (
        <div className="app-surface rounded-[2rem] p-6 sm:p-8 space-y-6 animate-in fade-in slide-in-from-right-8">
          <div className="text-center">
            <h2 className="display-title text-2xl">Nouvelle Caisse</h2>
            <p className="mt-2 text-sm text-ink-700">
              Créez un pot commun pour démarrer. Vous pourrez en ajouter d&apos;autres plus tard.
            </p>
          </div>

          <form 
            className="space-y-4 max-w-sm mx-auto"
            onSubmit={async (e) => {
              e.preventDefault();
              setIsCreating(true);
              const formData = new FormData(e.currentTarget);
              try {
                const csrfToken = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/)?.[1] ?? "";
                const res = await fetch(`/api/households/${householdId}/savings/boxes`, {
                  method: "POST",
                  body: formData,
                  headers: csrfToken ? { "x-csrf-token": csrfToken } : {}
                });
                if (!res.ok) throw new Error();
                success("Caisse créée avec succès !");
                setStep("calc");
              } catch {
                showError("Erreur lors de la création.");
              } finally {
                setIsCreating(false);
              }
            }}
          >
            <label className="field-label">
              <span>Nom de la caisse</span>
              <input name="name" className="field" placeholder="Ex: Caisse commune, Vacances..." required autoFocus />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field-label">
                <span>Type</span>
                <select name="kind" className="field">
                  <option value="savings">Épargne</option>
                  <option value="project">Projet</option>
                  <option value="provision">Provision</option>
                </select>
              </label>
              <label className="field-label">
                <span>Solde initial (€)</span>
                <input name="initialBalance" type="number" step="0.01" className="field" placeholder="0.00" />
              </label>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                className="btn-quiet flex-1 px-4 py-3 text-sm font-semibold"
                onClick={() => setStep("calc")}
                type="button"
              >
                Passer
              </button>
              <button
                className="btn-primary flex-[2] inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold"
                type="submit"
                disabled={isCreating}
              >
                {isCreating ? "Création..." : "Créer la caisse"}
                {!isCreating && <ArrowRight className="size-4" />}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step: Calculator Intro */}
      {step === "calc" && (
        <div className="app-surface rounded-[2rem] p-6 sm:p-8 space-y-6 text-center animate-in fade-in slide-in-from-right-8">
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-600">
            <Calculator className="size-8" />
          </div>
          <div>
            <h2 className="display-title text-2xl sm:text-3xl">Automatisez les calculs</h2>
            <p className="mt-3 text-sm text-ink-700 max-w-md mx-auto leading-relaxed">
              Le module <strong>Calculateur</strong> vous permet de générer des formules personnalisées 
              (comme le calcul de TVA ou la répartition des frais) et d&apos;injecter directement le résultat 
              dans une caisse d&apos;épargne.
            </p>
          </div>
          
          <div className="max-w-xs mx-auto p-4 rounded-2xl border border-line bg-glass-bg text-left">
            <p className="text-xs font-bold text-sky-600 uppercase tracking-wider mb-2">Exemple pré-configuré</p>
            <p className="font-semibold text-sm">Provision TVA (20%)</p>
            <code className="text-xs mt-1 block text-ink-500 bg-black/5 p-1.5 rounded">Montant HT * 0.20</code>
          </div>
          
          <div className="flex flex-col gap-3 max-w-sm mx-auto pt-2">
            <button
              className="btn-primary w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold"
              disabled={isCreating}
              onClick={async () => {
                setIsCreating(true);
                try {
                  const formData = new FormData();
                  formData.set("name", "Provision TVA");
                  formData.set("formula", "{montant_ht} * 0.20");
                  formData.set("resultMode", "deposit");
                  formData.set("fieldsJson", JSON.stringify([{ key: "montant_ht", label: "Montant HT", type: "amount" }]));
                  
                  const csrfToken = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/)?.[1] ?? "";
                  const res = await fetch(`/api/households/${householdId}/savings/calculators`, {
                    method: "POST",
                    body: formData,
                    headers: csrfToken ? { "x-csrf-token": csrfToken } : {}
                  });
                  if (!res.ok) throw new Error();
                  success("Calculateur ajouté !");
                  setStep("invite");
                } catch {
                  showError("Erreur.");
                } finally {
                  setIsCreating(false);
                }
              }}
              type="button"
            >
              {isCreating ? "Création..." : "Ajouter ce calculateur type"}
              {!isCreating && <Plus className="size-4" />}
            </button>
            <button className="text-xs text-ink-400 hover:text-ink-700 font-medium" onClick={() => setStep("invite")}>
              Passer pour l&apos;instant
            </button>
          </div>
        </div>
      )}

      {/* Step: Invite */}
      {step === "invite" && (
        <div className="app-surface rounded-[2rem] p-6 sm:p-8 space-y-5 animate-in fade-in slide-in-from-right-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[rgba(47,109,136,0.12)] text-sky-600">
              <Users className="size-7" />
            </div>
            <h2 className="display-title text-2xl sm:text-3xl">Invitez votre équipe</h2>
            <p className="mt-2 text-sm text-ink-700">
              Quotidy prend tout son sens à plusieurs. Générez un lien d&apos;accès pour les membres de votre foyer.
            </p>
          </div>

          <form action={`/api/households/${householdId}/invites`} method="post" className="soft-panel p-5 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const headers: Record<string, string> = {};
              const csrfMatch = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/);
              if (csrfMatch?.[1]) headers["x-csrf-token"] = csrfMatch[1];
              const res = await fetch(`/api/households/${householdId}/invites`, { method: "POST", body: formData, headers });
              if (res.redirected) {
                window.location.href = res.url;
              } else if (res.ok) {
                success("Lien généré !");
                setStep("done");
              }
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                <span>Rôle</span>
                <select className="field" name="role" defaultValue="member">
                  <option value="member">Membre</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="field-label">
                <span>Expire dans (jours)</span>
                <input className="field" type="number" name="expiresInDays" defaultValue="7" min="1" max="30" />
              </label>
            </div>
            <button className="btn-primary w-full px-4 py-3 text-sm font-bold" type="submit">
              Générer un lien d&apos;invitation
            </button>
          </form>

          <button
            className="btn-quiet w-full px-4 py-3 text-sm font-semibold"
            onClick={() => setStep("done")}
            type="button"
          >
            Passer cette étape <ChevronRight className="inline size-4" />
          </button>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="app-surface rounded-[2rem] p-6 sm:p-8 text-center space-y-5 animate-in fade-in slide-in-from-right-8">
          <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-[rgba(56,115,93,0.12)] text-leaf-600">
            <CheckCircle2 className="size-10" />
          </div>
          <h2 className="display-title text-3xl sm:text-4xl">Tout est prêt !</h2>
          <p className="text-ink-700 leading-7">
            Votre foyer est configuré. Vous pouvez modifier tout cela à n&apos;importe quel moment 
            depuis l&apos;onglet <strong>Réglages</strong>.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center pt-2">
            <button
              className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold disabled:opacity-50"
              disabled={isCreating}
              onClick={completeOnboarding}
            >
              {isCreating ? "Finalisation..." : "Aller au tableau de bord"}
              {!isCreating && <ArrowRight className="size-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
