import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { requireSiteAdmin } from "@/lib/admin";
import { getAdminStats, purgeOldUxEvents } from "@/lib/admin-stats";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="metric-card p-4">
      <p className="text-sm text-ink-700">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

export default async function AdminPage() {
  const user = await requireUser();
  await requireSiteAdmin(user);

  // Lazy retention purge for telemetry (privacy + storage safeguard).
  await purgeOldUxEvents();

  const [stats, openReports, recentReports, recentEvents] = await Promise.all([
    getAdminStats(),
    db.feedbackReport.count({ where: { status: "open" } }),
    db.feedbackReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        reporter: { select: { email: true, displayName: true } },
        household: { select: { name: true } },
      },
    }),
    db.uxEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: { select: { email: true } },
        household: { select: { name: true } },
      },
    }),
  ]);

  const maxSeries = Math.max(...stats.series.map((s) => s.count), 1);

  return (
    <section className="space-y-4">
      <div className="app-surface rounded-[2rem] p-5 sm:p-6">
        <p className="section-kicker">Admin</p>
        <h1 className="display-title mt-2 text-3xl">Pilotage</h1>
        <p className="mt-3 text-sm text-ink-700">
          Indicateurs agrégés (sans donnée personnelle), activation et signalements.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <MetricCard label="Utilisateurs" value={stats.totals.users} hint={`+${stats.growth30.users} sur 30 j`} />
          <MetricCard label="Foyers" value={stats.totals.households} hint={`+${stats.growth30.households} sur 30 j`} />
          <MetricCard label="Actifs 7 j" value={stats.active.d7} hint={`${stats.active.d1} aujourd'hui`} />
          <MetricCard label="Actifs 30 j" value={stats.active.d30} />
          <MetricCard
            label="Complétion 30 j"
            value={`${stats.completion.rate}%`}
            hint={`${stats.completion.completed}/${stats.completion.scheduled} tâches`}
          />
          <MetricCard
            label="Onboarding"
            value={`${stats.onboarding.rate}%`}
            hint={`${stats.onboarding.completed}/${stats.onboarding.started} terminés`}
          />
          <MetricCard label="Signalements ouverts" value={openReports} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Active users sparkline */}
        <section className="app-surface rounded-[2rem] p-5 sm:p-6">
          <h2 className="display-title text-2xl">Utilisateurs actifs · 14 jours</h2>
          <div className="mt-5 flex h-32 items-end gap-1.5">
            {stats.series.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                <div
                  className="w-full rounded-t-md bg-coral-500/70 transition-all"
                  style={{ height: `${Math.max((d.count / maxSeries) * 100, 4)}%` }}
                />
                <span className="text-[0.55rem] text-ink-400">{d.date.slice(8, 10)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Feedback mix */}
        <section className="app-surface rounded-[2rem] p-5 sm:p-6">
          <h2 className="display-title text-2xl">Signalements</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="section-kicker">Par statut</p>
              <ul className="mt-2 space-y-1 text-sm">
                {stats.feedback.byStatus.length ? stats.feedback.byStatus.map((r) => (
                  <li key={r.status} className="flex justify-between gap-3">
                    <span className="capitalize text-ink-700">{r.status}</span>
                    <span className="font-semibold">{r.count}</span>
                  </li>
                )) : <li className="text-ink-500">Aucun.</li>}
              </ul>
            </div>
            <div>
              <p className="section-kicker">Par type</p>
              <ul className="mt-2 space-y-1 text-sm">
                {stats.feedback.byKind.length ? stats.feedback.byKind.map((r) => (
                  <li key={r.kind} className="flex justify-between gap-3">
                    <span className="capitalize text-ink-700">{r.kind}</span>
                    <span className="font-semibold">{r.count}</span>
                  </li>
                )) : <li className="text-ink-500">Aucun.</li>}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* Raw triage feeds (admins legitimately need contact + content for triage) */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="app-surface rounded-[2rem] p-5 sm:p-6">
          <h2 className="display-title text-2xl">Signalements récents</h2>
          <div className="mt-4 space-y-2">
            {recentReports.length ? recentReports.map((report) => (
              <article key={report.id} className="rounded-2xl border border-line bg-white/70 p-3 text-sm dark:bg-surface/70">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">{report.kind} · {report.status}</span>
                  <span className="text-xs text-ink-500">
                    {formatDistanceToNow(report.createdAt, { addSuffix: true, locale: fr })}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-ink-700">{report.message}</p>
                <p className="mt-2 text-xs text-ink-500">
                  {report.reporter?.email ?? "invité"} · {report.household?.name ?? "sans foyer"}
                </p>
                {report.githubUrl ? (
                  <Link className="mt-2 inline-flex text-xs font-semibold text-coral-600 underline" href={report.githubUrl}>
                    Issue GitHub
                  </Link>
                ) : null}
              </article>
            )) : (
              <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-ink-500">
                Aucun signalement.
              </p>
            )}
          </div>
        </section>

        <section className="app-surface rounded-[2rem] p-5 sm:p-6">
          <h2 className="display-title text-2xl">Événements récents</h2>
          <div className="mt-4 space-y-2">
            {recentEvents.length ? recentEvents.map((event) => (
              <article key={event.id} className="rounded-2xl border border-line bg-white/70 p-3 text-sm dark:bg-surface/70">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">{event.event}</span>
                  <span className="text-xs text-ink-500">
                    {formatDistanceToNow(event.createdAt, { addSuffix: true, locale: fr })}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  {event.user?.email ?? "anonyme"} · {event.household?.name ?? "sans foyer"} · {event.path ?? "sans route"}
                </p>
              </article>
            )) : (
              <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-ink-500">
                Aucun événement.
              </p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
