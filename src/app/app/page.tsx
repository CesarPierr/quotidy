import { startOfDay } from "date-fns";
import dynamic from "next/dynamic";

import { BudgetSummaryCard } from "@/components/budget/budget-summary-card";
import { ClientForm } from "@/components/shared/client-form";
import { SectionLauncher } from "@/components/dashboard/section-launcher";
import { requireUser } from "@/lib/auth";
import { getBudgetOverview } from "@/lib/budget";
import { db } from "@/lib/db";
import { canManageHousehold, getCurrentHouseholdContext } from "@/lib/households";

const OnboardingWizard = dynamic(
  () => import("@/components/onboarding/onboarding-wizard").then((m) => m.OnboardingWizard),
  { loading: () => <div className="app-surface rounded-[2rem] p-8 text-center text-ink-700 text-sm">Chargement…</div> },
);

type HomePageProps = {
  searchParams: Promise<{ household?: string; onboarding?: string; joined?: string; join?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
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

  // ── Launcher home: live badges per section ──────────────────────────────
  const today = startOfDay(new Date());
  const mine = context.currentMember?.id ?? null;
  const todayActionable = context.occurrences.filter(
    (o) =>
      (mine ? o.assignedMemberId === mine : true) &&
      ["planned", "due", "rescheduled"].includes(o.status) &&
      startOfDay(o.scheduledDate).getTime() === today.getTime(),
  ).length;
  const activeNotes = await db.householdNote.count({
    where: { householdId: context.household.id, completedAt: null },
  });

  const counts: Record<string, string | undefined> = {
    "/app/taches": todayActionable > 0 ? String(todayActionable) : undefined,
    "/app/aide-memoire": activeNotes > 0 ? String(activeNotes) : undefined,
  };

  const firstName = (context.currentMember?.displayName ?? user.displayName).split(" ")[0];

  const budgetOverview = await getBudgetOverview(context.household.id);
  const hasBudgetActivity =
    budgetOverview.totals.income > 0 ||
    budgetOverview.charges.length > 0 ||
    budgetOverview.pockets.length > 0 ||
    budgetOverview.recentExpenses.length > 0;

  return (
    <div className="space-y-4">
      {dashboardMessage ? (
        <div className="app-surface rounded-[1.7rem] border border-[rgba(56,115,93,0.12)] px-4 py-3 text-sm text-leaf-600">
          {dashboardMessage}
        </div>
      ) : null}
      {hasBudgetActivity ? (
        <BudgetSummaryCard overview={budgetOverview} householdId={context.household.id} />
      ) : null}
      <SectionLauncher
        counts={counts}
        firstName={firstName}
        householdId={context.household.id}
        householdName={context.household.name}
        savingsEnabled={context.household.savingsEnabled}
      />
    </div>
  );
}
