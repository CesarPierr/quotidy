import { PieChart, TrendingDown } from "lucide-react";

import type { BudgetAnalysis } from "@/lib/budget";
import { formatCurrency } from "@/lib/savings/currency";

function CardHeader({ kicker, title, icon: Icon, accent }: { kicker: string; title: string; icon: typeof PieChart; accent: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="size-5" />
      </span>
      <span>
        <span className="section-kicker block">{kicker}</span>
        <span className="display-title block text-lg leading-none sm:text-xl">{title}</span>
      </span>
    </div>
  );
}

export function BudgetAnalysisPanel({ analysis }: { analysis: BudgetAnalysis }) {
  const maxWeek = Math.max(...analysis.byWeek.map((w) => w.amount), 1);

  return (
    <div className="space-y-3 animate-in fade-in sm:space-y-4">
      {/* Total */}
      <div className="app-surface rounded-[1.4rem] p-4 text-center sm:rounded-[1.6rem] sm:p-5">
        <p className="section-kicker">Dépenses du mois</p>
        <p className="display-title mt-1 text-3xl tabular-nums text-coral-600 sm:text-4xl">{formatCurrency(analysis.total)}</p>
        <p className="mt-1 text-xs text-ink-500">Net des remboursements reçus.</p>
      </div>

      {/* By type */}
      <div className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
        <CardHeader accent="bg-leaf-600/10 text-leaf-600" icon={PieChart} kicker="Répartition" title="Par poste" />
        {analysis.byType.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-500">
            Aucune dépense ce mois-ci.
          </p>
        ) : (
          <ul className="space-y-3">
            {analysis.byType.map((t) => (
              <li key={t.key}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="truncate font-semibold text-ink-950">{t.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-700">
                    {formatCurrency(t.amount)} · {Math.round(t.ratio * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(t.ratio * 100, 2)}%`, backgroundColor: t.color }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* By week */}
      <div className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
        <CardHeader accent="bg-coral-500/10 text-coral-600" icon={TrendingDown} kicker="Tendance" title="Par semaine" />
        <div className="flex items-end gap-2" style={{ height: "7rem" }}>
          {analysis.byWeek.map((w) => (
            <div className="flex flex-1 flex-col items-center justify-end gap-1" key={w.label} title={`${w.label} : ${formatCurrency(w.amount)}`}>
              <span className="text-[0.6rem] font-semibold tabular-nums text-ink-500">{Math.round(w.amount)}</span>
              <div
                className="w-full rounded-t-md bg-coral-500/70 transition-all"
                style={{ height: `${Math.max((w.amount / maxWeek) * 100, 3)}%` }}
              />
              <span className="text-[0.6rem] text-ink-400">{w.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
