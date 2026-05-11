import { startOfDay } from "date-fns";
import dynamic from "next/dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CollapsibleList } from "@/components/shared/collapsible-list";
import { OccurrenceCard } from "@/components/tasks/occurrence-card";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { groupOccurrencesByRoom } from "@/lib/experience";
import { canManageHousehold, requireHouseholdContext } from "@/lib/households";
import { cn, formatMinutes } from "@/lib/utils";

const TaskCreationWizard = dynamic(
  () => import("@/components/tasks/task-creation-wizard").then((module) => module.TaskCreationWizard),
  {
    loading: () => <div className="soft-panel p-4 text-sm text-ink-700">Chargement du formulaire…</div>,
  },
);
const TaskSettingsList = dynamic(
  () => import("@/components/tasks/task-settings-list").then((module) => module.TaskSettingsList),
  {
    loading: () => <div className="soft-panel p-4 text-sm text-ink-700">Chargement des récurrences…</div>,
  },
);
const CompletedTasksDialog = dynamic(
  () => import("@/components/tasks/completed-tasks-dialog").then((module) => module.CompletedTasksDialog),
);

type MyTasksPageProps = {
  searchParams: Promise<{
    household?: string;
    tab?: "daily" | "templates" | "wizard";
  }>;
};

export default async function MyTasksPage({ searchParams }: MyTasksPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const requestedTab: string = params.tab ?? "daily";
  const householdSuffix = params.household ? `?household=${params.household}` : "";

  // V3 IA: templates and wizard live in Réglages → Tâches now.
  if (requestedTab === "templates") {
    redirect(`/app/settings/tasks${householdSuffix}`);
  }
  if (requestedTab === "wizard") {
    redirect(`/app/settings/tasks${householdSuffix}${householdSuffix ? "&" : "?"}tab=wizard`);
  }

  const activeTab: string = requestedTab;
  const context = await requireHouseholdContext(user.id, params.household);
  const manageable = canManageHousehold(context.membership.role);

  const today = startOfDay(new Date());
  const myOccurrences = context.currentMember
    ? context.occurrences.filter((occurrence) => occurrence.assignedMemberId === context.currentMember?.id)
    : [];

  const todayAndOverdueAssigned = myOccurrences.filter(
    (occurrence) =>
      ["due", "overdue", "rescheduled"].includes(occurrence.status) ||
      (occurrence.status === "planned" && startOfDay(occurrence.scheduledDate) <= today),
  );

  const futureAssigned = myOccurrences.filter(
    (occurrence) => occurrence.status === "planned" && startOfDay(occurrence.scheduledDate) > today,
  );

  const closedAssigned = myOccurrences.filter((occurrence) =>
    ["completed", "skipped", "cancelled"].includes(occurrence.status),
  );

  const manualFutureOverrides =
    manageable && context.tasks.length
      ? await db.taskOccurrence.findMany({
          where: {
            householdId: context.household.id,
            taskTemplateId: {
              in: context.tasks.map((task) => task.id),
            },
            status: {
              in: ["planned", "due", "overdue", "rescheduled"],
            },
            scheduledDate: {
              gte: today,
            },
            isManuallyModified: true,
          },
          select: {
            taskTemplateId: true,
          },
        })
      : [];

  const manualOverridesByTaskId = manualFutureOverrides.reduce<Record<string, number>>((acc, occurrence) => {
    acc[occurrence.taskTemplateId] = (acc[occurrence.taskTemplateId] ?? 0) + 1;
    return acc;
  }, {});

  const manualOverrideCount = manualFutureOverrides.length;
  const todayByRoom = groupOccurrencesByRoom(todayAndOverdueAssigned);
  const futureByRoom = groupOccurrencesByRoom(futureAssigned);
  const todayMinutes = todayAndOverdueAssigned.reduce(
    (sum, occurrence) => sum + occurrence.taskTemplate.estimatedMinutes,
    0,
  );
  const futureMinutes = futureAssigned.reduce(
    (sum, occurrence) => sum + occurrence.taskTemplate.estimatedMinutes,
    0,
  );

  const tabBaseHref = (tab?: string) => {
    const p = new URLSearchParams();
    if (params.household) p.set("household", params.household);
    if (tab) p.set("tab", tab);
    return `/app/my-tasks?${p.toString()}`;
  };

  return (
    <section className="space-y-6">
      <div className="px-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="section-kicker">Planifier</p>
            <h2 className="display-title mt-1 text-3xl leading-tight sm:mt-2 sm:text-4xl">
              {manageable ? "Pilotage des tâches" : "Tâches du foyer"}
            </h2>
            <p className="mt-2 hidden max-w-3xl text-sm leading-6 text-ink-700 sm:block">
              Routines, tâches à venir et réglages de planning, sans diluer la vue d&apos;action.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              {
                label: "Maintenant",
                value: todayAndOverdueAssigned.length,
                detail: formatMinutes(todayMinutes),
              },
              {
                label: "À venir",
                value: futureAssigned.length,
                detail: formatMinutes(futureMinutes),
              },
              {
                label: "Clôturées",
                value: closedAssigned.length,
                detail: "récentes",
              },
              {
                label: "Modifiées",
                value: manualOverrideCount,
                detail: "protégées",
              },
            ].map((item) => (
              <span
                key={item.label}
                className="accent-pill bg-white shadow-sm dark:bg-[#262830]"
              >
                <span className="accent-pill-dot" style={{ backgroundColor: item.label === "Maintenant" ? "var(--coral-500)" : "var(--leaf-500)" }} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {item.value} {item.label}
                </span>
                <span className="text-[10px] font-semibold text-ink-500">{item.detail}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="sticky-subnav mt-4 sm:mt-6">
          <div className="glass-strip flex gap-2 overflow-x-auto rounded-[1.2rem] px-2 py-2 no-scrollbar sm:flex-wrap sm:rounded-[1.5rem] sm:px-3 sm:py-3">
            <Link
              href={tabBaseHref("daily")}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all sm:px-5 sm:py-2.5",
                activeTab === "daily"
                  ? "bg-white dark:bg-[#262830] text-ink-950 border-2 border-ink-950 shadow-lg scale-105"
                  : "bg-white/80 dark:bg-[#262830]/80 border border-line text-ink-700 hover:bg-white dark:bg-[#262830]",
              )}
            >
              Ma journée
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.6rem] font-bold",
                  activeTab === "daily" ? "bg-ink-950 text-white" : "bg-line text-ink-950",
                )}
              >
                {todayAndOverdueAssigned.length}
              </span>
            </Link>

            {manageable ? (
              <>
                <Link
                  href={tabBaseHref("templates")}
                  className={cn(
                    "flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all sm:px-5 sm:py-2.5",
                    activeTab === "templates"
                      ? "bg-white dark:bg-[#262830] text-ink-950 border-2 border-ink-950 shadow-lg scale-105"
                      : "bg-white/80 dark:bg-[#262830]/80 border border-line text-ink-700 hover:bg-white dark:bg-[#262830]",
                  )}
                >
                  Routines
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.6rem] font-bold",
                      activeTab === "templates"
                        ? "bg-ink-950 text-white"
                        : "bg-line text-ink-950",
                    )}
                  >
                    {context.tasks.length}
                  </span>
                </Link>
                <Link
                  href={tabBaseHref("wizard")}
                  className={cn(
                    "flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all sm:px-5 sm:py-2.5",
                    activeTab === "wizard"
                      ? "bg-white dark:bg-[#262830] text-ink-950 border-2 border-ink-950 shadow-lg scale-105"
                      : "bg-white/80 dark:bg-[#262830]/80 border border-line text-ink-700 hover:bg-white dark:bg-[#262830]",
                  )}
                >
                  Ajouter
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {activeTab === "daily" ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section className="app-surface deferred-section rounded-[2rem] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="section-kicker">Priorités</p>
                  <h3 className="display-title mt-1 text-2xl leading-tight sm:mt-2 sm:text-3xl">
                    À faire maintenant
                  </h3>
                </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="accent-pill">
                  <span className="accent-pill-dot" style={{ backgroundColor: "var(--coral-500)" }} />
                  {todayAndOverdueAssigned.length} tâche{todayAndOverdueAssigned.length > 1 ? "s" : ""}
                </span>
                <span className="accent-pill">
                  <span className="accent-pill-dot" style={{ backgroundColor: "var(--leaf-500)" }} />
                  {formatMinutes(todayMinutes)}
                </span>
              </div>
            </div>

            <div className="mt-5">
              {todayAndOverdueAssigned.length ? (
                <div className="space-y-4">
                  {todayByRoom.map(({ room, occurrences, totalMinutes }) => (
                    <div key={room} className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="stat-pill px-3 py-1 text-xs font-semibold">{room}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                            {occurrences.length} tâche{occurrences.length > 1 ? "s" : ""}
                          </span>
                          <span className="stat-pill px-3 py-1 text-xs font-semibold">{formatMinutes(totalMinutes)}</span>
                        </div>
                      </div>
                      {occurrences.map((occurrence) => (
                        <OccurrenceCard
                          key={occurrence.id}
                          occurrence={occurrence}
                          members={context.household.members}
                          currentMemberId={context.currentMember?.id}
                          returnTo={tabBaseHref("daily")}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="soft-panel py-8 text-center text-ink-700">
                  C&apos;est tout pour aujourd&apos;hui ! 🎉
                </div>
              )}
            </div>
          </section>

          {futureAssigned.length > 0 ? (
            <section className="app-surface deferred-section rounded-[2rem] p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="section-kicker">Prochainement</p>
                  <h3 className="display-title mt-1 text-2xl leading-tight sm:mt-2 sm:text-3xl">Ensuite</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="accent-pill">
                    <span className="accent-pill-dot" style={{ backgroundColor: "var(--sky-500)" }} />
                    {futureAssigned.length} occurrence{futureAssigned.length > 1 ? "s" : ""}
                  </span>
                  <span className="accent-pill">
                    <span className="accent-pill-dot" style={{ backgroundColor: "var(--leaf-500)" }} />
                    {formatMinutes(futureMinutes)}
                  </span>
                </div>
              </div>
              <div className="mt-5">
                <CollapsibleList
                  initialCount={3}
                  items={futureByRoom.map(({ room, occurrences, totalMinutes }) => (
                    <div key={room} className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="stat-pill px-3 py-1 text-xs font-semibold">{room}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                            {occurrences.length} tâche{occurrences.length > 1 ? "s" : ""}
                          </span>
                          <span className="stat-pill px-3 py-1 text-xs font-semibold">{formatMinutes(totalMinutes)}</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {occurrences.map((occurrence) => (
                          <OccurrenceCard
                            key={occurrence.id}
                            occurrence={occurrence}
                            members={context.household.members}
                            currentMemberId={context.currentMember?.id}
                            returnTo={tabBaseHref("daily")}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                />
              </div>
            </section>
          ) : null}

          {closedAssigned.length ? (
            <section className="app-surface deferred-section rounded-[2rem] p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="section-kicker">Récemment</p>
                  <h3 className="display-title mt-1 text-2xl leading-tight sm:mt-2">Terminé récemment</h3>
                </div>
                <span className="accent-pill">
                  <span className="accent-pill-dot" style={{ backgroundColor: "var(--leaf-500)" }} />
                  {closedAssigned.length} action{closedAssigned.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="mt-5">
                <CompletedTasksDialog
                  tasks={closedAssigned}
                  members={context.household.members}
                  currentMemberId={context.currentMember?.id}
                />
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {activeTab === "templates" && manageable ? (
        <section className="app-surface deferred-section rounded-[2rem] p-5 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Routines</p>
              <h3 className="display-title mt-2 text-3xl">Bibliothèque de tâches</h3>
              <p className="mt-2 text-sm leading-6 text-ink-700">
                Toutes les routines du foyer restent ici, à part du quotidien, pour garder l&apos;action simple.
              </p>
            </div>
            <span className="accent-pill">
              <span className="accent-pill-dot" style={{ backgroundColor: "var(--sky-500)" }} />
              {context.tasks.length} tâche{context.tasks.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-6">
            <TaskSettingsList
              tasks={context.tasks}
              householdId={context.household.id}
              manualOverridesByTaskId={manualOverridesByTaskId}
            />
          </div>
        </section>
      ) : null}

      {activeTab === "wizard" && manageable ? (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <TaskCreationWizard
            householdId={context.household.id}
            members={context.household.members.map((member) => ({
              id: member.id,
              displayName: member.displayName,
              color: member.color,
            }))}
          />
        </section>
      ) : null}
    </section>
  );
}
