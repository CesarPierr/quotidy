import { startOfDay } from "date-fns";
import dynamic from "next/dynamic";

import { ClientForm } from "@/components/shared/client-form";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { requireUser } from "@/lib/auth";
import { buildLoadMetrics, buildRollingCompletionMetrics, calculateStreak } from "@/lib/analytics";
import { canManageHousehold, getCurrentHouseholdContext } from "@/lib/households";

const OnboardingWizard = dynamic(
  () => import("@/components/onboarding/onboarding-wizard").then((m) => m.OnboardingWizard),
  { loading: () => <div className="app-surface rounded-[2rem] p-8 text-center text-ink-700 text-sm">Chargement…</div> },
);

type DashboardPageProps = {
  searchParams: Promise<{ household?: string; onboarding?: string; joined?: string; join?: string; start?: string; view?: string }>;
};

/**
 * Pre-compute header metrics for a given view (moi vs foyer).
 * This runs once on the server so the client can switch views instantly.
 */
function computeViewMetrics(
  context: NonNullable<Awaited<ReturnType<typeof getCurrentHouseholdContext>>>,
  view: "moi" | "foyer",
  fallbackName: string,
) {
  const currentMemberId = context.currentMember?.id ?? null;
  const isPersonal = view === "moi";

  const headerOccurrences = isPersonal && currentMemberId
    ? context.occurrences.filter((o) => o.assignedMemberId === currentMemberId)
    : context.occurrences;
  const headerWeekOccurrences = isPersonal && currentMemberId
    ? context.weekOccurrences.filter((o) => o.assignedMemberId === currentMemberId)
    : context.weekOccurrences;

  const today = startOfDay(new Date());
  const todayCount = headerOccurrences.filter(
    (o) =>
      ["planned", "due", "rescheduled"].includes(o.status) &&
      startOfDay(o.scheduledDate).getTime() === today.getTime(),
  ).length;
  const overdueCount = headerOccurrences.filter((o) => o.status === "overdue").length;
  const weekDone = headerWeekOccurrences.filter((o) => o.status === "completed").length;
  const weekTotal = headerWeekOccurrences.filter((o) => o.status !== "cancelled").length;

  const firstName = (context.currentMember?.displayName ?? fallbackName).split(" ")[0];

  return {
    headerName: isPersonal ? firstName : context.household.name,
    scopeLabel: isPersonal ? "Mes tâches" : "Foyer entier",
    todayCount,
    overdueCount,
    weekDone,
    weekTotal,
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await getCurrentHouseholdContext(user.id, params.household);

  const dashboardMessage =
    params.joined === "1"
      ? "Nouveau foyer relié au compte. Vous pouvez maintenant passer d'un foyer à l'autre."
      : params.join === "invalid_code"
        ? "Code d'invitation introuvable ou expiré."
        : params.join === "invalid"
          ? "Lien d'invitation invalide ou expiré."
          : null;

  if (!context) {
    return (
      <section className="app-surface glow-card rounded-[2rem] p-6 sm:p-8">
        <p className="section-kicker">Bienvenue</p>
        <h2 className="display-title mt-2 text-4xl leading-tight sm:text-5xl">Mettez votre foyer en route</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700">
          Créez un foyer ou rejoignez-en un pour voir tout de suite ce qu&apos;il y a à faire aujourd&apos;hui.
        </p>
        {dashboardMessage ? (
          <div
            className="mt-5 rounded-[1.4rem] border px-4 py-3 text-sm leading-6 text-coral-600"
            style={{ backgroundColor: "rgba(216, 100, 61, 0.12)", borderColor: "rgba(30, 31, 34, 0.06)" }}
          >
            {dashboardMessage}
          </div>
        ) : null}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <ClientForm
            action="/api/households"
            method="POST"
            className="soft-panel compact-form-grid p-4"
            successMessage="Foyer créé."
            errorMessage="Impossible de créer le foyer."
          >
            <h3 className="text-lg font-semibold">Créer un foyer</h3>
            <label className="field-label">
              <span>Nom</span>
              <input className="field" type="text" name="name" placeholder="Nom du foyer" required />
            </label>
            <label className="field-label">
              <span>Fuseau horaire</span>
              <input
                className="field"
                type="text"
                name="timezone"
                defaultValue={process.env.DEFAULT_TIMEZONE ?? "Europe/Paris"}
                required
              />
            </label>
            <button className="btn-primary px-5 py-3 font-semibold" type="submit">
              Créer le foyer
            </button>
          </ClientForm>

          <ClientForm
            action="/api/invitations/redeem"
            method="POST"
            className="soft-panel compact-form-grid p-4"
            successMessage="Invitation appliquée."
            errorMessage="Impossible de rejoindre ce foyer."
          >
            <h3 className="text-lg font-semibold">Rejoindre un foyer</h3>
            <label className="field-label">
              <span>Code</span>
              <input className="field" type="text" name="code" placeholder="Code d'invitation" required />
            </label>
            <button className="btn-secondary px-5 py-3 font-semibold" type="submit">
              Rejoindre
            </button>
          </ClientForm>
        </div>
      </section>
    );
  }

  const needsOnboarding = !context.currentMember?.onboardingCompletedAt && canManageHousehold(context.membership.role);

  if (needsOnboarding) {
    return (
      <div className="space-y-4">
        {dashboardMessage ? (
          <div className="app-surface rounded-[1.7rem] border border-[rgba(56,115,93,0.12)] px-4 py-3 text-sm text-leaf-600">
            {dashboardMessage}
          </div>
        ) : null}
        <OnboardingWizard
          householdId={context.household.id}
          householdName={context.household.name}
          currentMemberName={context.currentMember?.displayName ?? "vous"}
        />
      </div>
    );
  }

  // Pre-compute metrics for BOTH views on the server so the client can
  // toggle between Moi and Foyer instantly with zero network requests.
  const moiMetrics = computeViewMetrics(context, "moi", user.displayName);
  const foyerMetrics = computeViewMetrics(context, "foyer", user.displayName);

  const streak = calculateStreak(context.occurrences);
  const loadData = buildLoadMetrics(context.household.members, context.occurrences);
  const rollingData = buildRollingCompletionMetrics(context.household.members, context.occurrences);

  const recentActivity = context.actionLogs
    .filter((log) => log.actionType !== "created")
    .slice(0, 5)
    .map((log) => ({
      id: log.id,
      actionType: log.actionType,
      createdAt: log.createdAt,
      actorName: log.actorMember?.displayName ?? "Le système",
      taskTitle: log.occurrence.taskTemplate.title,
    }));

  const completedCount = context.occurrences.filter((o) => o.status === "completed").length;

  // Determine initial view: honour ?view=foyer query param, default to "moi"
  const initialView = params.view === "foyer" ? "foyer" : "moi";

  return (
    <DashboardClient
      householdId={context.household.id}
      householdName={context.household.name}
      manageable={canManageHousehold(context.membership.role)}
      currentMemberId={context.currentMember?.id ?? null}
      members={context.household.members.map((member) => ({
        id: member.id,
        displayName: member.displayName,
      }))}
      moiMetrics={moiMetrics}
      foyerMetrics={foyerMetrics}
      streak={streak}
      memberStats={loadData.byMember}
      rollingMetrics={rollingData}
      recentActivity={recentActivity}
      occurrences={context.occurrences}
      weekOccurrences={context.weekOccurrences}
      completedCount={completedCount}
      initialView={initialView}
      autoStartSession={params.start === "session"}
      dashboardMessage={dashboardMessage}
    />
  );
}
