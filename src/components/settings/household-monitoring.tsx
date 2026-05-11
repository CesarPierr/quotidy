import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Activity, CalendarClock, ChevronDown, Clock3, PiggyBank, TrendingUp } from "lucide-react";

import type { HouseholdMonitoringSnapshot } from "@/lib/household-monitoring";
import { formatCurrency } from "@/lib/savings/currency";
import { cn, formatMinutes } from "@/lib/utils";

type HouseholdMonitoringProps = {
  snapshot: HouseholdMonitoringSnapshot;
};

function ProgressBar({ value, color = "var(--leaf-500)" }: { value: number; color?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
    </div>
  );
}

function MetricPill({ children, tone = "leaf" }: { children: React.ReactNode; tone?: "leaf" | "coral" | "sky" }) {
  const color = tone === "coral" ? "var(--coral-500)" : tone === "sky" ? "var(--sky-500)" : "var(--leaf-500)";
  return (
    <span className="accent-pill bg-white shadow-sm dark:bg-[#262830]">
      <span className="accent-pill-dot" style={{ backgroundColor: color }} />
      {children}
    </span>
  );
}

export function HouseholdMonitoring({ snapshot }: HouseholdMonitoringProps) {
  const last30 = snapshot.rolling.find((window) => window.days === 30) ?? snapshot.rolling[0];
  const maxMemberMinutes = Math.max(1, ...snapshot.upcoming.byMember.map((member) => member.minutes));

  return (
    <section className="space-y-3 sm:space-y-4" aria-label="Monitoring du foyer">
      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Monitoring foyer</p>
          <h3 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">Vue de gestion</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-700">
            Une lecture rapide de ce qui a été fait, de ce qui arrive et de l&apos;impact budget.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetricPill tone="leaf">
            <span className="text-[10px] font-bold uppercase tracking-wider">{last30.completedCount} faites</span>
            <span className="text-[10px] text-ink-500">30 j</span>
          </MetricPill>
          <MetricPill tone="sky">
            <span className="text-[10px] font-bold uppercase tracking-wider">{snapshot.upcoming.next30Count} à venir</span>
            <span className="text-[10px] text-ink-500">30 j</span>
          </MetricPill>
          {snapshot.upcoming.overdueCount ? (
            <MetricPill tone="coral">
              <span className="text-[10px] font-bold uppercase tracking-wider">{snapshot.upcoming.overdueCount} retards</span>
            </MetricPill>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <article className="app-surface rounded-[1.5rem] p-4 sm:rounded-[1.8rem] sm:p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-[rgba(56,115,93,0.12)] p-2.5 text-leaf-600">
              <Activity className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-500">Derniers 30 jours</p>
              <p className="mt-1 text-2xl font-semibold">{last30.completionRate}%</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-700">
            {last30.completedCount} tâches validées, {formatMinutes(last30.completedMinutes)} passées.
          </p>
          <div className="mt-3">
            <ProgressBar value={last30.completionRate} />
          </div>
        </article>

        <article className="app-surface rounded-[1.5rem] p-4 sm:rounded-[1.8rem] sm:p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-[rgba(38,119,153,0.12)] p-2.5 text-sky-600">
              <CalendarClock className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-500">À venir</p>
              <p className="mt-1 text-2xl font-semibold">{snapshot.upcoming.next7Count} tâches</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-700">
            {formatMinutes(snapshot.upcoming.next7Minutes)} sur 7 jours, {formatMinutes(snapshot.upcoming.next30Minutes)} sur 30 jours.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="stat-pill px-3 py-1 text-xs">{snapshot.upcoming.next30Count} sur 30 j</span>
            <span className="stat-pill px-3 py-1 text-xs">{snapshot.upcoming.overdueCount} en retard</span>
          </div>
        </article>

        <article className="app-surface rounded-[1.5rem] p-4 sm:rounded-[1.8rem] sm:p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-[rgba(216,100,61,0.12)] p-2.5 text-coral-600">
              <PiggyBank className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-500">Budget récent</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(snapshot.savings.last30Expenses)}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-700">
            Sorties sur 30 jours. Entrées: {formatCurrency(snapshot.savings.last30Income)}.
          </p>
          <p className="mt-2 text-xs text-ink-500">
            90 jours: {formatCurrency(snapshot.savings.last90Expenses)} de sorties.
          </p>
        </article>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
        <details className="app-surface group rounded-[1.5rem] p-4 sm:rounded-[1.8rem] sm:p-5" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <p className="section-kicker text-[0.62rem]">Charge à venir</p>
              <h4 className="display-title mt-1 text-xl">Répartition sur 30 jours</h4>
            </div>
            <ChevronDown className="size-5 text-ink-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-3">
            {snapshot.upcoming.byMember.map((member) => (
              <div key={member.memberId} className="rounded-2xl border border-line bg-white/65 p-3 dark:bg-[#262830]/65">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: member.color }} />
                    <p className="truncate text-sm font-semibold">{member.displayName}</p>
                  </div>
                  <p className="text-xs font-semibold text-ink-600">
                    {member.taskCount} tâche{member.taskCount > 1 ? "s" : ""} · {formatMinutes(member.minutes)}
                  </p>
                </div>
                <div className="mt-2">
                  <ProgressBar value={(member.minutes / maxMemberMinutes) * 100} color={member.color} />
                </div>
              </div>
            ))}
          </div>
        </details>

        <details className="app-surface group rounded-[1.5rem] p-4 sm:rounded-[1.8rem] sm:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <p className="section-kicker text-[0.62rem]">Glissant</p>
              <h4 className="display-title mt-1 text-xl">7, 30, 90 jours</h4>
            </div>
            <ChevronDown className="size-5 text-ink-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 grid gap-2">
            {snapshot.rolling.map((window) => (
              <div key={window.days} className="rounded-2xl border border-line bg-white/65 p-3 dark:bg-[#262830]/65">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{window.days} jours</p>
                  <p className="text-sm font-semibold text-ink-600">{window.completionRate}% validées</p>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-ink-600">
                  <span>{window.completedCount} faites</span>
                  <span>{formatMinutes(window.completedMinutes)}</span>
                  <span>{window.skippedCount} passées</span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={window.completionRate} />
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="grid gap-3 xl:grid-cols-2 xl:items-start">
        <details className="app-surface group rounded-[1.5rem] p-4 sm:rounded-[1.8rem] sm:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <p className="section-kicker text-[0.62rem]">Routines réellement utiles</p>
              <h4 className="display-title mt-1 text-xl">Temps passé récemment</h4>
            </div>
            <ChevronDown className="size-5 text-ink-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-2">
            {snapshot.topCompletedTasks.length ? (
              snapshot.topCompletedTasks.map((task) => (
                <div key={task.title} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/65 px-3 py-2.5 text-sm dark:bg-[#262830]/65">
                  <span className="truncate font-semibold">{task.title}</span>
                  <span className="shrink-0 text-xs text-ink-600">{task.count}x · {formatMinutes(task.minutes)}</span>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-line bg-white/65 p-3 text-sm text-ink-600 dark:bg-[#262830]/65">
                Pas encore assez de tâches complétées pour faire ressortir une tendance.
              </p>
            )}
          </div>
        </details>

        <details className="app-surface group rounded-[1.5rem] p-4 sm:rounded-[1.8rem] sm:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <p className="section-kicker text-[0.62rem]">Épargne & dépenses</p>
              <h4 className="display-title mt-1 text-xl">Mouvements à surveiller</h4>
            </div>
            <ChevronDown className="size-5 text-ink-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-500">
                <Clock3 className="size-3.5" />
                Récurrences à venir
              </p>
              <div className="space-y-2">
                {snapshot.savings.recurringMovements.length ? (
                  snapshot.savings.recurringMovements.map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/65 px-3 py-2.5 text-sm dark:bg-[#262830]/65">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{movement.boxName}</span>
                        <span className="text-xs text-ink-500">
                          {movement.nextDate ? format(movement.nextDate, "d MMM", { locale: fr }) : "Aucune date proche"}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold">{formatCurrency(movement.amount)}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-line bg-white/65 p-3 text-sm text-ink-600 dark:bg-[#262830]/65">
                    Aucune récurrence d&apos;épargne active.
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-500">
                <TrendingUp className="size-3.5" />
                Dernières sorties
              </p>
              <div className="space-y-2">
                {snapshot.savings.recentExpenses.length ? (
                  snapshot.savings.recentExpenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/65 px-3 py-2.5 text-sm dark:bg-[#262830]/65">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{expense.reason || expense.boxName}</span>
                        <span className="text-xs text-ink-500">{format(expense.occurredOn, "d MMM", { locale: fr })} · {expense.boxName}</span>
                      </span>
                      <span className={cn("shrink-0 font-semibold", expense.signedAmount < 0 ? "text-coral-600" : "text-leaf-600")}>
                        {formatCurrency(expense.signedAmount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-line bg-white/65 p-3 text-sm text-ink-600 dark:bg-[#262830]/65">
                    Aucune dépense récente enregistrée.
                  </p>
                )}
              </div>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
