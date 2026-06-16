import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { startOfDay } from "date-fns";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageHousehold, requireHouseholdContext } from "@/lib/households";

const TaskSettingsList = dynamic(
  () => import("@/components/tasks/task-settings-list").then((m) => m.TaskSettingsList),
  {
    loading: () => <div className="soft-panel p-4 text-sm text-ink-700">Chargement…</div>,
  },
);

const TaskCreationWizard = dynamic(
  () => import("@/components/tasks/task-creation-wizard").then((m) => m.TaskCreationWizard),
  {
    loading: () => <div className="soft-panel p-4 text-sm text-ink-700">Chargement…</div>,
  },
);

type TasksSettingsPageProps = {
  searchParams: Promise<{ household?: string; tab?: "list" | "wizard"; edit?: string }>;
};

export default async function TasksSettingsPage({ searchParams }: TasksSettingsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await requireHouseholdContext(user.id, params.household);
  const manageable = canManageHousehold(context.membership.role);
  const activeTab = params.tab === "wizard" ? "wizard" : "list";

  if (!manageable) {
    redirect(`/app/taches/aujourd-hui?household=${context.household.id}`);
  }

  const today = startOfDay(new Date());
  const manualFutureOverrides = context.tasks.length
    ? await db.taskOccurrence.findMany({
        where: {
          householdId: context.household.id,
          taskTemplateId: { in: context.tasks.map((task) => task.id) },
          status: { in: ["planned", "due", "overdue", "rescheduled"] },
          scheduledDate: { gte: today },
          isManuallyModified: true,
        },
        select: { taskTemplateId: true },
      })
    : [];

  const manualOverridesByTaskId = manualFutureOverrides.reduce<Record<string, number>>(
    (acc, occurrence) => {
      acc[occurrence.taskTemplateId] = (acc[occurrence.taskTemplateId] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const householdSuffix = `?household=${context.household.id}`;

  return (
    <section className="space-y-5">
      <div className="app-surface glow-card rounded-[2rem] p-5 sm:p-6">
        <p className="section-kicker">Réglages · Tâches</p>
        <h2 className="display-title mt-2 text-3xl leading-tight sm:text-4xl">Gérer la bibliothèque de tâches</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700">
          Tout le catalogue du foyer : ajouter, modifier, archiver les routines. Les actions du jour restent dans{" "}
          <Link className="font-semibold text-coral-600 underline" href={`/app/taches/aujourd-hui${householdSuffix}`}>
            Aujourd&apos;hui
          </Link>
          .
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            aria-current={activeTab === "list" ? "page" : undefined}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
              activeTab === "list"
                ? "bg-coral-500 text-white shadow-[0_8px_20px_rgba(216,100,61,0.2)]"
                : "bg-white/80 dark:bg-[#262830]/80 border border-line text-ink-700 hover:bg-white dark:bg-[#262830]"
            }`}
            href={`/app/taches/routines${householdSuffix}`}
          >
            Catalogue ({context.tasks.length})
          </Link>
          <Link
            aria-current={activeTab === "wizard" ? "page" : undefined}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
              activeTab === "wizard"
                ? "bg-coral-500 text-white shadow-[0_8px_20px_rgba(216,100,61,0.2)]"
                : "bg-white/80 dark:bg-[#262830]/80 border border-line text-ink-700 hover:bg-white dark:bg-[#262830]"
            }`}
            href={`/app/taches/routines${householdSuffix}&tab=wizard`}
          >
            Ajouter une tâche
          </Link>
        </div>
      </div>

      {activeTab === "wizard" ? (
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
      ) : (
        <section className="app-surface rounded-[2rem] p-5 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Récurrences</p>
              <h3 className="display-title mt-2 text-2xl">Catalogue du foyer</h3>
            </div>
            <span className="accent-pill">
              <span className="accent-pill-dot" style={{ backgroundColor: "var(--sky-500)" }} />
              {context.tasks.length} tâche{context.tasks.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-5">
            <TaskSettingsList
              tasks={context.tasks}
              householdId={context.household.id}
              manualOverridesByTaskId={manualOverridesByTaskId}
              autoEditTaskId={params.edit ?? null}
            />
          </div>
        </section>
      )}
    </section>
  );
}
