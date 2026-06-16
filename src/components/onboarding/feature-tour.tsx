"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  LayoutGrid,
  PiggyBank,
  Calculator,
  Plane,
  Settings2,
  Sparkles,
  Timer,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

type Slide = {
  id: string;
  kicker: string;
  title: string;
  desc: string;
  accent: string;
  icon: LucideIcon;
  bullets: { icon: LucideIcon; label: string }[];
};

const SLIDES: Slide[] = [
  {
    id: "welcome",
    kicker: "Bienvenue",
    title: "Tout ce qu'il faut pour faire avancer le foyer",
    desc: "Quotidy répartit les tâches automatiquement, suit qui fait quoi et vous laisse vous concentrer sur l'essentiel.",
    accent: "var(--coral-500)",
    icon: Sparkles,
    bullets: [
      { icon: CheckCircle2, label: "Tâches récurrentes générées automatiquement" },
      { icon: Users, label: "Rotation équitable entre tous les membres" },
      { icon: Flame, label: "Streaks et statistiques pour rester motivé" },
    ],
  },
  {
    id: "today",
    kicker: "Onglet 1 — Aujourd'hui",
    title: "Votre point de départ",
    desc: "L'écran d'accueil priorise ce qui est en retard et ce qui est dû aujourd'hui. Une session minutée enchaîne les tâches d'une pièce sans friction.",
    accent: "var(--coral-500)",
    icon: LayoutGrid,
    bullets: [
      { icon: Clock3, label: "Tâches du jour, retards en tête" },
      { icon: Timer, label: "Session focus avec chronomètre par pièce" },
      { icon: Sparkles, label: "Reporter en un geste : Demain · Week-end" },
    ],
  },
  {
    id: "planifier",
    kicker: "Onglet 2 — Planifier",
    title: "La vue d'ensemble du futur",
    desc: "Calendrier mensuel avec qui fait quoi, vue agenda 7 jours sur mobile, et la liste de vos prochaines tâches personnelles.",
    accent: "var(--sky-500)",
    icon: CalendarDays,
    bullets: [
      { icon: CalendarDays, label: "Calendrier mensuel filtrable par membre" },
      { icon: CheckCircle2, label: "Mes tâches : ce qui m'attend" },
      { icon: Clock3, label: "Reprogrammation au clic" },
    ],
  },
  {
    id: "epargne",
    kicker: "Onglet 3 — Épargne",
    title: "Suivre vos finances communes",
    desc: "Gérez des caisses d'épargne partagées, des provisions pour vacances ou des dettes avec un historique complet.",
    accent: "var(--leaf-600)",
    icon: PiggyBank,
    bullets: [
      { icon: PiggyBank, label: "Caisses avec objectifs et suivi" },
      { icon: CheckCircle2, label: "Historique des dépôts, retraits et transferts" },
      { icon: Flame, label: "Règles de remplissage automatique" },
    ],
  },
  {
    id: "calc",
    kicker: "Module — Calculateur",
    title: "Automatiser les calculs",
    desc: "Créez des formules personnalisées (TVA, répartition de frais kilométriques...) pour injecter directement le bon montant en caisse.",
    accent: "var(--sky-500)",
    icon: Calculator,
    bullets: [
      { icon: Calculator, label: "Formules avec variables éditables" },
      { icon: CheckCircle2, label: "Résultats injectés en 1 clic dans une caisse" },
      { icon: Flame, label: "Arrondis et modes d'application configurables" },
    ],
  },
  {
    id: "reglages",
    kicker: "Onglet 4 — Réglages",
    title: "Adapter le foyer",
    desc: "Tout ce qui structure votre organisation : membres, tâches, invitations, vacances et intégrations.",
    accent: "var(--leaf-600)",
    icon: Settings2,
    bullets: [
      { icon: Users, label: "Équipe et invitations" },
      { icon: Plane, label: "Vacances : toutes les tâches reportées en bloc" },
      { icon: Settings2, label: "Catalogue de routines, notifications, MCP" },
    ],
  },
  {
    id: "stats",
    kicker: "En haut à droite",
    title: "Suivre l'équité et les streaks",
    desc: "Le bouton statistiques ouvre un volet avec votre série de complétion, la charge par membre et l'activité récente du foyer.",
    accent: "var(--coral-600)",
    icon: BarChart3,
    bullets: [
      { icon: Flame, label: "Streak de complétion personnel" },
      { icon: Users, label: "Charge équilibrée entre membres" },
      { icon: Sparkles, label: "Historique des actions du foyer" },
    ],
  },
];

type FeatureTourProps = {
  open: boolean;
  onClose: () => void;
};

export function FeatureTour({ open, onClose }: FeatureTourProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setIndex(0);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleClose() {
    try {
      window.localStorage.setItem("mm.tour.v1.completed", "1");
    } catch {
      // localStorage may be unavailable (SSR/private mode)
    }
    onClose();
  }

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      className="m-0 w-full max-w-xl rounded-[2rem] border-0 bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm sm:m-auto"
      aria-label="Découvrir l'application"
    >
      <div className="app-surface m-3 overflow-hidden rounded-[2rem] sm:m-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                aria-label={`Aller à l'étape ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-coral-500" : "w-2 bg-black/15 hover:bg-black/25"
                }`}
                onClick={() => setIndex(i)}
                type="button"
              />
            ))}
          </div>
          <button
            aria-label="Fermer"
            className="rounded-full p-1.5 text-ink-500 hover:bg-black/[0.05]"
            onClick={handleClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Slide */}
        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <div
            className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${slide.accent}1f`, color: slide.accent }}
          >
            <slide.icon className="size-8" />
          </div>
          <p className="text-center text-[0.65rem] font-bold uppercase tracking-[0.18em] text-ink-500">
            {slide.kicker}
          </p>
          <h2 className="display-title mt-1.5 text-center text-2xl leading-tight sm:text-3xl">
            {slide.title}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-ink-700">
            {slide.desc}
          </p>

          <ul className="mx-auto mt-5 grid max-w-md gap-2">
            {slide.bullets.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-2xl border border-line bg-white/60 dark:bg-surface/60 px-4 py-2.5"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${slide.accent}1a`, color: slide.accent }}
                >
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-medium text-ink-950">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-line bg-white/40 dark:bg-surface/40 px-5 py-3">
          <button
            className="btn-quiet inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold disabled:opacity-40"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            type="button"
          >
            <ArrowLeft className="size-3.5" />
            Précédent
          </button>
          <span className="text-[0.7rem] font-semibold text-ink-500">
            {index + 1} / {SLIDES.length}
          </span>
          {isLast ? (
            <button
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
              onClick={handleClose}
              type="button"
            >
              C&apos;est parti
              <Sparkles className="size-3.5" />
            </button>
          ) : (
            <button
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
              onClick={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))}
              type="button"
            >
              Suivant
              <ArrowRight className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}

/**
 * Inline version of the tour for embedding inside the onboarding wizard,
 * without the modal chrome. Same slides, same navigation.
 */
type FeatureTourInlineProps = {
  onComplete: () => void;
};

export function FeatureTourInline({ onComplete }: FeatureTourInlineProps) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-1.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            aria-label={`Aller à l'étape ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-coral-500" : "w-2 bg-black/15 hover:bg-black/25"
            }`}
            onClick={() => setIndex(i)}
            type="button"
          />
        ))}
      </div>

      <div>
        <div
          className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${slide.accent}1f`, color: slide.accent }}
        >
          <slide.icon className="size-8" />
        </div>
        <p className="text-center text-[0.65rem] font-bold uppercase tracking-[0.18em] text-ink-500">
          {slide.kicker}
        </p>
        <h2 className="display-title mt-1.5 text-center text-2xl leading-tight sm:text-3xl">
          {slide.title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-ink-700">
          {slide.desc}
        </p>

        <ul className="mx-auto mt-5 grid max-w-md gap-2">
          {slide.bullets.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-line bg-white/60 dark:bg-surface/60 px-4 py-2.5"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${slide.accent}1a`, color: slide.accent }}
              >
                <Icon className="size-4" />
              </span>
              <span className="text-sm font-medium text-ink-950">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          className="btn-quiet inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold disabled:opacity-40"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          type="button"
        >
          <ArrowLeft className="size-3.5" />
          Précédent
        </button>
        <span className="text-[0.7rem] font-semibold text-ink-500">
          {index + 1} / {SLIDES.length}
        </span>
        {isLast ? (
          <button
            className="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold"
            onClick={onComplete}
            type="button"
          >
            J&apos;ai compris
            <ArrowRight className="size-3.5" />
          </button>
        ) : (
          <button
            className="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold"
            onClick={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))}
            type="button"
          >
            Suivant
            <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
