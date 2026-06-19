import { BudgetClient } from "@/components/budget/budget-client";
import { requireUser } from "@/lib/auth";
import { getBudgetOverview } from "@/lib/budget";
import { db } from "@/lib/db";
import { requireHouseholdContext } from "@/lib/households";

type BudgetPageProps = {
  searchParams: Promise<{ household?: string }>;
};

export default async function BudgetPage({ searchParams }: BudgetPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await requireHouseholdContext(user.id, params.household);
  const householdId = context.household.id;

  const [overview, savingsBoxes] = await Promise.all([
    getBudgetOverview(householdId),
    db.savingsBox.findMany({
      where: { householdId, isArchived: false },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return <BudgetClient householdId={householdId} initialOverview={overview} savingsBoxes={savingsBoxes} />;
}
