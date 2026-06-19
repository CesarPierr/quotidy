"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calculator, ChevronDown, Plus, Settings2 } from "lucide-react";

import { formatCurrency } from "@/lib/savings/currency";
import { evaluateFormula } from "@/lib/savings/formula";
import { useFormAction } from "@/lib/use-form-action";
import { cn } from "@/lib/utils";
import type { SavingsBoxView, SavingsCalculatorView } from "@/components/savings/types";

type CalculatorRunnerProps = {
  householdId: string;
  boxId?: string | null;
  boxes: SavingsBoxView[];
  color: string;
  title?: string;
  defaultOpen?: boolean;
  variant?: "accordion" | "grid";
  onRun?: () => void;
  onEdit?: (calculator: SavingsCalculatorView) => void;
  onCreate?: () => void;
};

function parseInput(value: string) {
  const parsed = Number.parseFloat(value.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function applyPreviewResult(calculator: SavingsCalculatorView, raw: number) {
  let value = raw;
  let entryType = calculator.resultMode;
  if (value < 0) {
    if (calculator.negativeMode === "clamp_to_zero") {
      value = 0;
    } else {
      value = Math.abs(value);
      entryType = calculator.resultMode === "deposit" ? "withdrawal" : "deposit";
    }
  }
  switch (calculator.roundingMode) {
    case "euro_floor":
      value = Math.floor(value);
      break;
    case "euro_ceil":
      value = Math.ceil(value);
      break;
    case "euro_nearest":
      value = Math.round(value);
      break;
    case "cents":
      value = Math.round(value * 100) / 100;
      break;
  }
  return { amount: value, entryType };
}

export function CalculatorRunner({
  householdId,
  boxId = null,
  boxes,
  color,
  title = "Calculateurs rapides",
  defaultOpen = false,
  variant = "accordion",
  onRun,
  onEdit,
  onCreate,
}: CalculatorRunnerProps) {
  const [calculators, setCalculators] = useState<SavingsCalculatorView[]>([]);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedId, setSelectedId] = useState<string>("");
  const [targetBoxId, setTargetBoxId] = useState(boxId ?? "");
  const [inputs, setInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const suffix = boxId ? `?boxId=${boxId}` : "";
    fetch(`/api/households/${householdId}/savings/calculators${suffix}`, {
      headers: { "x-requested-with": "fetch" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = (data.calculators ?? []) as SavingsCalculatorView[];
        setCalculators(list);
      })
      .catch(() => {
        if (!cancelled) setCalculators([]);
      });
    return () => {
      cancelled = true;
    };
  }, [householdId, boxId]);

  function chooseCalculator(calculator: SavingsCalculatorView) {
    setSelectedId(calculator.id);
    setTargetBoxId(boxId || calculator.boxId || boxes.find((b) => !b.isArchived)?.id || "");
    setInputs(
      Object.fromEntries(
        calculator.fields.map((field) => [field.key, field.defaultValue?.replace(".", ",") ?? ""]),
      ),
    );
  }

  function clearSelection() {
    setSelectedId("");
    setInputs({});
  }

  const selected = useMemo(
    () => calculators.find((calculator) => calculator.id === selectedId) ?? null,
    [calculators, selectedId],
  );

  const preview = useMemo(() => {
    if (!selected) return null;
    const values: Record<string, number> = {};
    for (const field of selected.fields) {
      const value = parseInput(inputs[field.key] ?? "");
      if (value == null) return null;
      values[field.key] = value;
    }
    try {
      return applyPreviewResult(selected, evaluateFormula(selected.formula, values));
    } catch {
      return null;
    }
  }, [inputs, selected]);

  const run = useFormAction({
    action: selected
      ? `/api/households/${householdId}/savings/calculators/${selected.id}/run`
      : "",
    successMessage: selected?.resultMode === "none" ? "Calcul terminé." : "Calcul ajouté à l'enveloppe.",
    errorMessage: "Impossible d'appliquer ce calcul.",
    onSuccess: onRun,
  });

  if (calculators.length === 0) {
    if (variant === "grid") {
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={onCreate}
            className="app-surface rounded-xl border border-dashed border-black/10 p-4 flex flex-col items-center justify-center gap-2 text-center hover:bg-black/[0.02] transition-all duration-150 active:scale-[0.98] group h-full min-h-[72px]"
          >
            <Plus className="size-5 text-ink-400 group-hover:text-coral-500 transition-colors" />
            <span className="text-xs font-bold text-ink-400">Nouveau calculateur</span>
          </button>
        </div>
      );
    }
    return null;
  }

  const form = selected ? (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData();
        for (const field of selected.fields) {
          fd.set(`input:${field.key}`, inputs[field.key] ?? "");
        }
        if (selected.resultMode !== "none") {
          fd.set("targetBoxId", targetBoxId);
        }
        run.submit(fd);
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={clearSelection}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-500 transition-all hover:text-ink-950 hover:bg-black/[0.04] active:scale-95"
          aria-label="Revenir à la liste des calculateurs"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Liste
        </button>
        <p className="text-sm font-bold text-[var(--ink-900)] truncate">{selected.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {selected.resultMode !== "none" ? (
          <label className="field-label sm:col-span-2">
            <span className="text-[10px] uppercase font-bold text-ink-500">Enveloppe cible</span>
            <select
              className="field"
              value={targetBoxId}
              onChange={(event) => setTargetBoxId(event.target.value)}
              required
            >
              {boxes.filter((b) => !b.isArchived).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {selected.fields.map((field) => (
          <label key={field.id} className="field-label">
            <span className="text-[10px] uppercase font-bold text-ink-500">{field.label}</span>
            <input
              className="field"
              type="text"
              inputMode="decimal"
              value={inputs[field.key] ?? ""}
              onChange={(event) => setInputs((current) => ({ ...current, [field.key]: event.target.value }))}
              placeholder={field.type === "percent" ? "20" : field.type === "amount" ? "0,00" : "0"}
              required={field.isRequired}
            />
            {field.helperText ? (
              <span className="text-[0.65rem] font-medium text-ink-400 mt-0.5">{field.helperText}</span>
            ) : null}
          </label>
        ))}
      </div>

      <button
        type="submit"
        disabled={run.isSubmitting || !preview || (selected.resultMode !== "none" && (preview.amount <= 0 || !targetBoxId))}
        className="btn-primary flex min-h-11 w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
      >
        <Calculator className="size-4 shrink-0" />
        <span
          key={
            selected.resultMode === "none"
              ? "done"
              : preview
                ? `${preview.entryType}-${preview.amount}`
                : "idle"
          }
          className="animate-in fade-in duration-200 motion-reduce:animate-none"
        >
          {selected.resultMode === "none"
            ? "Terminer"
            : preview
              ? `${preview.entryType === "deposit" ? "Ajouter" : "Retirer"} ${formatCurrency(preview.amount)}`
              : "Calculer"}
        </span>
      </button>
    </form>
  ) : null;

  const calculatorList = (compact: boolean) => (
    <div className={cn("grid gap-2", compact ? "" : "sm:grid-cols-2 lg:grid-cols-3 sm:gap-3")}>
      {calculators.map((calculator) => (
        <div key={calculator.id} className="relative">
          <button
            type="button"
            onClick={() => chooseCalculator(calculator)}
            className="w-full app-surface rounded-xl border border-black/[0.04] p-3 text-left hover:border-black/[0.1] hover:bg-black/[0.01] transition-all duration-150 active:scale-[0.98]"
            style={{ borderLeft: `4px solid ${color}` }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 rounded-xl bg-black/[0.03]">
                <Calculator className="size-4" style={{ color }} />
              </div>
              <div className="min-w-0 flex-1 pr-6">
                <h3 className="truncate text-sm font-bold text-ink-950">{calculator.name}</h3>
                <p className="mt-0.5 line-clamp-1 text-[10px] uppercase font-bold tracking-wider text-ink-400">
                  {calculator.boxId ? "Cible par défaut" : "Global"}
                </p>
              </div>
            </div>
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(calculator); }}
              className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-lg text-ink-400 hover:text-[var(--ink-900)] hover:bg-black/[0.05] transition-all duration-150 active:scale-90"
              title="Modifier le modèle"
              aria-label={`Modifier ${calculator.name}`}
            >
              <Settings2 className="size-3.5" />
            </button>
          )}
        </div>
      ))}
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="app-surface rounded-xl border border-dashed border-black/10 p-3 flex items-center justify-center gap-2 hover:bg-black/[0.02] transition-all duration-150 active:scale-[0.98] min-h-[72px]"
        >
          <Plus className="size-4 text-ink-400" />
          <span className="text-xs font-bold text-ink-400">Nouveau</span>
        </button>
      )}
    </div>
  );

  if (variant === "grid") {
    return (
      <section className="space-y-3 sm:space-y-4">
        {selected ? (
          <div
            key={selected.id}
            className="app-surface mx-auto w-full max-w-lg rounded-[1.4rem] border border-black/[0.03] p-4 animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none sm:rounded-[1.6rem] sm:p-5"
          >
            {form}
          </div>
        ) : (
          <div className="animate-in fade-in duration-200 motion-reduce:animate-none">
            {calculatorList(false)}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="app-surface overflow-hidden rounded-[1.4rem] border border-black/[0.03] sm:rounded-[1.6rem]">
      <button
        type="button"
        onClick={() => {
          setIsOpen((value) => {
            const next = !value;
            if (!next) clearSelection();
            return next;
          });
        }}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors active:bg-black/[0.02]"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-[var(--ink-800)]">
          <Calculator className="size-4" style={{ color }} />
          {title}
        </span>
        <ChevronDown
          className={cn("size-4 text-ink-500 transition-transform duration-150", isOpen ? "rotate-180" : "")}
        />
      </button>

      {isOpen ? (
        <div className="border-t border-black/[0.04] p-4 pt-3">
          {selected ? form : calculatorList(true)}
        </div>
      ) : null}
    </section>
  );
}
