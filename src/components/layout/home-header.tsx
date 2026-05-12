import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertCircle, Calendar, CheckCircle2 } from "lucide-react";

import { StatsDrawer, type MemberStat, type RollingPeriod, type ActivityEntry } from "@/components/dashboard/stats-drawer";

type HomeHeaderProps = {
  firstName: string;
  scopeLabel?: string;
  todayCount: number;
  overdueCount: number;
  weekDone: number;
  weekTotal: number;
  streak: number;
  memberStats: MemberStat[];
  rollingMetrics: RollingPeriod[];
  recentActivity?: ActivityEntry[];
  householdId?: string;
  globalStats?: {
    completedTasks: number;
    completedMinutes: number;
    upcomingTasks: number;
    upcomingMinutes: number;
  };
};

export function HomeHeader({
  firstName,
  scopeLabel,
  todayCount,
  overdueCount,
  weekDone,
  weekTotal,
  streak,
  memberStats,
  rollingMetrics,
  recentActivity,
  householdId,
  globalStats,
}: HomeHeaderProps) {
  const dayLabel = format(new Date(), "EEEE d MMMM", { locale: fr });
  const progressPct = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;

  return (
    <section className="relative app-surface rounded-[1.35rem] p-3.5 sm:rounded-[1.6rem] sm:p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(15rem,1fr)_minmax(20rem,34rem)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-500 sm:text-xs sm:tracking-[0.16em]">
            {dayLabel}
            {scopeLabel ? <span className="ml-2 text-leaf-600">· {scopeLabel}</span> : null}
          </p>
          <h1 className="display-title truncate text-2xl leading-tight sm:text-[1.85rem]">
            Bonjour {firstName}
          </h1>
        </div>

        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <span
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold sm:text-sm"
              style={{ borderColor: "rgba(120, 53, 15, 0.2)", backgroundColor: "rgba(120, 53, 15, 0.08)", color: "#78350f" }}
            >
              <Calendar className="size-3.5" aria-hidden="true" />
              <span aria-live="polite">
                <span className="font-bold">{todayCount}</span>&nbsp;à faire aujourd&apos;hui
              </span>
            </span>
            {overdueCount > 0 ? (
              <span
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold sm:text-sm"
                style={{ borderColor: "rgba(127, 29, 29, 0.22)", backgroundColor: "rgba(127, 29, 29, 0.08)", color: "#7f1d1d" }}
              >
                <AlertCircle className="size-3.5" aria-hidden="true" />
                <span aria-live="polite">
                  <span className="font-bold">{overdueCount}</span>{" "}en retard
                </span>
              </span>
            ) : null}
          </div>

          {weekTotal > 0 ? (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-ink-700">
                  <CheckCircle2 className="size-3.5 text-leaf-600" aria-hidden="true" />
                  Cette semaine
                </span>
                <span className="font-semibold text-ink-700">
                  {weekDone} / {weekTotal} validée{weekTotal > 1 ? "s" : ""}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 w-full overflow-hidden rounded-full"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progression hebdomadaire : ${progressPct}%`}
                style={{ backgroundColor: "rgba(30,31,34,0.08)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progressPct}%`, backgroundColor: "var(--leaf-500)" }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="absolute right-3.5 top-3.5 lg:static lg:right-auto lg:top-auto">
          <StatsDrawer
            streak={streak}
            memberStats={memberStats}
            rollingMetrics={rollingMetrics}
            recentActivity={recentActivity}
            householdId={householdId}
            globalStats={globalStats}
          />
        </div>
      </div>
    </section>
  );
}
