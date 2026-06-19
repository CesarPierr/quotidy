"use client";

import { useEffect, useState } from "react";
import { BoxDetailSummary } from "@/components/savings/box-detail-summary";
import { BoxDetailHistory } from "@/components/savings/box-detail-history";
import { BoxDetailSettings } from "@/components/savings/box-detail-settings";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { BoxDeleteDialog } from "@/components/savings/box-delete-dialog";
import { useFormAction } from "@/lib/use-form-action";
import { cn } from "@/lib/utils";
import type { SavingsBoxView, SavingsEntryView } from "@/components/savings/types";

type Tab = "summary" | "history" | "settings";

type BoxDetailSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  box: SavingsBoxView | null;
  householdId: string;
  activeBoxes: SavingsBoxView[];
  onChanged?: () => void;
};

function BoxDetailContent({
  box,
  householdId,
  onClose,
  activeBoxes,
  onChanged,
}: {
  box: SavingsBoxView;
  householdId: string;
  onClose: () => void;
  activeBoxes: SavingsBoxView[];
  onChanged?: () => void;
}) {
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      if (t === "history" || t === "settings") return t;
    }
    return "summary";
  });

  const [actionType, setActionType] = useState<"deposit" | "withdrawal" | "transfer" | null>(null);
  const [entries, setEntries] = useState<SavingsEntryView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/households/${householdId}/savings/boxes/${box.id}/entries`, {
      headers: { "x-requested-with": "fetch" },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEntries(data.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [box.id, householdId]);

  const remove = useFormAction({
    action: box ? `/api/households/${householdId}/savings/boxes/${box.id}` : "",
    successMessage: "Enveloppe supprimée.",
    errorMessage: "Suppression impossible.",
    onSuccess: () => onClose(),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);

  async function reloadEntries() {
    if (!box) return;
    const res = await fetch(`/api/households/${householdId}/savings/boxes/${box.id}/entries`, {
      headers: { "x-requested-with": "fetch" },
    });
    const data = await res.json();
    setEntries(data.entries ?? []);
    onChanged?.();
  }

  return (
    <div className="space-y-4">
      <BoxDeleteDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        boxName={box.name}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("_action", "delete");
          remove.submit(fd);
          setConfirmDelete(false);
        }}
      />

      <div className="sticky top-0 z-10 bg-[var(--card)] pb-2 pt-1">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/[0.04] p-1">
          {(["summary", "history", "settings"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "min-h-11 rounded-lg py-2 text-xs font-bold transition-all duration-200 active:scale-[0.96] truncate px-1",
                tab === t
                  ? "bg-white dark:bg-surface text-ink-950 shadow-sm"
                  : "text-ink-500 hover:text-ink-700",
              )}
            >
              {t === "summary" ? "Synthèse" : t === "history" ? "Historique" : "Réglages"}
            </button>
          ))}
        </div>
      </div>

      <div key={tab} className="min-h-[350px] animate-in fade-in duration-200 motion-reduce:animate-none">
        {tab === "summary" ? (
          <BoxDetailSummary
            box={box}
            householdId={householdId}
            activeBoxes={activeBoxes}
            entries={entries}
            loading={loading}
            reloadEntries={reloadEntries}
            actionType={actionType}
            setActionType={setActionType}
          />
        ) : null}

        {tab === "history" ? (
          <BoxDetailHistory
            householdId={householdId}
            entries={entries}
            loading={loading}
            reloadEntries={reloadEntries}
          />
        ) : null}

        {tab === "settings" ? (
          <BoxDetailSettings
            box={box}
            householdId={householdId}
            activeBoxes={activeBoxes}
            reloadEntries={reloadEntries}
            setConfirmDelete={setConfirmDelete}
          />
        ) : null}
      </div>
    </div>
  );
}

export function BoxDetailSheet({ isOpen, onClose, box, householdId, activeBoxes, onChanged }: BoxDetailSheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={box?.name ?? ""} maxHeight={95}>
      {box ? (
        <BoxDetailContent 
          key={box.id} 
          box={box} 
          householdId={householdId} 
          onClose={onClose} 
          activeBoxes={activeBoxes}
          onChanged={onChanged}
        />
      ) : null}
    </BottomSheet>
  );
}
