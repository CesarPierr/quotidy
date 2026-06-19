"use client";

import { useState } from "react";
import {
  Pencil,
  Plus,
  Repeat,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { BottomSheet, BottomSheetAction } from "@/components/ui/bottom-sheet";
import { ChargeEditor, ExpenseEditor, IncomeEditor, PocketEditor } from "@/components/budget/budget-editors";
import { useToast } from "@/components/ui/toast";
import { postForm } from "@/lib/api-client";
import type { BudgetOverview, SerializedCharge, SerializedIncome, SerializedPocket } from "@/lib/budget";
import { formatCurrency } from "@/lib/savings/currency";
import { cn } from "@/lib/utils";

type SavingsBoxOption = { id: string; name: string };

type BudgetClientProps = {
  householdId: string;
  initialOverview: BudgetOverview;
  savingsBoxes: SavingsBoxOption[];
};

type Sheet =
  | { kind: "expense"; pocketId?: string }
  | { kind: "pocketActions"; pocket: SerializedPocket }
  | { kind: "pocket"; entity?: SerializedPocket }
  | { kind: "income"; entity?: SerializedIncome }
  | { kind: "charge"; entity?: SerializedCharge }
  | null;

const ACTION_MSG: Record<string, string> = {
  "expense.create": "Dépense ajoutée.",
  "expense.delete": "Dépense supprimée.",
  "pocket.create": "Poste créé.",
  "pocket.update": "Poste mis à jour.",
  "pocket.delete": "Poste supprimé.",
  "income.create": "Revenu ajouté.",
  "income.update": "Revenu mis à jour.",
  "income.delete": "Revenu supprimé.",
  "charge.create": "Charge ajoutée.",
  "charge.update": "Charge mise à jour.",
  "charge.delete": "Charge supprimée.",
};

function Stat({ label, value, tone, icon: Icon }: { label: string; value: number; tone: string; icon: typeof TrendingUp }) {
  return (
    <div className="rounded-xl border border-line bg-white/60 p-2.5 dark:bg-surface/60">
      <span className="flex items-center gap-1 text-[0.62rem] font-bold uppercase tracking-wide text-ink-500">
        <Icon className="size-3.5 shrink-0" /> {label}
      </span>
      <p className={cn("mt-0.5 text-sm font-bold tabular-nums", tone)}>{formatCurrency(value)}</p>
    </div>
  );
}

function PocketCard({ pocket, onTap, weekLabel }: { pocket: SerializedPocket; onTap: () => void; weekLabel: string }) {
  return (
    <button
      className="soft-panel flex w-full flex-col gap-2 rounded-xl border border-line p-3 text-left transition-all active:scale-[0.99]"
      onClick={onTap}
      type="button"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: pocket.color }} />
          <span className="truncate text-sm font-bold text-ink-950">{pocket.name}</span>
        </span>
        <span className="shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">
          {pocket.period === "weekly" ? "Hebdo" : "Mensuel"}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pocket.ratio, 1) * 100}%`, backgroundColor: pocket.over ? "var(--coral-500)" : pocket.color }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-ink-500">
          {formatCurrency(pocket.spent)} / {formatCurrency(pocket.quota)}
        </span>
        <span className={cn("font-semibold tabular-nums", pocket.over ? "text-red-600" : "text-leaf-600")}>
          {pocket.over ? `−${formatCurrency(pocket.spent - pocket.quota)}` : `${formatCurrency(pocket.remaining)} restant`}
        </span>
      </div>
      {pocket.period === "weekly" ? (
        <p className="text-[0.62rem] text-ink-400">Cette semaine · {weekLabel}</p>
      ) : null}
    </button>
  );
}

export function BudgetClient({ householdId, initialOverview, savingsBoxes }: BudgetClientProps) {
  const { success, error: showError } = useToast();
  const [overview, setOverview] = useState(initialOverview);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(`${overview.month}-01T12:00:00`),
  );

  async function mutate(fields: Record<string, string>) {
    setBusy(true);
    try {
      const res = await postForm(`/api/households/${householdId}/budget`, fields);
      const json = (await res.json()) as { overview?: BudgetOverview };
      if (json.overview) setOverview(json.overview);
      success(ACTION_MSG[fields._action] ?? "Enregistré.");
      setSheet(null);
      return true;
    } catch {
      showError("Action impossible.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const t = overview.totals;
  const used = t.charges + t.monthExpenses;
  const usedRatio = t.income > 0 ? Math.min(used / t.income, 1) : used > 0 ? 1 : 0;
  const re: number = t.reste;

  return (
    <section className="space-y-3 sm:space-y-4">
      <header className="px-1">
        <p className="section-kicker">Budget</p>
        <h2 className="display-title mt-1 text-2xl capitalize leading-tight sm:text-3xl">{monthLabel}</h2>
        <p className="mt-1 text-sm text-ink-500">Salaires, charges et dépenses — votre reste en temps réel.</p>
      </header>

      {/* Hero — reste sur le compte */}
      <div className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
        <p className="section-kicker">Reste sur le compte</p>
        <p className={cn("display-title mt-1 text-4xl tabular-nums sm:text-5xl", re < 0 ? "text-red-600" : "text-leaf-600")}>
          {formatCurrency(re)}
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className={cn("h-full rounded-full transition-all", used > t.income ? "bg-red-500" : "bg-leaf-500")}
            style={{ width: `${usedRatio * 100}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat icon={TrendingUp} label="Revenus" tone="text-leaf-600" value={t.income} />
          <Stat icon={Repeat} label="Charges" tone="text-ink-800" value={t.charges} />
          <Stat icon={TrendingDown} label="Dépenses" tone="text-coral-600" value={t.monthExpenses} />
        </div>
        <button
          className="btn-primary mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold"
          onClick={() => setSheet({ kind: "expense" })}
          type="button"
        >
          <Plus className="size-4" /> Ajouter une dépense
        </button>
      </div>

      {/* Postes de dépense */}
      <div className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-leaf-600/10 text-leaf-600">
              <Wallet className="size-5" />
            </span>
            <span>
              <span className="section-kicker block">Postes de dépense</span>
              <span className="display-title block text-lg leading-none sm:text-xl">Mes enveloppes</span>
            </span>
          </span>
          <button
            className="btn-secondary inline-flex min-h-9 items-center gap-1.5 px-3 py-2 text-xs font-bold"
            onClick={() => setSheet({ kind: "pocket" })}
            type="button"
          >
            <Plus className="size-4" /> Nouveau
          </button>
        </div>
        {overview.pockets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-500">
            Créez un poste (alimentation, loisirs…) avec un quota mensuel ou hebdomadaire.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {overview.pockets.map((p) => (
              <PocketCard key={p.id} onTap={() => setSheet({ kind: "pocketActions", pocket: p })} pocket={p} weekLabel={overview.week.label} />
            ))}
          </div>
        )}
      </div>

      {/* Revenus + Charges */}
      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <ListCard
          accent="text-leaf-600 bg-leaf-600/10"
          icon={TrendingUp}
          kicker="Entrées"
          onAdd={() => setSheet({ kind: "income" })}
          title="Revenus"
        >
          {overview.income.length === 0 ? (
            <Empty>Ajoutez vos salaires et autres revenus mensuels.</Empty>
          ) : (
            overview.income.map((i) => (
              <Row key={i.id} onClick={() => setSheet({ kind: "income", entity: i })} title={i.label} value={formatCurrency(i.amount)} />
            ))
          )}
        </ListCard>

        <ListCard
          accent="text-ink-800 bg-black/[0.06]"
          icon={Repeat}
          kicker="Sorties fixes"
          onAdd={() => setSheet({ kind: "charge" })}
          title="Charges fixes"
        >
          {overview.charges.length === 0 ? (
            <Empty>Loyer, abonnements, épargne récurrente…</Empty>
          ) : (
            overview.charges.map((c) => (
              <Row
                key={c.id}
                hint={c.savingsBoxName ? `Épargne · ${c.savingsBoxName}` : c.dayOfMonth ? `Le ${c.dayOfMonth} du mois` : undefined}
                onClick={() => setSheet({ kind: "charge", entity: c })}
                title={c.label}
                value={formatCurrency(c.amount)}
              />
            ))
          )}
        </ListCard>
      </div>

      {/* Dépenses récentes */}
      <div className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-coral-500/10 text-coral-600">
            <TrendingDown className="size-5" />
          </span>
          <span>
            <span className="section-kicker block">Ce mois-ci</span>
            <span className="display-title block text-lg leading-none sm:text-xl">Dépenses récentes</span>
          </span>
        </div>
        {overview.recentExpenses.length === 0 ? (
          <Empty>Vos dépenses du mois apparaîtront ici.</Empty>
        ) : (
          <ul className="space-y-2">
            {overview.recentExpenses.map((e) => (
              <li className="flex items-center gap-3 rounded-xl border border-line bg-white/60 p-3 dark:bg-surface/60" key={e.id}>
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: e.pocketColor ?? "var(--ink-300)" }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-950">{e.label || e.pocketName || "Dépense"}</span>
                  <span className="block truncate text-[0.7rem] text-ink-500">
                    {e.pocketName ?? "Sans poste"}
                    {e.createdByName ? ` · ${e.createdByName}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-coral-600">−{formatCurrency(e.amount)}</span>
                <button
                  aria-label="Supprimer la dépense"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-black/[0.05] hover:text-red-600 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => mutate({ _action: "expense.delete", id: e.id })}
                  type="button"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Sheets ── */}
      {sheet?.kind === "expense" ? (
        <ExpenseEditor
          busy={busy}
          defaultPocketId={sheet.pocketId}
          onClose={() => setSheet(null)}
          onSubmit={mutate}
          open
          pockets={overview.pockets}
          todayIso={todayIso}
        />
      ) : null}

      {sheet?.kind === "pocket" ? (
        <PocketEditor busy={busy} entity={sheet.entity} key={sheet.entity?.id ?? "new"} onClose={() => setSheet(null)} onDelete={mutate} onSubmit={mutate} open />
      ) : null}

      {sheet?.kind === "income" ? (
        <IncomeEditor busy={busy} entity={sheet.entity} key={sheet.entity?.id ?? "new"} onClose={() => setSheet(null)} onDelete={mutate} onSubmit={mutate} open />
      ) : null}

      {sheet?.kind === "charge" ? (
        <ChargeEditor busy={busy} entity={sheet.entity} key={sheet.entity?.id ?? "new"} onClose={() => setSheet(null)} onDelete={mutate} onSubmit={mutate} open savingsBoxes={savingsBoxes} />
      ) : null}

      <BottomSheet isOpen={sheet?.kind === "pocketActions"} onClose={() => setSheet(null)} title={sheet?.kind === "pocketActions" ? sheet.pocket.name : "Poste"}>
        {sheet?.kind === "pocketActions" ? (
          <div className="space-y-1">
            <BottomSheetAction icon={Plus} label="Ajouter une dépense" onClick={() => setSheet({ kind: "expense", pocketId: sheet.pocket.id })} />
            <BottomSheetAction icon={Pencil} label="Modifier le poste" onClick={() => setSheet({ kind: "pocket", entity: sheet.pocket })} />
            <BottomSheetAction icon={Trash2} label="Supprimer" onClick={() => mutate({ _action: "pocket.delete", id: sheet.pocket.id })} variant="danger" />
          </div>
        ) : null}
      </BottomSheet>
    </section>
  );
}

function ListCard({
  icon: Icon,
  accent,
  kicker,
  title,
  onAdd,
  children,
}: {
  icon: typeof TrendingUp;
  accent: string;
  kicker: string;
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", accent)}>
            <Icon className="size-5" />
          </span>
          <span>
            <span className="section-kicker block">{kicker}</span>
            <span className="display-title block text-lg leading-none sm:text-xl">{title}</span>
          </span>
        </span>
        <button
          aria-label={`Ajouter — ${title}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-700 transition-colors hover:bg-black/[0.04]"
          onClick={onAdd}
          type="button"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ title, value, hint, onClick }: { title: string; value: string; hint?: string; onClick: () => void }) {
  return (
    <button
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-white/60 p-3 text-left transition-all active:scale-[0.99] dark:bg-surface/60"
      onClick={onClick}
      type="button"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-950">{title}</span>
        {hint ? <span className="block truncate text-[0.7rem] text-ink-500">{hint}</span> : null}
      </span>
      <span className="shrink-0 text-sm font-bold tabular-nums text-ink-950">{value}</span>
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-500">{children}</p>;
}
