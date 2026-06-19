import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { formatCurrency } from "@/lib/savings/currency";
import type { BudgetOverview } from "@/lib/budget";

type BudgetSummaryCardProps = {
  overview: BudgetOverview;
  householdId: string;
};

export function BudgetSummaryCard({ overview, householdId }: BudgetSummaryCardProps) {
  const { totals } = overview;
  const positive = totals.reste >= 0;

  return (
    <Link
      href={`/app/budget?household=${householdId}`}
      className="app-surface interactive-surface group flex items-center gap-4 rounded-[1.4rem] p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] sm:rounded-[1.6rem] sm:p-5"
    >
      <div className="min-w-0 flex-1">
        <p className="section-kicker">Budget</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={`display-title text-lg tabular-nums sm:text-xl ${positive ? "text-leaf-600" : "text-red-600"}`}
          >
            {formatCurrency(totals.reste)}
          </span>
          <span className="text-xs font-medium text-ink-500">Reste sur le compte</span>
        </div>
        <p className="mt-1 text-xs text-ink-500 tabular-nums">
          Revenus {formatCurrency(totals.income)} · Charges {formatCurrency(totals.charges)} · Dépenses{" "}
          {formatCurrency(totals.monthExpenses)}
        </p>
        {totals.awaitingRefund > 0 ? (
          <span
            className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold text-coral-600 tabular-nums"
            style={{ background: "rgba(216, 100, 61, 0.12)" }}
          >
            ↩ {formatCurrency(totals.awaitingRefund)} à recevoir
          </span>
        ) : null}
      </div>
      <ChevronRight className="size-5 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
