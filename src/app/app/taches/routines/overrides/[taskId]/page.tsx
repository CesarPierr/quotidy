import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OccurrenceCard } from "@/components/tasks/occurrence-card";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageHousehold, requireHouseholdContext } from "@/lib/households";
import { getHistoryActionLabel } from "@/lib/history";

type OverridePageProps = {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ household?: string }>;
};

function describeOverrideKinds(occurrence: {
  status: string;
  actualMinutes: number | null;
  notes: string | null;
  scheduledDate: Date;
  originalScheduledDate: Date;
  logs: { actionType: string }[];
}) {
  const labels: string[] = [];

  if (occurrence.scheduledDate.getTime() !== occurrence.originalScheduledDate.getTime()) {
    labels.push("Date déplacée");
  }

  if (occurrence.logs.some((log) => log.actionType === "reassigned")) {
    labels.push("Attribution changée");
  }

  if (occurrence.actualMinutes !== null) {
    labels.push(`Temps réel ${occurrence.actualMinutes} min`);
  }

  if (occurrence.notes) {
    labels.push("Note ajoutée");
  }

  if (["completed", "skipped", "rescheduled"].includes(occurrence.status)) {
    labels.push(`Statut ${getHistoryActionLabel(occurrence.status as "completed" | "skipped" | "rescheduled")}`);
  }

  return [...new Set(labels)];
}

export default async function TaskOverridesPage({ params, searchParams }: OverridePageProps) {
  const user = await requireUser();
  const routeParams = await params;
  const query = await searchParams;
  const context = await requireHouseholdContext(user.id, query.household);

  if (!canManageHousehold(context.membership.role)) {
    redirect(`/app/taches/routines?household=${context.household.id}`);
  }

  const task = context.tasks.find((entry) => entry.id === routeParams.taskId);

  if (!task) {
    redirect(`/app/taches/routines?household=${context.household.id}`);
  }

  const occurrences = await db.taskOccurrence.findMany({
    where: {
      householdId: context.household.id,
      taskTemplateId: routeParams.taskId,
      scheduledDate: {
        gte: new Date(),
      },
      status: {
        not: "cancelled",
      },
      isManuallyModified: true,
    },
    include: {
      taskTemplate: true,
      assignedMember: true,
      completedByMember: true,
      logs: {
        include: {
          actorMember: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 3,
      },
    },
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
  });

  const returnTo = `/app/taches/routines/overrides/${routeParams.taskId}?household=${context.household.id}`;

  return (
    <section className="space-y-4">
      <div className="app-surface glow-card rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="stat-pill px-3 py-1 text-xs font-semibold text-ink-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(30,31,34,0.08)]"
            href={`/app/taches/routines?household=${context.household.id}`}
          >
            Retour aux tâches
          </Link>
          <span className="stat-pill px-3 py-1 text-xs font-semibold">
            {occurrences.length} occurrence{occurrences.length > 1 ? "s" : ""}
          </span>
        </div>
        <p className="section-kicker mt-4">Occurrences modifiées</p>
        <h2 className="display-title mt-2 text-4xl leading-tight">{task.title}</h2>
        <p className="mt-3 max-w-2xl text-sm text-ink-700">
          Cette vue regroupe les prochaines occurrences ajustées manuellement. Vous pouvez voir ce qui a changé et les modifier à nouveau sans repasser par toute l&apos;administration.
        </p>
      </div>

      {occurrences.length ? (
        <div className="space-y-4">
          {occurrences.map((occurrence) => {
            const overrideKinds = describeOverrideKinds(occurrence);
            const latestLog = occurrence.logs[0] ?? null;

            return (
              <div key={occurrence.id} className="space-y-3">
                <div className="soft-panel space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {overrideKinds.map((label) => (
                      <span key={label} className="stat-pill px-3 py-1 text-xs font-semibold">
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="grid gap-3 text-sm text-ink-700 sm:grid-cols-2">
                    <p>
                      Date d&apos;origine:{" "}
                      <strong className="text-ink-950">
                        {format(occurrence.originalScheduledDate, "EEE d MMM yyyy", { locale: fr })}
                      </strong>
                    </p>
                    <p>
                      Date actuelle:{" "}
                      <strong className="text-ink-950">
                        {format(occurrence.scheduledDate, "EEE d MMM yyyy", { locale: fr })}
                      </strong>
                    </p>
                  </div>
                  {latestLog ? (
                    <p className="text-sm text-ink-700">
                      Dernier changement:{" "}
                      <strong className="text-ink-950">
                        {getHistoryActionLabel(latestLog.actionType)}
                      </strong>{" "}
                      le {format(latestLog.createdAt, "d MMM yyyy à HH:mm", { locale: fr })}
                      {latestLog.actorMember ? ` par ${latestLog.actorMember.displayName}` : ""}.
                    </p>
                  ) : null}
                </div>

                <OccurrenceCard
                  occurrence={occurrence}
                  members={context.household.members}
                  currentMemberId={context.currentMember?.id}
                  returnTo={returnTo}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="app-surface rounded-[1.8rem] p-5 text-sm leading-6 text-ink-700">
          Aucune occurrence future modifiée pour cette tâche.
        </div>
      )}
    </section>
  );
}
