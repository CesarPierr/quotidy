"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeftRight, Calculator, History, Plus, Sparkles } from "lucide-react";

import { BoxCard } from "@/components/savings/box-card";
import { BoxCreateWizard } from "@/components/savings/box-create-wizard";
import { BoxDetailSheet } from "@/components/savings/box-detail-sheet";
import { CalculatorManager } from "@/components/savings/calculator-manager";
import { CalculatorRunner } from "@/components/savings/calculator-runner";
import { TransferHistory } from "@/components/savings/transfer-history";
import { TransferSheet } from "@/components/savings/transfer-sheet";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { formatCurrency } from "@/lib/savings/currency";
import { cn } from "@/lib/utils";
import type { SavingsBoxView } from "@/components/savings/types";

type EpargneClientProps = {
  householdId: string;
  initialBoxes: SavingsBoxView[];
  initialTotalSavings: number;
  initialTotalDebt: number;
};

export function EpargneClient({
  householdId,
  initialBoxes,
  initialTotalSavings,
  initialTotalDebt,
}: EpargneClientProps) {
  const searchParams = useSearchParams();
  const [manualTab, setManualTab] = useState<"boxes" | "calculators" | null>(null);
  const [manualOpenBoxId, setManualOpenBoxId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferHistoryOpen, setTransferHistoryOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [managerOpen, setManagerOpen] = useState(false);
  const [editingCalculatorId, setEditingCalculatorId] = useState<string | null>(null);
  const [refreshCalculatorsKey, setRefreshCalculatorsKey] = useState(0);

  const boxes = initialBoxes;
  const urlTab = searchParams.get("tab");
  const tab = manualTab ?? (urlTab === "calculators" ? "calculators" : "boxes");

  const totalSavings = initialTotalSavings;
  const totalDebt = initialTotalDebt;

  const activeBoxes = useMemo(() => boxes.filter((b) => !b.isArchived), [boxes]);
  const archivedBoxes = useMemo(() => boxes.filter((b) => b.isArchived), [boxes]);
  const urlBoxId = searchParams.get("box");
  const openBoxId =
    manualOpenBoxId ??
    (urlBoxId && boxes.some((b) => b.id === urlBoxId) ? urlBoxId : null);
  const openBox = useMemo(() => boxes.find((b) => b.id === openBoxId) ?? null, [boxes, openBoxId]);

  const balanceBoxes = useMemo(() => activeBoxes.filter((b) => b.kind !== "debt"), [activeBoxes]);
  const debtBoxes = useMemo(() => activeBoxes.filter((b) => b.kind === "debt"), [activeBoxes]);
  const isEmpty = activeBoxes.length === 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      <section
        aria-live="polite"
        className="px-1"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end sm:gap-6">
          <div>
            <p className="section-kicker text-[0.62rem] text-leaf-600 sm:text-xs">Épargne & Provisions</p>
            <p className="display-title mt-1 text-2xl tabular-nums text-ink-950 sm:text-3xl">
              {formatCurrency(totalSavings)}
            </p>
            <p className="mt-1 text-sm text-ink-700">
              Réparti sur {balanceBoxes.length} enveloppe{balanceBoxes.length > 1 ? "s" : ""}.
            </p>
          </div>

          {debtBoxes.length > 0 ? (
            <span className="accent-pill self-start bg-white shadow-sm dark:bg-surface sm:self-auto">
              <span className="accent-pill-dot" style={{ backgroundColor: "var(--coral-500)" }} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Dettes</span>
              <span className="text-xs font-bold text-red-700">{formatCurrency(totalDebt)}</span>
            </span>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            onClick={() => setCreateOpen(true)}
            type="button"
            className="btn-primary inline-flex min-h-10 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold sm:px-4 sm:py-2.5"
          >
            <Plus className="size-4" />
            <span className="truncate">Nouvelle</span>
          </button>
          {activeBoxes.length >= 2 ? (
            <>
              <button
                onClick={() => setTransferOpen(true)}
                type="button"
                className="btn-secondary inline-flex min-h-10 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold sm:px-4 sm:py-2.5"
              >
                <ArrowLeftRight className="size-4" />
                Transférer
              </button>
              <button
                onClick={() => setTransferHistoryOpen(true)}
                type="button"
                className="btn-quiet col-span-2 inline-flex min-h-10 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-[var(--ink-600)] sm:col-span-1 sm:py-2.5"
              >
                <History className="size-4" />
                Historique
              </button>
            </>
          ) : null}
        </div>
      </section>

      <nav className="flex items-center gap-1 rounded-[1.1rem] bg-black/[0.04] p-1 sm:rounded-[1.2rem]">
        <button
          onClick={() => {
            setManualTab("boxes");
            const url = new URL(window.location.href);
            url.searchParams.set("tab", "boxes");
            window.history.replaceState({}, "", url.toString());
          }}
          className={cn(
            "flex-1 flex min-h-11 items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.97] sm:text-sm",
            tab === "boxes"
              ? "bg-white dark:bg-surface text-ink-950 shadow-sm"
              : "text-ink-500 hover:text-ink-700",
          )}
        >
          <Sparkles className={cn("size-4 transition-colors", tab === "boxes" ? "text-coral-500" : "")} />
          Enveloppes
        </button>
        <button
          onClick={() => {
            setManualTab("calculators");
            const url = new URL(window.location.href);
            url.searchParams.set("tab", "calculators");
            window.history.replaceState({}, "", url.toString());
          }}
          className={cn(
            "flex-1 flex min-h-11 items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.97] sm:text-sm",
            tab === "calculators"
              ? "bg-white dark:bg-surface text-ink-950 shadow-sm"
              : "text-ink-500 hover:text-ink-700",
          )}
        >
          <Calculator className={cn("size-4 transition-colors", tab === "calculators" ? "text-coral-500" : "")} />
          Calculateurs
        </button>
      </nav>

      {tab === "boxes" ? (
        <div key="tab-boxes" className="animate-in fade-in duration-300 motion-reduce:animate-none">
          {isEmpty ? (
            <section className="app-surface rounded-[1.4rem] p-4 text-center sm:rounded-[1.6rem] sm:p-5">
              <Sparkles className="mx-auto size-7 text-coral-500 sm:size-8" />
              <h3 className="display-title mt-3 text-lg sm:text-xl">Commencez par une enveloppe</h3>
              <p className="mt-1 text-sm text-ink-700 max-w-md mx-auto">
                Choisissez un modèle (épargne précaution, vacances, voiture…) ou créez la vôtre.
              </p>
              <button
                onClick={() => setCreateOpen(true)}
                type="button"
                className="btn-primary mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
              >
                <Plus className="size-4" />
                Créer ma première enveloppe
              </button>
            </section>
          ) : (
            <section className="grid gap-3 sm:grid-cols-2">
              {activeBoxes.map((b) => (
                <BoxCard key={b.id} box={b} onClick={() => setManualOpenBoxId(b.id)} />
              ))}
            </section>
          )}

          {archivedBoxes.length > 0 ? (
            <details className="mt-4 app-surface rounded-[1.4rem] p-4 group sm:rounded-[1.6rem]">
              <summary className="cursor-pointer text-sm font-semibold text-ink-500 flex items-center justify-between">
                <span>{archivedBoxes.length} enveloppe{archivedBoxes.length > 1 ? "s" : ""} archivée{archivedBoxes.length > 1 ? "s" : ""}</span>
                <Plus className="size-4 group-open:rotate-45 transition-transform" />
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {archivedBoxes.map((b) => (
                  <BoxCard key={b.id} box={b} onClick={() => setManualOpenBoxId(b.id)} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <section key="tab-calculators" className="space-y-3 sm:space-y-4 animate-in fade-in duration-300 motion-reduce:animate-none">
          <div className="px-1 flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-coral-500/10 text-coral-600">
              <Calculator className="size-4" />
            </span>
            <div>
              <p className="section-kicker text-coral-500">Utiliser</p>
              <h2 className="display-title text-lg sm:text-xl">Lancer un calcul</h2>
            </div>
          </div>

          <CalculatorRunner
            key={refreshCalculatorsKey}
            householdId={householdId}
            boxes={activeBoxes}
            color="var(--coral-500)"
            variant="grid"
            onCreate={() => {
              setEditingCalculatorId(null);
              setManagerOpen(true);
            }}
            onEdit={(calc) => {
              setEditingCalculatorId(calc.id);
              setManagerOpen(true);
            }}
          />

          <CalculatorManager
            householdId={householdId}
            boxes={activeBoxes}
            isOpen={managerOpen}
            initialEditingId={editingCalculatorId}
            onClose={() => {
              setManagerOpen(false);
              setEditingCalculatorId(null);
            }}
            onSuccess={() => setRefreshCalculatorsKey(k => k + 1)}
          />
        </section>
      )}

      <BoxCreateWizard
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        householdId={householdId}
      />
      <BoxDetailSheet
        isOpen={openBoxId !== null}
        onClose={() => {
          setManualOpenBoxId(null);
          const url = new URL(window.location.href);
          url.searchParams.delete("box");
          url.searchParams.delete("tab");
          window.history.replaceState({}, "", url.toString());
        }}
        box={openBox}
        householdId={householdId}
        activeBoxes={activeBoxes}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
      <TransferSheet
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        householdId={householdId}
        boxes={activeBoxes}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
      <BottomSheet
        isOpen={transferHistoryOpen}
        onClose={() => setTransferHistoryOpen(false)}
        title="Historique des transferts"
        maxHeight={88}
      >
        <TransferHistory
          householdId={householdId}
          refreshKey={refreshKey}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      </BottomSheet>
    </div>
  );
}
