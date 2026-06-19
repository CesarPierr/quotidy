"use client";

import { useState } from "react";
import { Pause, Play, Trash2 } from "lucide-react";

import { todayDateInput } from "@/lib/date-input";
import { useFormAction } from "@/lib/use-form-action";
import { cn } from "@/lib/utils";
import type { SavingsAutoFillView } from "@/components/savings/types";

type AutoFillFormProps = {
  householdId: string;
  boxId: string;
  current: SavingsAutoFillView | null;
  onSaved?: () => void;
};

const FREQUENCY_OPTIONS = [
  { value: "monthly_simple" as const, label: "Mensuel" },
  { value: "weekly" as const, label: "Hebdomadaire" },
  { value: "every_x_weeks" as const, label: "Toutes les X semaines" },
  { value: "every_x_days" as const, label: "Tous les X jours" },
  { value: "daily" as const, label: "Quotidien" },
];

const WEEKDAYS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "M" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
];

export function AutoFillForm({ householdId, boxId, current, onSaved }: AutoFillFormProps) {
  const [amount, setAmount] = useState(current?.amount ?? "");
  const [type, setType] = useState<SavingsAutoFillView["type"]>(current?.type ?? "monthly_simple");
  const [interval, setInterval] = useState(String(current?.interval ?? 1));
  const [dayOfMonth, setDayOfMonth] = useState(String(current?.dayOfMonth ?? 5));
  const [weekdays, setWeekdays] = useState<number[]>(current?.weekdays ?? [1]);
  const [startsOn, setStartsOn] = useState(current?.startsOn?.slice(0, 10) ?? todayDateInput());
  const [endsOn, setEndsOn] = useState(current?.endsOn?.slice(0, 10) ?? "");

  const action = `/api/households/${householdId}/savings/boxes/${boxId}/auto-fill`;

  const save = useFormAction({
    action,
    successMessage: "Auto-versement enregistré.",
    errorMessage: "Impossible d'enregistrer l'auto-versement.",
    onSuccess: () => onSaved?.(),
  });

  const togglePause = useFormAction({
    action,
    successMessage: current?.isPaused ? "Auto-versement repris." : "Auto-versement en pause.",
    errorMessage: "Action impossible.",
    onSuccess: () => onSaved?.(),
  });

  const remove = useFormAction({
    action,
    successMessage: "Auto-versement supprimé.",
    errorMessage: "Suppression impossible.",
    onSuccess: () => onSaved?.(),
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("amount", amount);
    fd.set("type", type);
    fd.set("interval", interval);
    if (type === "weekly") {
      for (const w of weekdays) fd.append("weekdays", String(w));
    }
    if (type === "monthly_simple") fd.set("dayOfMonth", dayOfMonth);
    fd.set("anchorDate", startsOn);
    fd.set("startsOn", startsOn);
    if (endsOn) fd.set("endsOn", endsOn);
    await save.submit(fd);
  }

  function toggleWeekday(day: number) {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="field-label">
          <span>Montant à verser (€)</span>
          <input
            className="field"
            type="text"
            inputMode="decimal"
            placeholder="50,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>

        <label className="field-label">
          <span>Fréquence</span>
          <select
            className="field"
            value={type}
            onChange={(e) => setType(e.target.value as SavingsAutoFillView["type"])}
          >
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {(type === "every_x_days" || type === "every_x_weeks") ? (
          <label className="field-label">
            <span>Intervalle (en {type === "every_x_days" ? "jours" : "semaines"})</span>
            <input
              className="field"
              type="number"
              min={1}
              max={90}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            />
          </label>
        ) : null}

        {type === "monthly_simple" ? (
          <label className="field-label">
            <span>Jour du mois (1–31)</span>
            <input
              className="field"
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
            />
          </label>
        ) : null}

        {type === "weekly" ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink-700">Jours de la semaine</p>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d) => {
                const active = weekdays.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleWeekday(d.value)}
                    className={cn(
                      "h-10 rounded-lg text-sm font-semibold transition-colors",
                      active
                        ? "bg-coral-500 text-white"
                        : "bg-black/[0.04] text-ink-700",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <label className="field-label">
          <span>Démarrage</span>
          <input
            className="field"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            required
          />
        </label>

        <label className="field-label">
          <span>Fin (facultatif)</span>
          <input
            className="field"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </label>

        <button
          type="submit"
          disabled={save.isSubmitting || !amount.trim()}
          className="btn-primary w-full px-4 py-3 font-semibold disabled:opacity-50"
        >
          {save.isSubmitting ? "Enregistrement…" : current ? "Mettre à jour" : "Activer l'auto-versement"}
        </button>
      </form>

      {current ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={togglePause.isSubmitting}
            onClick={() => {
              const fd = new FormData();
              fd.set("_action", current.isPaused ? "resume" : "pause");
              togglePause.submit(fd);
            }}
            className="btn-secondary inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {current.isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {current.isPaused ? "Reprendre" : "Mettre en pause"}
          </button>
          <button
            type="button"
            disabled={remove.isSubmitting}
            onClick={() => {
              if (!window.confirm("Supprimer l'auto-versement ?")) return;
              const fd = new FormData();
              fd.set("_action", "remove");
              remove.submit(fd);
            }}
            className="btn-quiet inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            <Trash2 className="size-4" />
            Supprimer
          </button>
        </div>
      ) : null}
    </div>
  );
}
