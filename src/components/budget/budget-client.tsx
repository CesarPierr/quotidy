"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Pencil,
  PieChart,
  Plus,
  Receipt,
  Repeat,
  RotateCcw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { BottomSheet, BottomSheetAction } from "@/components/ui/bottom-sheet";
import { BudgetAnalysisPanel } from "@/components/budget/budget-analysis";
import { ChargeEditor, ExpenseEditor, IncomeEditor, PocketEditor, RefundEditor } from "@/components/budget/budget-editors";
import { useToast } from "@/components/ui/toast";
import { postForm } from "@/lib/api-client";
import { enqueue, type OutboxEntry } from "@/lib/offline-outbox";
import type { BudgetOverview, SerializedCharge, SerializedExpense, SerializedIncome, SerializedPocket } from "@/lib/budget";
import { formatCurrency } from "@/lib/savings/currency";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

function newClientId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `off-${Date.now().toString(36)}-${Math.round(Math.random() * 1e9).toString(36)}`;
}

function makeOutboxEntry(url: string, fields: Record<string, string>): OutboxEntry {
  const id = fields.id || newClientId();
  return { id, url, fields: { ...fields, id }, label: fields.label || "Dépense", createdAt: Date.now() };
}

function parseAmount(s: string | undefined): number {
  if (!s) return 0;
  const n = Number.parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Optimistic local apply for an expense captured offline (approximate totals;
 *  the exact overview is re-pulled from the server on reconnect). */
function applyOptimisticExpense(prev: BudgetOverview, fields: Record<string, string>): BudgetOverview {
  const amt = parseAmount(fields.amount);
  const pocketId = fields.pocketId || null;
  const pocket = pocketId ? prev.pockets.find((p) => p.id === pocketId) : undefined;
  const refundExpected = fields.refundExpected ? parseAmount(fields.refundExpected) : null;
  const expense: SerializedExpense = {
    id: fields.id,
    label: fields.label || null,
    amount: amt,
    pocketId,
    pocketName: pocket?.name ?? null,
    pocketColor: pocket?.color ?? null,
    spentAt: fields.spentAt ? new Date(fields.spentAt).toISOString() : new Date().toISOString(),
    createdByName: null,
    refundExpected,
    refundedAmount: null,
    outstanding: refundExpected ?? 0,
  };
  const pockets = prev.pockets.map((p) => {
    if (p.id !== pocketId) return p;
    const spent = p.spent + amt;
    return { ...p, spent, remaining: p.quota - spent, ratio: p.quota > 0 ? spent / p.quota : 1, over: spent > p.quota };
  });
  return {
    ...prev,
    expenses: [expense, ...prev.expenses],
    pockets,
    totals: {
      ...prev.totals,
      monthExpenses: prev.totals.monthExpenses + amt,
      reste: prev.totals.reste - amt,
      freeMoney: prev.totals.freeMoney - amt,
    },
  };
}

type SavingsBoxOption = { id: string; name: string };
type BudgetClientProps = { householdId: string; initialOverview: BudgetOverview; savingsBoxes: SavingsBoxOption[] };
type Tab = "apercu" | "depenses" | "analyse";

type Sheet =
  | { kind: "expense"; pocketId?: string }
  | { kind: "pocketActions"; pocket: SerializedPocket }
  | { kind: "pocket"; entity?: SerializedPocket }
  | { kind: "income"; entity?: SerializedIncome }
  | { kind: "charge"; entity?: SerializedCharge }
  | { kind: "refund"; expense: SerializedExpense }
  | null;

const ACTION_MSG: Record<string, string> = {
  "expense.create": "Dépense ajoutée.",
  "expense.delete": "Dépense supprimée.",
  "expense.refund": "Remboursement enregistré.",
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

const PAGE = 20;

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
    <button className="soft-panel flex w-full flex-col gap-2 rounded-xl border border-line p-3 text-left transition-all active:scale-[0.99]" onClick={onTap} type="button">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {pocket.icon ? (
            <span className="shrink-0 text-base leading-none">{pocket.icon}</span>
          ) : (
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: pocket.color }} />
          )}
          <span className="truncate text-sm font-bold text-ink-950">{pocket.name}</span>
        </span>
        <span className="shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-ink-500">
          {pocket.period === "weekly" ? "Hebdo" : "Mensuel"}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pocket.ratio, 1) * 100}%`, backgroundColor: pocket.over ? "var(--coral-500)" : pocket.color }} />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-ink-500">{formatCurrency(pocket.spent)} / {formatCurrency(pocket.quota)}</span>
        <span className={cn("font-semibold tabular-nums", pocket.over ? "text-red-600" : "text-leaf-600")}>
          {pocket.over ? `−${formatCurrency(pocket.spent - pocket.quota)}` : `${formatCurrency(pocket.remaining)} restant`}
        </span>
      </div>
      {pocket.period === "weekly" ? <p className="text-[0.62rem] text-ink-400">Cette semaine · {weekLabel}</p> : null}
    </button>
  );
}

/** Shows the first `initial` items + a "voir plus / moins" toggle. Keeps long
 *  charge/income lists from running off the page. */
function Bounded<T>({ items, initial, render }: { items: T[]; initial: number; render: (item: T) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, initial);
  return (
    <>
      {shown.map(render)}
      {items.length > initial ? (
        <button className="w-full rounded-xl py-2 text-sm font-semibold text-ink-500 transition-colors hover:bg-black/[0.03]" onClick={() => setOpen((v) => !v)} type="button">
          {open ? "Voir moins" : `Voir ${items.length - initial} de plus`}
        </button>
      ) : null}
    </>
  );
}

export function BudgetClient({ householdId, initialOverview, savingsBoxes }: BudgetClientProps) {
  const { success, error: showError } = useToast();
  const router = useRouter();
  const online = useOnline();
  const [overview, setOverview] = useState(initialOverview);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("apercu");
  const [visible, setVisible] = useState(PAGE);
  const [filter, setFilter] = useState<string>("all"); // "all" | pocketId | "none"

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${overview.month}-01T12:00:00`));

  const budgetUrl = `/api/households/${householdId}/budget`;

  // Offline: only expense capture is allowed (queued + optimistic); config edits
  // are blocked. A client id makes the queued create idempotent on replay.
  function captureOffline(fields: Record<string, string>) {
    const entry = makeOutboxEntry(budgetUrl, fields);
    void enqueue(entry).catch(() => undefined);
    setOverview((prev) => applyOptimisticExpense(prev, entry.fields));
    success("Enregistré hors-ligne · synchro au retour du réseau.");
    setSheet(null);
  }

  async function mutate(fields: Record<string, string>) {
    const action = fields._action;
    const isOffline = !online || (typeof navigator !== "undefined" && !navigator.onLine);
    if (isOffline) {
      if (action !== "expense.create") {
        showError("Indisponible hors-ligne — reconnectez-vous pour cette action.");
        return false;
      }
      captureOffline(fields);
      return true;
    }
    setBusy(true);
    try {
      const res = await postForm(budgetUrl, fields);
      const json = (await res.json()) as { overview?: BudgetOverview };
      if (json.overview) setOverview(json.overview);
      success(ACTION_MSG[action] ?? "Enregistré.");
      setSheet(null);
      return true;
    } catch {
      if (action === "expense.create" && typeof navigator !== "undefined" && !navigator.onLine) {
        captureOffline(fields);
        return true;
      }
      showError("Action impossible.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // On reconnect, re-pull the exact overview once the outbox has flushed.
  useEffect(() => {
    const reconcile = () => {
      window.setTimeout(() => {
        fetch(`/api/households/${householdId}/budget`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            if (j?.overview) setOverview(j.overview as BudgetOverview);
          })
          .catch(() => undefined);
      }, 1500);
    };
    window.addEventListener("online", reconcile);
    return () => window.removeEventListener("online", reconcile);
  }, [householdId]);

  const blockOffline = () => showError("Indisponible hors-ligne — reconnectez-vous pour modifier la configuration.");

  const t = overview.totals;
  const used = t.charges + t.monthExpenses;
  const usedRatio = t.income > 0 ? Math.min(used / t.income, 1) : used > 0 ? 1 : 0;

  const filtered = overview.expenses.filter((e) => (filter === "all" ? true : filter === "none" ? !e.pocketId : e.pocketId === filter));

  const tabs: { id: Tab; label: string; icon: typeof Wallet }[] = [
    { id: "apercu", label: "Aperçu", icon: LayoutDashboard },
    { id: "depenses", label: "Dépenses", icon: Receipt },
    { id: "analyse", label: "Analyse", icon: PieChart },
  ];

  const addExpenseBtn = (
    <button
      className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold"
      onClick={() => setSheet({ kind: "expense" })}
      type="button"
    >
      <Plus className="size-4" /> Ajouter une dépense
    </button>
  );

  return (
    <section className="space-y-3 sm:space-y-4">
      <header className="px-1">
        <p className="section-kicker">Budget</p>
        <h2 className="display-title mt-1 text-2xl capitalize leading-tight sm:text-3xl">{monthLabel}</h2>
        <p className="mt-1 text-sm text-ink-500">Salaires, charges et dépenses — votre reste en temps réel.</p>
      </header>

      {/* Sub-nav */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-white/60 p-1 dark:bg-surface/60">
        {tabs.map((x) => {
          const active = tab === x.id;
          const Icon = x.icon;
          return (
            <button
              aria-pressed={active}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold transition-all active:scale-[0.98]",
                active ? "bg-white text-ink-950 shadow-sm dark:bg-surface" : "text-ink-500 hover:text-ink-800",
              )}
              key={x.id}
              onClick={() => setTab(x.id)}
              type="button"
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{x.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── APERÇU ── */}
      {tab === "apercu" ? (
        <div className="space-y-3 animate-in fade-in sm:space-y-4">
          <div className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
            <p className="section-kicker">Reste sur le compte</p>
            <p className={cn("display-title mt-1 text-4xl tabular-nums sm:text-5xl", t.reste < 0 ? "text-red-600" : "text-leaf-600")}>{formatCurrency(t.reste)}</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div className={cn("h-full rounded-full transition-all", used > t.income ? "bg-red-500" : "bg-leaf-500")} style={{ width: `${usedRatio * 100}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat icon={TrendingUp} label="Revenus" tone="text-leaf-600" value={t.income} />
              <Stat icon={Repeat} label="Charges" tone="text-ink-800" value={t.charges} />
              <Stat icon={TrendingDown} label="Dépenses" tone="text-coral-600" value={t.monthExpenses} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-white/60 px-3 py-2 dark:bg-surface/60">
              <span className="min-w-0 text-xs font-semibold text-ink-700">
                Argent libre <span className="font-normal text-ink-400">· budgets réservés</span>
              </span>
              <span className={cn("shrink-0 text-sm font-bold tabular-nums", t.freeMoney < 0 ? "text-red-600" : "text-leaf-600")}>{formatCurrency(t.freeMoney)}</span>
            </div>
            {t.awaitingRefund > 0 ? (
              <button
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-coral-500/10 px-3 py-1 text-xs font-semibold text-coral-600"
                onClick={() => setTab("depenses")}
                type="button"
              >
                <RotateCcw className="size-3.5" /> {formatCurrency(t.awaitingRefund)} à recevoir
              </button>
            ) : null}
            <div className="mt-4">{addExpenseBtn}</div>
          </div>

          {/* Pockets */}
          <div className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-leaf-600/10 text-leaf-600"><Wallet className="size-5" /></span>
                <span>
                  <span className="section-kicker block">Postes de dépense</span>
                  <span className="display-title block text-lg leading-none sm:text-xl">Mes enveloppes</span>
                </span>
              </span>
              <button
                className="btn-secondary inline-flex min-h-9 items-center gap-1.5 px-3 py-2 text-xs font-bold disabled:opacity-40"
                disabled={!online}
                onClick={() => setSheet({ kind: "pocket" })}
                title={online ? undefined : "Indisponible hors-ligne"}
                type="button"
              >
                <Plus className="size-4" /> Nouveau
              </button>
            </div>
            {overview.pockets.length === 0 ? (
              <Empty>Créez un poste (alimentation, loisirs…) avec un quota mensuel ou hebdomadaire.</Empty>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {overview.pockets.map((p) => (
                  <PocketCard
                    key={p.id}
                    onTap={() => setSheet(online ? { kind: "pocketActions", pocket: p } : { kind: "expense", pocketId: p.id })}
                    pocket={p}
                    weekLabel={overview.week.label}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Revenus + Charges (bounded) */}
          <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
            <ListCard accent="text-leaf-600 bg-leaf-600/10" disabled={!online} icon={TrendingUp} kicker="Entrées" onAdd={() => setSheet({ kind: "income" })} title="Revenus">
              {overview.income.length === 0 ? (
                <Empty>Ajoutez vos salaires et autres revenus mensuels.</Empty>
              ) : (
                <Bounded
                  initial={5}
                  items={overview.income}
                  render={(i) => <Row key={i.id} onClick={online ? () => setSheet({ kind: "income", entity: i }) : blockOffline} title={i.label} value={formatCurrency(i.amount)} />}
                />
              )}
            </ListCard>

            <ListCard accent="text-ink-800 bg-black/[0.06]" disabled={!online} icon={Repeat} kicker="Sorties fixes" onAdd={() => setSheet({ kind: "charge" })} title="Charges fixes">
              {overview.charges.length === 0 ? (
                <Empty>Loyer, abonnements, épargne récurrente…</Empty>
              ) : (
                <Bounded
                  initial={5}
                  items={overview.charges}
                  render={(c) =>
                    c.isAuto ? (
                      <Row
                        badge={<span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-sky-600">auto · épargne</span>}
                        hint="Versement automatique — géré dans l'enveloppe"
                        key={c.id}
                        onClick={() => router.push(`/app/epargne?household=${householdId}`)}
                        title={c.label}
                        value={formatCurrency(c.amount)}
                      />
                    ) : (
                      <Row
                        badge={c.duplicateOfAuto ? <span className="rounded-full bg-coral-500/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-coral-600">doublon</span> : undefined}
                        hint={
                          c.duplicateOfAuto
                            ? "Doublon d'un auto-versement · non compté"
                            : c.savingsBoxName
                              ? `Épargne · ${c.savingsBoxName}`
                              : c.dayOfMonth
                                ? `Le ${c.dayOfMonth} du mois`
                                : undefined
                        }
                        key={c.id}
                        onClick={online ? () => setSheet({ kind: "charge", entity: c }) : blockOffline}
                        title={c.label}
                        value={formatCurrency(c.amount)}
                      />
                    )
                  }
                />
              )}
            </ListCard>
          </div>
        </div>
      ) : null}

      {/* ── DÉPENSES ── */}
      {tab === "depenses" ? (
        <div className="space-y-3 animate-in fade-in sm:space-y-4">
          {addExpenseBtn}

          {overview.refunds.length > 0 ? (
            <div className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-coral-500/10 text-coral-600"><RotateCcw className="size-5" /></span>
                <span>
                  <span className="section-kicker block">On vous doit</span>
                  <span className="display-title block text-lg leading-none sm:text-xl">À rembourser</span>
                </span>
              </div>
              <ul className="space-y-2">
                {overview.refunds.map((e) => (
                  <li className="flex items-center gap-3 rounded-xl border border-line bg-white/60 p-3 dark:bg-surface/60" key={e.id}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-950">{e.label || e.pocketName || "Dépense"}</span>
                      <span className="block truncate text-[0.7rem] text-ink-500">Payé {formatCurrency(e.amount)}{e.refundedAmount ? ` · reçu ${formatCurrency(e.refundedAmount)}` : ""}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-coral-600">{formatCurrency(e.outstanding)}</span>
                    <button className="btn-secondary min-h-9 shrink-0 px-3 py-1.5 text-xs font-bold" onClick={() => setSheet({ kind: "refund", expense: e })} type="button">Reçu</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-coral-500/10 text-coral-600"><Receipt className="size-5" /></span>
              <span>
                <span className="section-kicker block">Ce mois-ci</span>
                <span className="display-title block text-lg leading-none sm:text-xl">Dépenses</span>
              </span>
            </div>

            {overview.expenses.length === 0 ? (
              <Empty>Vos dépenses du mois apparaîtront ici.</Empty>
            ) : (
              <>
                {/* Filter by type */}
                {overview.pockets.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {[{ key: "all", name: "Tous", color: "" }, ...overview.pockets.map((p) => ({ key: p.id, name: p.name, color: p.color })), { key: "none", name: "Sans poste", color: "" }].map((f) => {
                      const active = filter === f.key;
                      return (
                        <button
                          className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all active:scale-95", active ? "border-ink-950 bg-ink-950/[0.06] text-ink-950" : "border-line bg-glass-bg text-ink-500")}
                          key={f.key}
                          onClick={() => { setFilter(f.key); setVisible(PAGE); }}
                          type="button"
                        >
                          {f.color ? <span className="size-2 rounded-full" style={{ backgroundColor: f.color }} /> : null}
                          {f.name}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <ul className="space-y-2">
                  {filtered.slice(0, visible).map((e) => (
                    <li className="flex items-center gap-3 rounded-xl border border-line bg-white/60 p-3 dark:bg-surface/60" key={e.id}>
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: e.pocketColor ?? "var(--ink-300)" }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-950">{e.label || e.pocketName || "Dépense"}</span>
                        <span className="block truncate text-[0.7rem] text-ink-500">
                          {e.pocketName ?? "Sans poste"}
                          {e.createdByName ? ` · ${e.createdByName}` : ""}
                        </span>
                      </span>
                      {e.refundExpected != null ? (
                        <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold", e.outstanding > 0 ? "bg-coral-500/10 text-coral-600" : "bg-leaf-600/10 text-leaf-600")}>
                          {e.outstanding > 0 ? "à rembourser" : "remboursé"}
                        </span>
                      ) : null}
                      <span className="shrink-0 text-sm font-bold tabular-nums text-coral-600">−{formatCurrency(e.amount)}</span>
                      <button aria-label="Supprimer la dépense" className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-black/[0.05] hover:text-red-600 disabled:opacity-50" disabled={busy} onClick={() => mutate({ _action: "expense.delete", id: e.id })} type="button">
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                {filtered.length === 0 ? <p className="py-3 text-center text-sm text-ink-500">Aucune dépense pour ce poste.</p> : null}
                {filtered.length > visible ? (
                  <button className="mt-2 w-full rounded-xl py-2 text-sm font-semibold text-ink-500 transition-colors hover:bg-black/[0.03]" onClick={() => setVisible((v) => v + PAGE)} type="button">
                    Voir plus ({filtered.length - visible})
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* ── ANALYSE ── */}
      {tab === "analyse" ? <BudgetAnalysisPanel analysis={overview.analysis} /> : null}

      {/* ── Sheets ── */}
      {sheet?.kind === "expense" ? (
        <ExpenseEditor busy={busy} defaultPocketId={sheet.pocketId} onClose={() => setSheet(null)} onSubmit={mutate} open pockets={overview.pockets} todayIso={todayIso} />
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
      {sheet?.kind === "refund" ? (
        <RefundEditor busy={busy} expense={sheet.expense} key={sheet.expense.id} onClose={() => setSheet(null)} onSubmit={mutate} open />
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

function ListCard({ icon: Icon, accent, kicker, title, onAdd, children, disabled }: { icon: typeof TrendingUp; accent: string; kicker: string; title: string; onAdd: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <div className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", accent)}><Icon className="size-5" /></span>
          <span>
            <span className="section-kicker block">{kicker}</span>
            <span className="display-title block text-lg leading-none sm:text-xl">{title}</span>
          </span>
        </span>
        <button
          aria-label={`Ajouter — ${title}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-700 transition-colors hover:bg-black/[0.04] disabled:opacity-40"
          disabled={disabled}
          onClick={onAdd}
          title={disabled ? "Indisponible hors-ligne" : undefined}
          type="button"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ title, value, hint, onClick, badge }: { title: string; value: string; hint?: string; onClick: () => void; badge?: React.ReactNode }) {
  return (
    <button className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-white/60 p-3 text-left transition-all active:scale-[0.99] dark:bg-surface/60" onClick={onClick} type="button">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-950">{title}</span>
        {hint ? <span className="block truncate text-[0.7rem] text-ink-500">{hint}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {badge}
        <span className="text-sm font-bold tabular-nums text-ink-950">{value}</span>
      </span>
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-500">{children}</p>;
}
