import {
  CircleUser,
  ListTodo,
  NotebookPen,
  PiggyBank,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AccentKey = "coral" | "sky" | "leaf" | "ink";

export type AppSection = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: AccentKey;
  /** Hidden when the household has the Épargne module disabled. */
  savingsGated?: boolean;
};

/**
 * Single source of truth for the app's 5 top-level "apps". Drives the home
 * launcher matrix AND the desktop sidebar — add an entry here and it shows up
 * in both. Each app is one coherent surface with its own internal sub-nav.
 */
export const appSections: AppSection[] = [
  {
    href: "/app/taches",
    label: "Tâches",
    description: "Jour, calendrier & routines",
    icon: ListTodo,
    accent: "coral",
  },
  {
    href: "/app/aide-memoire",
    label: "Aide-mémoire",
    description: "À faire & checklists du foyer",
    icon: NotebookPen,
    accent: "leaf",
  },
  {
    href: "/app/epargne",
    label: "Épargne",
    description: "Enveloppes & objectifs",
    icon: PiggyBank,
    accent: "sky",
    savingsGated: true,
  },
  {
    href: "/app/foyer",
    label: "Foyer",
    description: "Membres, foyers & accès",
    icon: Users,
    accent: "ink",
  },
  {
    href: "/app/compte",
    label: "Compte",
    description: "Profil & notifications",
    icon: CircleUser,
    accent: "coral",
  },
];

export const ACCENT_HEX: Record<AccentKey, string> = {
  coral: "#d8643d",
  sky: "#2f6d88",
  leaf: "#38735d",
  ink: "#545c68",
};

export function visibleSections(savingsEnabled: boolean): AppSection[] {
  return appSections.filter((s) => savingsEnabled || !s.savingsGated);
}
