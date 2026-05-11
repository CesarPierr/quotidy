"use client";

import { PiggyBank, Target, AlertCircle, CheckCircle2, Pause } from "lucide-react";

import { formatCurrency } from "@/lib/savings/currency";
import { cn } from "@/lib/utils";
import type { SavingsBoxView } from "@/components/savings/types";

type BoxCardProps = {
  box: SavingsBoxView;
  onClick: () => void;
};

const kindLabel: Record<SavingsBoxView["kind"], string> = {
  savings: "Épargne",
  project: "Projet",
  debt: "Dette",
  provision: "Provision",
};

export function BoxCard({ box, onClick }: BoxCardProps) {
  const balance = box.balance;
  const target = box.targetAmount ? Number.parseFloat(box.targetAmount) : null;
  const progress = target && target > 0 ? Math.min(100, Math.max(0, (balance / target) * 100)) : null;
  const goalReached = target ? balance >= target : false;
  const inDebt = balance < 0;
  const debtIssue = inDebt && !box.allowNegative;
  const autoFillRule = box.autoFillRule;

  let statusLabel: { text: string; className: string; Icon: typeof CheckCircle2 } | null = null;
  if (goalReached) {
    statusLabel = {
      text: "Objectif atteint",
      className: "text-leaf-600 bg-[rgba(56,115,93,0.10)]",
      Icon: CheckCircle2,
    };
  } else if (debtIssue) {
    statusLabel = {
      text: "Solde négatif",
      className: "text-red-700 bg-red-50",
      Icon: AlertCircle,
    };
  } else if (autoFillRule?.isPaused) {
    statusLabel = {
      text: "Auto-versement en pause",
      className: "text-amber-700 bg-amber-50",
      Icon: Pause,
    };
  }

  return (
    <button
      onClick={onClick}
      type="button"
      aria-label={`Ouvrir ${box.name}, solde ${formatCurrency(balance)}`}
      className="app-surface interactive-surface w-full rounded-2xl p-3.5 text-left transition-shadow duration-150 hover:shadow-md sm:p-4"
      style={{ borderLeft: `4px solid ${box.color}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PiggyBank className="size-4 shrink-0" style={{ color: box.color }} />
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
              {kindLabel[box.kind]}
            </p>
          </div>
          <h3 className="mt-1 truncate text-sm font-bold text-ink-950 sm:text-base">{box.name}</h3>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "text-lg font-bold tabular-nums sm:text-xl",
              inDebt ? "text-red-700" : "text-ink-950",
            )}
          >
            {formatCurrency(balance)}
          </p>
          {target ? (
            <p className="mt-0.5 text-[0.68rem] text-ink-500 sm:text-xs">/ {formatCurrency(target)}</p>
          ) : null}
        </div>
      </div>

      {progress !== null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progress}%`,
              background: goalReached ? "var(--leaf-500, #3F7E66)" : box.color,
            }}
          />
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {statusLabel ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
              statusLabel.className,
            )}
          >
            <statusLabel.Icon className="size-3" />
            {statusLabel.text}
          </span>
        ) : null}
        {autoFillRule && !autoFillRule.isPaused ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.7rem] font-medium text-ink-700">
            <Target className="size-3" />
            Auto +{formatCurrency(autoFillRule.amount)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
