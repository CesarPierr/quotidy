import { startOfDay } from "date-fns";
import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { requireUser } from "@/lib/auth";
import { buildLoadMetrics, buildRollingCompletionMetrics, calculateStreak } from "@/lib/analytics";
import { canManageHousehold, requireHouseholdContext } from "@/lib/households";

type AujourdhuiPageProps = {
  searchParams: Promise<{ household?: string; start?: string; view?: string }>;
};

/**
 * Pre-compute header metrics for a given view (moi vs foyer) on the server so
 * the client can switch views instantly.
 */
function computeViewMetrics(
  context: Awaited<ReturnType<typeof requireHouseholdContext>>,
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

export default async function AujourdhuiPage({ searchParams }: AujourdhuiPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await requireHouseholdContext(user.id, params.household);

  // First-run users finish onboarding from the launcher home.
  const needsOnboarding =
    !context.currentMember?.onboardingCompletedAt && canManageHousehold(context.membership.role);
  if (needsOnboarding) {
    redirect(`/app?household=${context.household.id}`);
  }

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
      dashboardMessage={null}
    />
  );
}
