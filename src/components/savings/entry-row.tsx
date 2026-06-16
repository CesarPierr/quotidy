"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Pencil, Trash2, X, Check, Undo2 } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { formatSignedCurrency } from "@/lib/savings/currency";
import { useFormAction } from "@/lib/use-form-action";
import { cn } from "@/lib/utils";
import type { SavingsEntryView } from "@/components/savings/types";

const ENTRY_LABEL: Record<SavingsEntryView["type"], string> = {
  deposit: "Versement",
  withdrawal: "Retrait",
  transfer_in: "Transfert reçu",
  transfer_out: "Transfert envoyé",
  auto_fill: "Auto-versement",
  adjustment: "Ajustement",
};

type EntryRowProps = {
  entry: SavingsEntryView;
  householdId: string;
  onChanged: () => void;
};

export function EntryRow({ entry, householdId, onChanged }: EntryRowProps) {
  const amount = Number.parseFloat(entry.amount);
  const signed = ["deposit", "transfer_in", "auto_fill"].includes(entry.type)
    ? amount
    : entry.type === "adjustment"
      ? amount
      : -amount;
  const isLocked = entry.transferId !== null;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmTransferCancel, setConfirmTransferCancel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState(entry.amount);
  const [editReason, setEditReason] = useState(entry.reason ?? "");
  const [editDate, setEditDate] = useState(entry.occurredOn.slice(0, 10));

  const action = `/api/households/${householdId}/savings/entries/${entry.id}?boxId=${entry.boxId}&tab=history`;

  const update = useFormAction({
    action,
    successMessage: "Mouvement modifié.",
    errorMessage: "Modification impossible.",
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });

  const remove = useFormAction({
    action,
    successMessage: "Mouvement supprimé.",
    errorMessage: "Suppression impossible.",
    onSuccess: () => onChanged(),
  });

  const removeTransfer = useFormAction({
    action: entry.transferId ? `/api/households/${householdId}/savings/transfers/${entry.transferId}?boxId=${entry.boxId}&tab=history` : "",
    successMessage: "Transfert annulé.",
    errorMessage: "Annulation impossible.",
    onSuccess: () => onChanged(),
  });

  let content;

  if (editing) {
    content = (
      <form
        className="rounded-xl border border-black/[0.08] bg-white dark:bg-surface p-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData();
          fd.set("amount", editAmount);
          fd.set("occurredOn", editDate);
          fd.set("reason", editReason);
          update.submit(fd);
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <input
            className="field text-sm"
            type="text"
            inputMode="decimal"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            required
          />
          <input
            className="field text-sm"
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            required
          />
        </div>
        <input
          className="field text-sm"
          type="text"
          placeholder="Raison"
          value={editReason}
          onChange={(e) => setEditReason(e.target.value)}
          maxLength={280}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={update.isSubmitting}
            className="btn-primary inline-flex flex-1 items-center justify-center gap-1 px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            <Check className="size-3.5" />
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn-secondary inline-flex items-center justify-center gap-1 px-3 py-2 text-xs"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </form>
    );
  } else {
    content = (
      <div className="flex items-center gap-2 rounded-xl bg-black/[0.02] px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-950">
            {ENTRY_LABEL[entry.type]}
          </p>
          <p className="text-xs text-ink-500 truncate">
            {format(new Date(entry.occurredOn), "d MMM yyyy", { locale: fr })}
            {entry.reason ? ` · ${entry.reason}` : ""}
          </p>
        </div>
        <p
          className={cn(
            "text-sm font-bold tabular-nums",
            signed >= 0 ? "text-leaf-600" : "text-red-700",
          )}
        >
          {formatSignedCurrency(signed)}
        </p>
        <div className="flex items-center gap-1">
          {!isLocked ? (
            <>
              <button
                type="button"
                aria-label="Modifier"
                onClick={() => setEditing(true)}
                className="size-7 rounded-md text-ink-500 transition-colors hover:bg-black/[0.06] hover:text-ink-950 flex items-center justify-center"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Supprimer"
                disabled={remove.isSubmitting}
                onClick={() => setConfirmDelete(true)}
                className="size-7 rounded-md text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700 flex items-center justify-center disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-label="Annuler le transfert"
              disabled={removeTransfer.isSubmitting}
              onClick={() => setConfirmTransferCancel(true)}
              className="size-7 rounded-md text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700 flex items-center justify-center disabled:opacity-50"
              title="Annuler le transfert"
            >
              <Undo2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Dialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer ce mouvement ?"
        type="danger"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-sm font-semibold"
              onClick={() => setConfirmDelete(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="btn-primary bg-red-600 hover:bg-red-700 border-red-700 px-4 py-2 text-sm font-semibold"
              onClick={() => {
                const fd = new FormData();
                fd.set("_action", "delete");
                remove.submit(fd);
                setConfirmDelete(false);
              }}
            >
              Supprimer
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Voulez-vous vraiment supprimer ce mouvement de{" "}
          <strong>{formatSignedCurrency(signed)}</strong> ?
        </p>
      </Dialog>

      <Dialog
        isOpen={confirmTransferCancel}
        onClose={() => setConfirmTransferCancel(false)}
        title="Annuler ce transfert ?"
        type="danger"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-sm font-semibold"
              onClick={() => setConfirmTransferCancel(false)}
            >
              Conserver
            </button>
            <button
              type="button"
              className="btn-primary bg-red-600 hover:bg-red-700 border-red-700 px-4 py-2 text-sm font-semibold"
              onClick={() => {
                const fd = new FormData();
                fd.set("_action", "delete");
                removeTransfer.submit(fd);
                setConfirmTransferCancel(false);
              }}
            >
              Annuler le transfert
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Cette action supprimera les deux mouvements liés à ce transfert.
          Le solde des deux enveloppes sera rétabli.
        </p>
      </Dialog>

      {content}
    </>
  );
}
