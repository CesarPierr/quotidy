"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useOptimistic } from "react";
import {
  AlertTriangle,
  Bell,
  Calendar,
  ClipboardList,
  Globe,
  History,
  KeyRound,
  LayoutGrid,
  Plane,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

type SettingsPanelId =
  | "households"
  | "team"
  | "tasks"
  | "activity"
  | "access"
  | "planning"
  | "holidays"
  | "integrations"
  | "notifications"
  | "danger";

type SettingsTabsProps = {
  panels: Array<{
    id: SettingsPanelId;
    label: string;
    description: string;
  }>;
  householdId: string;
};

const panelIcons = {
  households: LayoutGrid,
  team: Users,
  tasks: ClipboardList,
  activity: History,
  access: KeyRound,
  planning: Calendar,
  holidays: Plane,
  integrations: Globe,
  notifications: Bell,
  danger: AlertTriangle,
} as const;

const FOYER_IDS = new Set<SettingsPanelId>([
  "households",
  "team",
  "tasks",
  "access",
  "planning",
  "holidays",
  "integrations",
  "danger",
]);
const MOI_IDS = new Set<SettingsPanelId>(["activity", "notifications"]);

export function SettingsTabs({ panels, householdId }: SettingsTabsProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Derive the active panel from the current pathname
  const activePanelFromUrl = panels.find(
    (p) => pathname === `/app/settings/${p.id}`,
  )?.id ?? null;

  const [optimisticActive, setOptimisticActive] = useOptimistic(activePanelFromUrl);

  // Prefetch all settings sub-routes on mount for instant tab switching
  useEffect(() => {
    for (const panel of panels) {
      router.prefetch(`/app/settings/${panel.id}?household=${householdId}`);
    }
  }, [panels, householdId, router]);

  const foyerPanels = panels.filter((p) => FOYER_IDS.has(p.id));
  const moiPanels = panels.filter((p) => MOI_IDS.has(p.id));

  function handleTabClick(panelId: SettingsPanelId) {
    if (panelId === optimisticActive) return;

    const href = `/app/settings/${panelId}?household=${householdId}`;
    startTransition(() => {
      setOptimisticActive(panelId);
      router.push(href);
    });
  }

  function renderPill(panel: (typeof panels)[number]) {
    const Icon = panelIcons[panel.id];
    const active = optimisticActive === panel.id;

    return (
      <button
        aria-current={active ? "page" : undefined}
        key={panel.id}
        type="button"
        onClick={() => handleTabClick(panel.id)}
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-150",
          active
            ? "border-coral-500 bg-white dark:bg-[#262830] text-coral-600 shadow-[0_8px_20px_rgba(216,100,61,0.08)] scale-[1.02]"
            : "border-line bg-white/80 dark:bg-[#262830]/80 text-ink-700 hover:border-ink-300 hover:bg-white dark:bg-[#262830] active:scale-95",
        )}
        title={panel.description}
      >
        <Icon className="size-4 opacity-60" />
        {panel.label}
      </button>
    );
  }

  // Use Link-based navigation as a fallback for the main settings page
  // (when navigating from the overview grid). The optimistic buttons handle
  // tab-to-tab switches above.
  return (
    <nav aria-label="Sections des réglages" className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
      {foyerPanels.length > 0 && (
        <>
          <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-ink-400">
            Foyer
          </span>
          {foyerPanels.map(renderPill)}
        </>
      )}
      {moiPanels.length > 0 && (
        <>
          <span className="ml-1 shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-ink-400">
            Moi
          </span>
          {moiPanels.map(renderPill)}
        </>
      )}
    </nav>
  );
}
