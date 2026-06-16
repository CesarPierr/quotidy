"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Compass, HomeIcon, LogOut } from "lucide-react";

import { FeatureTour } from "@/components/onboarding/feature-tour";
import { FeedbackButton } from "@/components/shared/feedback-button";
import { PWAInstallBanner } from "@/components/shared/pwa-install-banner";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { QuotidyLogo } from "@/components/shared/quotidy-logo";
import { appSections, visibleSections } from "@/lib/app-sections";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  householdName?: string;
  currentHouseholdId?: string;
  /** Per-household feature snapshot. Used to hide the Épargne app when a
   * household has disabled the module. Falls back to "everything enabled". */
  households?: Array<{ id: string; name: string; savingsEnabled: boolean }>;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children, householdName, currentHouseholdId, households }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const householdIdFromUrl = searchParams.get("household");
  const activeHouseholdId = currentHouseholdId ?? householdIdFromUrl;
  const suffix = activeHouseholdId ? `?household=${activeHouseholdId}` : "";

  // Resolve the active household — fall back to the first one if URL is silent.
  const activeHousehold =
    households?.find((h) => h.id === activeHouseholdId) ?? households?.[0] ?? null;
  const savingsEnabled = activeHousehold?.savingsEnabled ?? true;

  const visibleSidebarSections = visibleSections(savingsEnabled);
  // Mobile bottom bar: "Accueil" (the launcher grid = scalable hub for ALL apps)
  // + the apps flagged `primary`. New apps surface in the grid automatically.
  const bottomTabs = [
    { href: "/app", label: "Accueil", icon: HomeIcon },
    ...visibleSidebarSections.filter((s) => s.primary).map((s) => ({ href: s.href, label: s.label, icon: s.icon })),
  ];
  const [tourOpen, setTourOpen] = useState(false);

  // Prefetch the launcher + apps on mount for instant navigation
  useEffect(() => {
    const routes = ["/app", ...appSections.map((s) => s.href)];
    for (const route of routes) {
      router.prefetch(`${route}${suffix}`);
    }
  }, [router, suffix]);

  useEffect(() => {
    if (searchParams.get("tour") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTourOpen(true);
    }
  }, [pathname, searchParams]);

  function closeTour() {
    setTourOpen(false);
    try {
      window.sessionStorage.setItem("mm.tour.v1.dismissed", "1");
    } catch {
      // no-op
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col lg:flex-row lg:gap-6 lg:p-6">
      {/* Sidebar for Desktop */}
      <nav className="hidden lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:w-64 lg:flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          <div className="app-surface glow-card rounded-[2rem] p-6">
            <Link aria-label="Accueil" href={`/app${suffix}`} className="inline-flex">
              <QuotidyLogo />
            </Link>
            <h2 className="mt-4 text-sm font-bold text-ink-950">{householdName ?? "Votre foyer"}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
              Organisez vos routines et votre budget. Partagez les responsabilités équitablement.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {visibleSidebarSections.map((item) => {
              const href = `${item.href}${suffix}`;
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all duration-300",
                    active
                      ? "bg-white text-ink-950 shadow-[0_12px_24px_-8px_rgba(70,48,20,0.12)] ring-1 ring-black/5 scale-[1.02]"
                      : "text-ink-700 hover:bg-white/40 hover:text-ink-950"
                  )}
                >
                  {active && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-coral-500 animate-in fade-in slide-in-from-left-1" />
                  )}
                  <Icon className="size-5 shrink-0" />
                  <div className="min-w-0">
                    <span>{item.label}</span>
                    <p className={cn("truncate text-[0.72rem] font-medium transition-colors", active ? "text-ink-600" : "text-ink-500")}>
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-auto space-y-3 pt-6">
          <button
            className="interactive-surface flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-ink-700 hover:bg-white dark:bg-[#262830] hover:text-ink-950 hover:shadow-sm"
            onClick={() => setTourOpen(true)}
            type="button"
          >
            <Compass className="size-5 shrink-0 text-coral-500" />
            <div className="min-w-0 text-left">
              <span className="block">Découvrir</span>
              <span className="truncate text-[0.72rem] font-medium text-ink-500">
                Visite guidée des panneaux
              </span>
            </div>
          </button>
          <ThemeToggle />
          <FeedbackButton className="w-full justify-center px-4 py-3 text-sm" />
          <form action="/api/auth/logout" method="post">
            <button
              className="btn-quiet flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
              type="submit"
            >
              <LogOut className="size-5" />
              Déconnexion
            </button>
          </form>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-1 min-w-0 flex-col px-3 pb-[7.5rem] pt-3 sm:px-5 lg:px-0 lg:pb-0 lg:pt-0">
        <main className="flex-1">{children}</main>

        <PWAInstallBanner />

        {/* Mobile bottom bar — Accueil (scalable launcher grid) + primary apps */}
        <nav
          className="app-surface fixed inset-x-3 bottom-3 z-30 rounded-2xl px-1.5 py-1.5 lg:hidden"
          style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${bottomTabs.length}, minmax(0, 1fr))` }}
          >
            {bottomTabs.map((item) => {
              const href = `${item.href}${suffix}`;
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  key={item.href}
                  href={href}
                  className={cn(
                    "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-2 text-center text-[0.65rem] font-semibold transition-all",
                    active
                      ? "bg-white text-ink-950 shadow-[0_8px_20px_rgba(70,48,20,0.12)] ring-1 ring-black/5 dark:bg-[#262830]"
                      : "text-[var(--ink-600)] active:bg-black/[0.04]",
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  <span className="leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      <FeatureTour open={tourOpen} onClose={closeTour} />
    </div>
  );
}
