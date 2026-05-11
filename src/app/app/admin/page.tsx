import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { requireSiteAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AdminPage() {
  const user = await requireUser();
  await requireSiteAdmin(user);

  const [userCount, householdCount, openReports, recentReports, recentEvents] = await Promise.all([
    db.user.count(),
    db.household.count(),
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

  return (
    <section className="space-y-4">
      <div className="app-surface rounded-[2rem] p-5 sm:p-6">
        <p className="section-kicker">Admin</p>
        <h1 className="display-title mt-2 text-3xl">Pilotage bêta</h1>
        <p className="mt-3 text-sm text-ink-700">
          Vue opérateur minimale pour suivre l&apos;activation, les signalements et la santé de la bêta.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="metric-card p-4">
            <p className="text-sm text-ink-700">Utilisateurs</p>
            <p className="mt-1 text-3xl font-semibold">{userCount}</p>
          </div>
          <div className="metric-card p-4">
            <p className="text-sm text-ink-700">Foyers</p>
            <p className="mt-1 text-3xl font-semibold">{householdCount}</p>
          </div>
          <div className="metric-card p-4">
            <p className="text-sm text-ink-700">Signalements ouverts</p>
            <p className="mt-1 text-3xl font-semibold">{openReports}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="app-surface rounded-[2rem] p-5 sm:p-6">
          <h2 className="display-title text-2xl">Signalements récents</h2>
          <div className="mt-4 space-y-2">
            {recentReports.length ? recentReports.map((report) => (
              <article key={report.id} className="rounded-2xl border border-line bg-white/70 p-3 text-sm dark:bg-[#262830]/70">
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
          <h2 className="display-title text-2xl">Événements UX récents</h2>
          <div className="mt-4 space-y-2">
            {recentEvents.length ? recentEvents.map((event) => (
              <article key={event.id} className="rounded-2xl border border-line bg-white/70 p-3 text-sm dark:bg-[#262830]/70">
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
