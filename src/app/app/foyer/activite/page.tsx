import { format, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { ArrowRight, CheckCircle2, RotateCcw, SkipForward } from "lucide-react";

import { CollapsibleList } from "@/components/shared/collapsible-list";
import { ReopenButton } from "@/components/shared/reopen-button";
import { requireUser } from "@/lib/auth";
import {
  getHistoryActionDescription,
  getHistoryActionLabel,
  type HistoryFilter,
  summarizeHistoryLogs,
} from "@/lib/history";
import { loadHistoryFeed } from "@/lib/history-feed";
import { requireHouseholdContext } from "@/lib/households";
import { formatMinutes } from "@/lib/utils";

type ActivityPageProps = {
  searchParams: Promise<{ household?: string; filter?: HistoryFilter; cursor?: string }>;
};

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await requireHouseholdContext(user.id, params.household);
  const currentMemberId = context.currentMember?.id;

  const activeFilter: HistoryFilter =
    params.filter === "completed" ||
    params.filter === "skipped" ||
    params.filter === "rescheduled" ||
    params.filter === "edited"
      ? params.filter
      : "all";

  const { items: feedLogs, nextCursor } = await loadHistoryFeed(context.household.id, {
    cursor: params.cursor ?? null,
    filter: activeFilter,
  });

  // Past completed/skipped occurrences (last 30 days) — for the recoverable section
  const pastOccurrences = context.occurrences
    .filter((o) => o.status === "completed" || o.status === "skipped")
    .sort((a, b) => {
      const aDate = a.completedAt ?? a.scheduledDate;
      const bDate = b.completedAt ?? b.scheduledDate;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    })
    .slice(0, 20);

  // Summary cards still show the recent-activity sample (last 40 logs, all
  // action types) loaded by requireHouseholdContext — paginated feed below
  // can range over much older history depending on cursor.
  const summarySource = context.actionLogs.filter((log) => log.actionType !== "created");
  const historySummary = summarizeHistoryLogs(summarySource);

  // Today/earlier split is only meaningful on the first page; once the user
  // paginates back, every entry is "earlier" by definition.
  const isFirstPage = !params.cursor;
  const todayLogs = isFirstPage ? feedLogs.filter((log) => isToday(log.createdAt)) : [];
  const earlierLogs = isFirstPage ? feedLogs.filter((log) => !isToday(log.createdAt)) : feedLogs;
  const hasMore = Boolean(nextCursor);

  const buildFilterHref = (filter: HistoryFilter) => {
    const search = new URLSearchParams();
    if (params.household) search.set("household", params.household);
    if (filter !== "all") search.set("filter", filter);
    return `/app/foyer/activite?${search.toString()}`;
  };

  const buildLoadMoreHref = () => {
    const search = new URLSearchParams();
    if (params.household) search.set("household", params.household);
    if (activeFilter !== "all") search.set("filter", activeFilter);
    if (nextCursor) search.set("cursor", nextCursor);
    return `/app/foyer/activite?${search.toString()}`;
  };

  function getActionTone(actionType: string) {
    if (actionType === "completed") {
      return { icon: CheckCircle2, accent: "var(--leaf-600)", surface: "rgba(56, 115, 93, 0.1)" };
    }
    if (actionType === "skipped") {
      return { icon: SkipForward, accent: "var(--ink-950)", surface: "rgba(30, 31, 34, 0.06)" };
    }
    if (actionType === "rescheduled") {
      return { icon: RotateCcw, accent: "var(--sky-600)", surface: "rgba(47, 109, 136, 0.1)" };
    }
    return { icon: ArrowRight, accent: "var(--coral-600)", surface: "rgba(216, 100, 61, 0.1)" };
  }

  return (
    <section className="space-y-4">
      <div className="app-surface glow-card rounded-[2rem] p-5 sm:p-6">
        <p className="section-kicker">Activité</p>
        <h2 className="display-title mt-2 text-4xl leading-tight">Ce qui a bougé récemment</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-700">
          Retrouvez vite ce qui a été terminé, passé, déplacé ou corrigé, sans perdre le fil du foyer.
        </p>
        <div className="mt-5 summary-strip sm:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card interactive-surface px-4 py-3">
            <p className="text-sm text-ink-700">Terminées</p>
            <p className="mt-1 text-2xl font-semibold">{historySummary.completed}</p>
          </div>
          <div className="metric-card interactive-surface px-4 py-3">
            <p className="text-sm text-ink-700">Sautées</p>
            <p className="mt-1 text-2xl font-semibold">{historySummary.skipped}</p>
          </div>
          <div className="metric-card interactive-surface px-4 py-3">
            <p className="text-sm text-ink-700">Reportées</p>
            <p className="mt-1 text-2xl font-semibold">{historySummary.rescheduled}</p>
          </div>
          <div className="metric-card interactive-surface px-4 py-3">
            <p className="text-sm text-ink-700">Corrections</p>
            <p className="mt-1 text-2xl font-semibold">{historySummary.edited}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { value: "all" as const, label: "Tout" },
            { value: "completed" as const, label: "Terminées" },
            { value: "skipped" as const, label: "Sautées" },
            { value: "rescheduled" as const, label: "Reportées" },
            { value: "edited" as const, label: "Corrections" },
          ].map((filter) => {
            const active = filter.value === activeFilter;
            return (
              <Link
                key={filter.value}
                href={buildFilterHref(filter.value)}
                className={active ? "accent-pill border-ink-950 text-ink-950" : "accent-pill"}
              >
                <span
                  className="accent-pill-dot"
                  style={{
                    backgroundColor:
                      filter.value === "completed"
                        ? "var(--leaf-500)"
                        : filter.value === "skipped"
                          ? "var(--ink-500)"
                          : filter.value === "rescheduled"
                            ? "var(--sky-500)"
                            : filter.value === "edited"
                              ? "var(--coral-500)"
                              : "var(--line-strong)",
                  }}
                />
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recoverable past occurrences */}
      {pastOccurrences.length > 0 && currentMemberId ? (
        <section className="app-surface glow-card rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="section-kicker">Correction d&apos;erreur</p>
              <h3 className="display-title mt-1 text-2xl leading-tight">Tâches passées</h3>
            </div>
            <span className="text-xs text-ink-500">30 derniers jours</span>
          </div>
          <p className="text-sm text-ink-700 mb-4">
            Vous avez validé une tâche par erreur ? Retrouvez-la ici et remettez-la à faire.
          </p>
          <CollapsibleList
            initialCount={5}
            label="Voir toutes les tâches passées"
            items={pastOccurrences.map((occ) => {
              const isCompleted = occ.status === "completed";
              return (
                <article
                  key={occ.id}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-white/70 dark:bg-[#262830]/70 p-3"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: occ.taskTemplate.color ?? "var(--coral-500)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-950">{occ.taskTemplate.title}</p>
                    <p className="text-xs text-ink-500">
                      {isCompleted ? "Validée" : "Passée"} · {format(occ.scheduledDate, "d MMM", { locale: fr })}
                      {occ.completedByMember ? ` · ${occ.completedByMember.displayName}` : ""}
                      {occ.actualMinutes ? ` · ${formatMinutes(occ.actualMinutes)}` : ""}
                    </p>
                  </div>
                  <ReopenButton occurrenceId={occ.id} memberId={currentMemberId} compact />
                </article>
              );
            })}
          />
        </section>
      ) : null}

      <div className="space-y-4">
        {todayLogs.length ? (
          <section className="app-surface deferred-section rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Aujourd&apos;hui</p>
                <h3 className="display-title mt-2 text-2xl">À l&apos;instant</h3>
              </div>
              <span className="accent-pill">
                <span className="accent-pill-dot" style={{ backgroundColor: "var(--leaf-500)" }} />
                {todayLogs.length} action{todayLogs.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-5 space-y-2">
              {todayLogs.map((log) => {
                const actionLabel = getHistoryActionLabel(log.actionType);
                const actionDescription = getHistoryActionDescription(log);
                const tone = getActionTone(log.actionType);
                const Icon = tone.icon;
                return (
                  <article key={log.id} className="app-surface flex items-center gap-4 rounded-[1.3rem] p-3 transition-all hover:bg-white/50 dark:bg-[#262830]/50">
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-full shadow-sm"
                      style={{ backgroundColor: tone.surface, color: tone.accent, border: `1px solid ${tone.accent}20` }}
                    >
                      <Icon className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate font-semibold text-ink-950">{log.occurrence.taskTemplate.title}</h3>
                        <span className="shrink-0 text-[0.65rem] font-bold uppercase tracking-wider text-ink-500">
                          {format(log.createdAt, "HH:mm", { locale: fr })}
                        </span>
                      </div>
                      <p className="truncate text-xs text-ink-700">
                        <span className="font-bold" style={{ color: tone.accent }}>{actionLabel}</span> · {actionDescription}
                      </p>
                    </div>
                    {(log.actionType === "completed" || log.actionType === "skipped") && currentMemberId ? (
                      <ReopenButton occurrenceId={log.occurrence.id} memberId={currentMemberId} compact />
                    ) : (
                      <div className="hidden shrink-0 sm:block">
                        <span className="rounded-full bg-line px-2.5 py-1 text-[0.65rem] font-bold text-ink-700">
                          {log.actorMember?.displayName ?? "Système"}
                        </span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {earlierLogs.length ? (
          <section className="app-surface deferred-section rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Avant</p>
                <h3 className="display-title mt-2 text-2xl">Activité récente</h3>
              </div>
              <span className="accent-pill">
                <span className="accent-pill-dot" style={{ backgroundColor: "var(--sky-500)" }} />
                {earlierLogs.length} entrée{earlierLogs.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-5">
              <CollapsibleList
                initialCount={5}
                label="Voir toute l'activité récente"
                items={earlierLogs.map((log) => {
                  const actionLabel = getHistoryActionLabel(log.actionType);
                  const actionDescription = getHistoryActionDescription(log);
                  const tone = getActionTone(log.actionType);
                  const Icon = tone.icon;
                  return (
                    <article key={log.id} className="app-surface flex items-center gap-4 rounded-[1.3rem] p-3 transition-all hover:bg-white/50 dark:bg-[#262830]/50">
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-full shadow-sm"
                        style={{ backgroundColor: tone.surface, color: tone.accent, border: `1px solid ${tone.accent}20` }}
                      >
                        <Icon className="size-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate font-semibold text-ink-950">{log.occurrence.taskTemplate.title}</h3>
                          <span className="shrink-0 text-[0.65rem] font-bold uppercase tracking-wider text-ink-500">
                            {format(log.createdAt, "dd MMM", { locale: fr })}
                          </span>
                        </div>
                        <p className="truncate text-xs text-ink-700">
                          <span className="font-bold" style={{ color: tone.accent }}>{actionLabel}</span> · {actionDescription}
                        </p>
                      </div>
                      {log.actionType === "completed" && currentMemberId ? (
                        <ReopenButton occurrenceId={log.occurrence.id} memberId={currentMemberId} compact />
                      ) : (
                        <div className="hidden shrink-0 sm:block">
                          <span className="rounded-full bg-line px-2.5 py-1 text-[0.65rem] font-bold text-ink-700">
                            {log.actorMember?.displayName ?? "Système"}
                          </span>
                        </div>
                      )}
                    </article>
                  );
                })}
              />
            </div>
          </section>
        ) : null}

        {hasMore && (
          <div className="text-center">
            <Link
              className="btn-secondary inline-flex px-5 py-2.5 text-sm font-semibold"
              href={buildLoadMoreHref()}
            >
              Voir plus d&apos;historique
            </Link>
          </div>
        )}

        {!feedLogs.length && (
          <div className="app-surface rounded-[1.8rem] p-5 text-sm leading-6 text-ink-700">
            Rien de marquant pour ce filtre. Les validations, sauts, reports et corrections utiles apparaîtront ici.
          </div>
        )}
      </div>
    </section>
  );
}
