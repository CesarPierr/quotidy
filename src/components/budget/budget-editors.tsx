"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { taskPalette } from "@/lib/constants";
import type { BudgetPeriod, SerializedCharge, SerializedExpense, SerializedIncome, SerializedPocket } from "@/lib/budget";
import { formatCurrency } from "@/lib/savings/currency";
import { cn } from "@/lib/utils";

type Submit = (fields: Record<string, string>) => Promise<boolean>;
type Remove = (fields: Record<string, string>) => Promise<boolean>;

const COLORS = taskPalette.slice(0, 8);
const POCKET_ICONS = ["🛒", "🍽️", "🚗", "🏠", "🎬", "💊", "👕", "💡", "🎁", "📚", "✈️", "☕", "🏥", "💼", "🐾", "💪"];

function AmountField({ value, onChange, label = "Montant", autoFocus }: { value: string; onChange: (v: string) => void; label?: string; autoFocus?: boolean }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <div className="relative">
        <input
          autoFocus={autoFocus}
          className="field pr-9"
          inputMode="decimal"
          onChange={(e) => onChange(e.target.value)}
          placeholder="0,00"
          value={value}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-400">€</span>
      </div>
    </label>
  );
}

function DeleteButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Trash2 className="size-4" /> Supprimer
    </button>
  );
}

// ── Dépense ────────────────────────────────────────────────────────────────────
export function ExpenseEditor({
  open,
  onClose,
  busy,
  pockets,
  defaultPocketId,
  todayIso,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  pockets: SerializedPocket[];
  defaultPocketId?: string;
  todayIso: string;
  onSubmit: Submit;
}) {
  const [amount, setAmount] = useState("");
  const [pocketId, setPocketId] = useState(defaultPocketId ?? "");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(todayIso);
  const [refundable, setRefundable] = useState(false);
  const [refundExpected, setRefundExpected] = useState("");

  return (
    <BottomSheet isOpen={open} onClose={onClose} title="Nouvelle dépense">
      <div className="space-y-3">
        <AmountField autoFocus value={amount} onChange={setAmount} />
        <div className="field-label">
          <span>Poste</span>
          <div className="flex flex-wrap gap-2">
            <button
              className={cn("min-h-9 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all active:scale-95", pocketId === "" ? "border-ink-950 bg-ink-950/[0.06] text-ink-950" : "border-line bg-glass-bg text-ink-500")}
              onClick={() => setPocketId("")}
              type="button"
            >
              Sans poste
            </button>
            {pockets.map((p) => (
              <button
                className={cn("min-h-9 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all active:scale-95", pocketId === p.id ? "text-ink-950" : "border-line bg-glass-bg text-ink-500")}
                key={p.id}
                onClick={() => setPocketId(p.id)}
                style={pocketId === p.id ? { borderColor: p.color, backgroundColor: `${p.color}1f` } : undefined}
                type="button"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <label className="field-label">
          <span>Libellé (facultatif)</span>
          <input className="field" maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Courses Lidl" value={label} />
        </label>
        <label className="field-label">
          <span>Date</span>
          <input className="field" onChange={(e) => setDate(e.target.value)} type="date" value={date} />
        </label>
        <div className="rounded-xl border border-line p-3">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink-950">À rembourser</span>
              <span className="block text-xs text-ink-500">Médical, frais pro… on suit ce qu&apos;on vous doit.</span>
            </span>
            <input
              checked={refundable}
              className="size-5 shrink-0 accent-coral-500"
              onChange={(e) => {
                setRefundable(e.target.checked);
                if (e.target.checked && !refundExpected) setRefundExpected(amount);
              }}
              type="checkbox"
            />
          </label>
          {refundable ? (
            <div className="mt-3">
              <AmountField label="Montant attendu" onChange={setRefundExpected} value={refundExpected} />
            </div>
          ) : null}
        </div>
        <button
          className="btn-primary min-h-11 w-full px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          disabled={busy || !amount.trim()}
          onClick={() =>
            onSubmit({
              _action: "expense.create",
              amount,
              pocketId,
              label,
              spentAt: date ? `${date}T12:00:00` : "",
              ...(refundable && refundExpected.trim() ? { refundExpected } : {}),
            })
          }
          type="button"
        >
          Ajouter la dépense
        </button>
      </div>
    </BottomSheet>
  );
}

// ── Poste ────────────────────────────────────────────────────────────────────
export function PocketEditor({
  open,
  onClose,
  busy,
  entity,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  entity?: SerializedPocket;
  onSubmit: Submit;
  onDelete: Remove;
}) {
  const [name, setName] = useState(entity?.name ?? "");
  const [icon, setIcon] = useState(entity?.icon ?? "");
  const [color, setColor] = useState(entity?.color ?? COLORS[0] ?? "#2F6D88");
  const [period, setPeriod] = useState<BudgetPeriod>(entity?.period ?? "monthly");
  const [quota, setQuota] = useState(entity ? String(entity.quota) : "");

  return (
    <BottomSheet isOpen={open} onClose={onClose} title={entity ? "Modifier le poste" : "Nouveau poste"}>
      <div className="space-y-3">
        <label className="field-label">
          <span>Nom</span>
          <input autoFocus className="field" maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ex. Alimentation" value={name} />
        </label>
        <div className="field-label">
          <span>Icône (facultatif)</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              aria-pressed={icon === ""}
              className={cn("flex size-8 items-center justify-center rounded-full border text-sm transition-transform", icon === "" ? "border-ink-950 bg-ink-950/[0.06] text-ink-700" : "border-line text-ink-400 hover:scale-110")}
              onClick={() => setIcon("")}
              type="button"
            >
              ∅
            </button>
            {POCKET_ICONS.map((e) => (
              <button
                aria-pressed={icon === e}
                className={cn("flex size-8 items-center justify-center rounded-full border text-base transition-transform", icon === e ? "scale-110 border-coral-500 bg-coral-500/10" : "border-line hover:scale-110")}
                key={e}
                onClick={() => setIcon(e)}
                type="button"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="field-label">
          <span>Période du budget</span>
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-white/60 p-1 dark:bg-surface/60">
            {([["monthly", "Mensuel"], ["weekly", "Hebdomadaire"]] as const).map(([value, lbl]) => (
              <button
                className={cn("min-h-11 rounded-xl px-3 py-2 text-sm font-semibold transition-all active:scale-[0.98]", period === value ? "bg-white text-ink-950 shadow-sm dark:bg-surface" : "text-ink-500")}
                key={value}
                onClick={() => setPeriod(value)}
                type="button"
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <AmountField label={period === "weekly" ? "Quota par semaine" : "Quota par mois"} onChange={setQuota} value={quota} />
        <div className="field-label">
          <span>Couleur</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                aria-label={`Couleur ${c}`}
                aria-pressed={color === c}
                className={cn("size-7 rounded-full transition-transform", color === c ? "scale-110 ring-2 ring-ink-950/25 ring-offset-1" : "opacity-70 hover:scale-110")}
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                type="button"
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          {entity ? <DeleteButton disabled={busy} onClick={() => onDelete({ _action: "pocket.delete", id: entity.id })} /> : <span />}
          <button
            className="btn-primary min-h-11 px-5 py-2.5 text-sm font-bold disabled:opacity-50"
            disabled={busy || !name.trim() || !quota.trim()}
            onClick={() => onSubmit({ _action: entity ? "pocket.update" : "pocket.create", id: entity?.id ?? "", name, icon, color, period, quota })}
            type="button"
          >
            {entity ? "Enregistrer" : "Créer le poste"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Revenu ───────────────────────────────────────────────────────────────────
export function IncomeEditor({
  open,
  onClose,
  busy,
  entity,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  entity?: SerializedIncome;
  onSubmit: Submit;
  onDelete: Remove;
}) {
  const [label, setLabel] = useState(entity?.label ?? "");
  const [amount, setAmount] = useState(entity ? String(entity.amount) : "");

  return (
    <BottomSheet isOpen={open} onClose={onClose} title={entity ? "Modifier le revenu" : "Nouveau revenu"}>
      <div className="space-y-3">
        <label className="field-label">
          <span>Libellé</span>
          <input autoFocus className="field" maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Salaire Alex" value={label} />
        </label>
        <AmountField label="Montant mensuel" onChange={setAmount} value={amount} />
        <div className="flex items-center justify-between gap-2 pt-1">
          {entity ? <DeleteButton disabled={busy} onClick={() => onDelete({ _action: "income.delete", id: entity.id })} /> : <span />}
          <button
            className="btn-primary min-h-11 px-5 py-2.5 text-sm font-bold disabled:opacity-50"
            disabled={busy || !label.trim() || !amount.trim()}
            onClick={() => onSubmit({ _action: entity ? "income.update" : "income.create", id: entity?.id ?? "", label, amount })}
            type="button"
          >
            {entity ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Charge fixe ────────────────────────────────────────────────────────────────
export function ChargeEditor({
  open,
  onClose,
  busy,
  entity,
  savingsBoxes,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  entity?: SerializedCharge;
  savingsBoxes: { id: string; name: string }[];
  onSubmit: Submit;
  onDelete: Remove;
}) {
  const [label, setLabel] = useState(entity?.label ?? "");
  const [amount, setAmount] = useState(entity ? String(entity.amount) : "");
  const [day, setDay] = useState(entity?.dayOfMonth ? String(entity.dayOfMonth) : "");
  const [savingsBoxId, setSavingsBoxId] = useState(entity?.savingsBoxId ?? "");

  return (
    <BottomSheet isOpen={open} onClose={onClose} title={entity ? "Modifier la charge" : "Nouvelle charge fixe"}>
      <div className="space-y-3">
        <label className="field-label">
          <span>Libellé</span>
          <input autoFocus className="field" maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Loyer, Internet…" value={label} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <AmountField label="Montant mensuel" onChange={setAmount} value={amount} />
          <label className="field-label">
            <span>Jour du mois (facultatif)</span>
            <input className="field" inputMode="numeric" max={31} min={1} onChange={(e) => setDay(e.target.value)} placeholder="Ex. 5" type="number" value={day} />
          </label>
        </div>
        {savingsBoxes.length > 0 ? (
          <label className="field-label">
            <span>Liée à une enveloppe d&apos;épargne (facultatif)</span>
            <select className="field" onChange={(e) => setSavingsBoxId(e.target.value)} value={savingsBoxId}>
              <option value="">Aucune — charge classique</option>
              {savingsBoxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <span className="field-help">Indicatif : étiquette la charge comme une épargne récurrente. Le versement réel se règle dans l&apos;enveloppe (auto-versement).</span>
          </label>
        ) : null}
        <div className="flex items-center justify-between gap-2 pt-1">
          {entity ? <DeleteButton disabled={busy} onClick={() => onDelete({ _action: "charge.delete", id: entity.id })} /> : <span />}
          <button
            className="btn-primary min-h-11 px-5 py-2.5 text-sm font-bold disabled:opacity-50"
            disabled={busy || !label.trim() || !amount.trim()}
            onClick={() => onSubmit({ _action: entity ? "charge.update" : "charge.create", id: entity?.id ?? "", label, amount, dayOfMonth: day, savingsBoxId })}
            type="button"
          >
            {entity ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Remboursement ──────────────────────────────────────────────────────────────
export function RefundEditor({
  open,
  onClose,
  busy,
  expense,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  expense: SerializedExpense;
  onSubmit: Submit;
}) {
  const [received, setReceived] = useState(expense.refundExpected != null ? String(expense.refundExpected) : "");

  return (
    <BottomSheet isOpen={open} onClose={onClose} title="Remboursement reçu">
      <div className="space-y-3">
        <div className="rounded-xl border border-line p-3 text-sm">
          <p className="font-semibold text-ink-950">{expense.label || expense.pocketName || "Dépense"}</p>
          <p className="mt-0.5 text-ink-500">
            Payé {formatCurrency(expense.amount)}
            {expense.refundExpected != null ? ` · attendu ${formatCurrency(expense.refundExpected)}` : ""}
          </p>
        </div>
        <AmountField autoFocus label="Montant reçu (total)" onChange={setReceived} value={received} />
        <p className="field-help">Saisissez le total reçu — laissez tel quel pour un remboursement complet, ou ajustez pour un partiel.</p>
        <button
          className="btn-primary min-h-11 w-full px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          disabled={busy || !received.trim()}
          onClick={() => onSubmit({ _action: "expense.refund", id: expense.id, refundedAmount: received })}
          type="button"
        >
          Enregistrer le remboursement
        </button>
      </div>
    </BottomSheet>
  );
}

export type { SerializedExpense };
