"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowDown, ArrowUp, ArrowLeftRight, Settings } from "lucide-react";

import { AdjustForm } from "@/components/savings/adjust-form";
import { BalanceChart } from "@/components/savings/balance-chart";
import { CalculatorRunner } from "@/components/savings/calculator-runner";
import { EntryForm } from "@/components/savings/entry-form";
import { TransferForm } from "@/components/savings/transfer-form";
import { formatCurrency } from "@/lib/savings/currency";
import { cn } from "@/lib/utils";
import type { SavingsBoxView, SavingsEntryView } from "@/components/savings/types";

type ActionType = "deposit" | "withdrawal" | "transfer";

type BoxDetailSummaryProps = {
  box: SavingsBoxView;
  householdId: string;
  activeBoxes: SavingsBoxView[];
  entries: SavingsEntryView[];
  loading: boolean;
  reloadEntries: () => void;
  actionType: ActionType | null;
  setActionType: (type: ActionType | null) => void;
};

export function BoxDetailSummary({
  box,
  householdId,
  activeBoxes,
  entries,
  loading,
  reloadEntries,
  actionType,
  setActionType,
}: BoxDetailSummaryProps) {
  const target = box.targetAmount ? Number.parseFloat(box.targetAmount) : null;
  const progress = target && target > 0 ? Math.min(100, (box.balance / target) * 100) : null;

  return (
    <div className="space-y-4">
      {/* Balance Card - Becomes compact when an action is active to save vertical space */}
      <div
        className={cn(
          "rounded-2xl",
          actionType ? "p-3 flex items-center justify-between" : "p-6 text-center"
        )}
        style={{ background: `${box.color}1A` }}
      >
        <div>
          <p className={cn(
            "uppercase tracking-widest font-bold",
            actionType ? "text-[10px] text-ink-400" : "text-xs text-ink-500"
          )}>
            Solde actuel
          </p>
          <p
            className={cn(
              "font-bold tabular-nums tracking-tight",
              actionType ? "text-xl mt-0" : "text-5xl mt-2",
              box.balance < 0 ? "text-red-700" : "text-ink-950",
            )}
          >
            {formatCurrency(box.balance)}
          </p>
        </div>

        {!actionType && target ? (
          <div className="mt-6 space-y-3">
            <div className="mx-auto h-2.5 max-w-xs overflow-hidden rounded-full bg-black/[0.08]">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${progress ?? 0}%`, background: box.color }}
              />
            </div>
            <p className="text-xs font-medium text-[var(--ink-600)]">
              Objectif {formatCurrency(target)}
              {box.targetDate
                ? ` · ${format(new Date(box.targetDate), "d MMM yyyy", { locale: fr })}`
                : ""}
            </p>
          </div>
        ) : actionType && target ? (
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold text-ink-400">Objectif</span>
            <span className="text-sm font-bold text-ink-700">{progress?.toFixed(0)}%</span>
          </div>
        ) : null}
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setActionType(actionType === "deposit" ? null : "deposit")}
          className={cn(
            "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-colors duration-150",
            actionType === "deposit"
              ? "bg-leaf-500 border-[var(--leaf-600)] text-white shadow-md"
              : "bg-[var(--leaf-50)] border-[var(--leaf-100)] text-[var(--leaf-700)] hover:bg-[var(--leaf-100)] opacity-80"
          )}
        >
          <ArrowDown className="size-5" />
          <span className="text-[10px] font-bold uppercase tracking-wide">Déposer</span>
        </button>
        <button
          onClick={() => setActionType(actionType === "withdrawal" ? null : "withdrawal")}
          className={cn(
            "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-colors duration-150",
            actionType === "withdrawal"
              ? "bg-coral-500 border-[var(--coral-600)] text-white shadow-md"
              : "bg-red-50 border-red-100 text-red-700 hover:bg-red-100 opacity-80"
          )}
        >
          <ArrowUp className="size-5" />
          <span className="text-[10px] font-bold uppercase tracking-wide">Retirer</span>
        </button>
        <button
          onClick={() => setActionType(actionType === "transfer" ? null : "transfer")}
          className={cn(
            "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-colors duration-150",
            actionType === "transfer"
              ? "bg-blue-600 border-blue-700 text-white shadow-md"
              : "bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100 opacity-80"
          )}
        >
          <ArrowLeftRight className="size-5" />
          <span className="text-[10px] font-bold uppercase tracking-wide">Transférer</span>
        </button>
      </div>

      {/* Dynamic Form Display */}
      {actionType ? (
        <div className="app-surface rounded-2xl p-5 border border-black/[0.03]">
          <div className="flex items-center justify-between mb-5">
            <h4 className="text-xs uppercase tracking-widest font-bold text-ink-500">
              {actionType === "deposit" ? "Nouveau versement" : actionType === "withdrawal" ? "Nouveau retrait" : "Nouveau transfert"}
            </h4>
            <button 
              onClick={() => setActionType(null)}
              className="text-[10px] uppercase font-bold text-ink-400 hover:text-red-500 transition-colors"
            >
              Fermer
            </button>
          </div>
          {actionType === "transfer" ? (
            <TransferForm
              householdId={householdId}
              fromBoxId={box.id}
              boxes={activeBoxes}
              onSuccess={() => {
                reloadEntries();
                setActionType(null);
              }}
            />
          ) : (
            <EntryForm 
              householdId={householdId} 
              boxId={box.id} 
              defaultType={actionType}
              hideTypeSelector={true}
              onSuccess={() => {
                reloadEntries();
                setActionType(null);
              }} 
            />
          )}
        </div>
      ) : null}

      {/* Chart - only if no form is open to save space */}
      {!actionType && !loading && entries.length > 0 ? (
        <div className="app-surface rounded-2xl p-4 overflow-hidden border border-black/[0.03]">
          <p className="text-[10px] uppercase font-bold text-ink-400 mb-3 tracking-widest text-center">Évolution du solde</p>
          <BalanceChart
            entries={entries}
            currentBalance={box.balance}
            color={box.color}
          />
        </div>
      ) : null}

      {!actionType ? (
        <CalculatorRunner
          householdId={householdId}
          boxId={box.id}
          boxes={activeBoxes}
          color={box.color}
          onRun={reloadEntries}
        />
      ) : null}

      {!actionType && (
        <details className="app-surface rounded-2xl border border-black/[0.03] overflow-hidden group">
          <summary className="cursor-pointer p-4 text-sm font-bold text-ink-700 hover:bg-black/[0.02] transition-colors list-none flex items-center justify-between">
            <span>Ajustement manuel du solde</span>
            <Settings className="size-4 opacity-50 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="p-4 pt-0 border-t border-black/[0.03]">
            <p className="text-xs text-ink-500 mb-4 mt-2">
              Pour corriger le solde sans créer de mouvement.
            </p>
            <AdjustForm
              householdId={householdId}
              boxId={box.id}
              currentBalance={box.balance}
              onSuccess={reloadEntries}
            />
          </div>
        </details>
      )}
    </div>
  );
}
