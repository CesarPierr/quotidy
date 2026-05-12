"use client";

import { useState } from "react";
import { BarChart2, CheckCircle2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export type MemberStat = {
  memberId: string;
  displayName: string;
  color: string;
  completedCount: number;
  plannedMinutes: number;
  completionRate: number;
};

export type RollingPeriod = {
  days: number;
  byMember: Array<{
    memberId: string;
    displayName: string;
    color: string;
    completedCount: number;
    minutesSpent: number;
  }>;
};

export type ActivityEntry = {
  id: string;
  actionType: string;
  createdAt: Date | string;
  actorName: string;
  taskTitle: string;
};

export type GlobalStats = {
  completedTasks: number;
  completedMinutes: number;
  upcomingTasks: number;
  upcomingMinutes: number;
};

export type StatsDrawerProps = {
  streak: number;
  memberStats: MemberStat[];
  rollingMetrics: RollingPeriod[];
  recentActivity?: ActivityEntry[];
  householdId?: string;
  globalStats?: GlobalStats;
};

export function StatsDrawer({ streak, memberStats, rollingMetrics, globalStats }: StatsDrawerProps) {
  const [open, setOpen] = useState(false);

  const totalByPeriod = rollingMetrics.map((p) => {
    const totalCount = p.byMember.reduce((s, m) => s + m.completedCount, 0);
    const totalMinutes = p.byMember.reduce((s, m) => s + m.minutesSpent, 0);
    return { days: p.days, totalCount, totalMinutes };
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="stat-pill flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-sm"
        aria-label="Voir les statistiques du foyer"
      >
        <BarChart2 className="size-4 opacity-60" />
        {streak > 0 ? (
          <span>🔥 {streak}j</span>
        ) : (
          <span>Stats</span>
        )}
      </button>

      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Statistiques du foyer">
        <div className="space-y-5 pb-2">

          {streak > 0 && (
            <div className="flex items-center gap-4 rounded-2xl bg-[rgba(216,100,61,0.08)] border border-[rgba(216,100,61,0.12)] p-4">
              <span className="text-4xl leading-none">🔥</span>
              <div>
                <p className="text-xl font-bold text-ink-950">
                  {streak} jour{streak > 1 ? "s" : ""} de suite
                </p>
                <p className="text-sm text-ink-700 mt-0.5">
                  Le foyer a été actif chaque jour — continuez !
                </p>
              </div>
            </div>
          )}

          {globalStats && (
            <div className="grid grid-cols-2 gap-2">
              <div className="soft-panel px-4 py-4 border border-[var(--leaf-500)]/20 bg-[var(--leaf-500)]/5 dark:bg-[var(--leaf-500)]/10">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-leaf-600 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  Impact
                </p>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-3xl font-bold text-ink-950">
                    {Math.floor(globalStats.completedMinutes / 60) > 0 ? `${Math.floor(globalStats.completedMinutes / 60)}h` : ""}
                    {globalStats.completedMinutes % 60 > 0 ? `${(globalStats.completedMinutes % 60).toString().padStart(Math.floor(globalStats.completedMinutes / 60) > 0 ? 2 : 1, "0")}m` : (globalStats.completedMinutes === 0 ? "0m" : "")}
                  </span>
                </div>
                <p className="text-xs text-ink-500 font-medium mt-1">
                  <strong>{globalStats.completedTasks}</strong> tâches validées
                </p>
              </div>
              <div className="soft-panel px-4 py-4 border border-[var(--sky-500)]/20 bg-[var(--sky-500)]/5 dark:bg-[var(--sky-500)]/10">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-sky-600 mb-1 flex items-center gap-1.5">
                  <BarChart2 className="size-3.5" />
                  À venir (7j)
                </p>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-3xl font-bold text-ink-950">{globalStats.upcomingTasks}</span>
                  <span className="text-sm font-semibold text-ink-500">tâches</span>
                </div>
                <p className="text-xs text-ink-500 font-medium mt-1">
                  ~ {Math.floor(globalStats.upcomingMinutes / 60) > 0 ? `${Math.floor(globalStats.upcomingMinutes / 60)}h` : ""}
                  {globalStats.upcomingMinutes % 60 > 0 ? `${(globalStats.upcomingMinutes % 60).toString().padStart(Math.floor(globalStats.upcomingMinutes / 60) > 0 ? 2 : 1, "0")}m` : (globalStats.upcomingMinutes === 0 ? "0m" : "")} de charge
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-500 mb-3">
              Complétions récentes
            </p>
            <div className="grid grid-cols-3 gap-2">
              {totalByPeriod.map(({ days, totalCount, totalMinutes }) => (
                <div key={days} className="soft-panel text-center px-3 py-3">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-2xl font-bold text-ink-950">{totalCount}</span>
                    <span className="text-[0.65rem] text-ink-500 font-medium">tâches</span>
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-leaf-600">
                    {Math.floor(totalMinutes / 60) > 0 ? `${Math.floor(totalMinutes / 60)}h` : ""}
                    {totalMinutes % 60 > 0 ? `${(totalMinutes % 60).toString().padStart(Math.floor(totalMinutes / 60) > 0 ? 2 : 1, "0")}m` : "0m"}
                  </p>
                  <p className="mt-1.5 text-[0.6rem] uppercase tracking-wider text-ink-500">{days} derniers jours</p>
                </div>
              ))}
            </div>
          </div>



          {memberStats.length > 0 && (
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-500 mb-3">
                Répartition des responsabilités (30j)
              </p>
              <div className="space-y-2">
                {memberStats.map((m) => {
                  const maxPlanned = Math.max(...memberStats.map((s) => s.plannedMinutes), 1);
                  const barWidth = Math.round((m.plannedMinutes / maxPlanned) * 100);
                  return (
                    <div key={m.memberId} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: m.color }}
                          />
                          <span className="truncate font-medium text-ink-950">{m.displayName}</span>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-ink-700">
                          {Math.floor(m.plannedMinutes / 60) > 0 ? `${Math.floor(m.plannedMinutes / 60)}h` : ""}{m.plannedMinutes % 60}m à charge
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-line overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${barWidth}%`, backgroundColor: m.color }}
                        />
                      </div>
                      <p className="text-[0.65rem] text-ink-500 text-right mt-0.5">
                        dont {Math.round(m.completionRate)}% réalisées ({m.completedCount} tâches)
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </BottomSheet>
    </>
  );
}
