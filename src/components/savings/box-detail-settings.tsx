"use client";

import { useState } from "react";
import { Archive, Download, Pencil, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AutoFillForm } from "@/components/savings/auto-fill-form";
import { CalculatorRunner } from "@/components/savings/calculator-runner";
import { CalculatorManager } from "@/components/savings/calculator-manager";
import type { SavingsBoxView } from "@/components/savings/types";
import { useFormAction } from "@/lib/use-form-action";

type BoxDetailSettingsProps = {
  box: SavingsBoxView;
  householdId: string;
  activeBoxes: SavingsBoxView[];
  reloadEntries: () => void;
  setConfirmDelete: (value: boolean) => void;
};

export function BoxDetailSettings({
  box,
  householdId,
  activeBoxes,
  reloadEntries,
  setConfirmDelete,
}: BoxDetailSettingsProps) {
  const [settingsTab, setSettingsTab] = useState<"general" | "autofill" | "calculators">("general");
  const [managerOpen, setManagerOpen] = useState(false);
  const [editingCalculatorId, setEditingCalculatorId] = useState<string | null>(null);
  const [refreshCalculatorsKey, setRefreshCalculatorsKey] = useState(0);

  const archive = useFormAction({
    action: box ? `/api/households/${householdId}/savings/boxes/${box.id}` : "",
    successMessage: box?.isArchived ? "Enveloppe restaurée." : "Enveloppe archivée.",
    errorMessage: "Action impossible.",
  });

  const update = useFormAction({
    action: box ? `/api/households/${householdId}/savings/boxes/${box.id}` : "",
    successMessage: "Enveloppe mise à jour.",
    errorMessage: "Mise à jour impossible.",
  });

  return (
    <div className="space-y-4 pb-12">
      <div className="flex gap-2 p-1 bg-black/[0.03] rounded-lg">
        <button
          type="button"
          onClick={() => setSettingsTab("general")}
          className={cn(
            "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors duration-150",
            settingsTab === "general" ? "bg-white dark:bg-[#262830] shadow-sm" : "text-ink-500"
          )}
        >
          Général
        </button>
        <button
          type="button"
          onClick={() => setSettingsTab("autofill")}
          className={cn(
            "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors duration-150",
            settingsTab === "autofill" ? "bg-white dark:bg-[#262830] shadow-sm" : "text-ink-500"
          )}
        >
          Auto-versement
        </button>
        <button
          type="button"
          onClick={() => setSettingsTab("calculators")}
          className={cn(
            "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors duration-150",
            settingsTab === "calculators" ? "bg-white dark:bg-[#262830] shadow-sm" : "text-ink-500"
          )}
        >
          Calculateurs
        </button>
      </div>

      {settingsTab === "general" ? (
        <div className="space-y-6">
          <section className="app-surface rounded-2xl p-5 border border-black/[0.03]">
            <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-[var(--ink-800)]">
              <Pencil className="size-4 opacity-50" /> Identité
            </h4>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("_action", "update");
                update.submit(fd);
              }}
            >
              <label className="field-label">
                <span className="text-[10px] uppercase tracking-wider font-bold text-ink-500">Nom de l&apos;enveloppe</span>
                <input
                  name="name"
                  className="field mt-1"
                  type="text"
                  defaultValue={box.name}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={update.isSubmitting}
                className="btn-primary w-full py-3 text-sm font-bold shadow-md disabled:opacity-50"
              >
                {update.isSubmitting ? "Enregistrement…" : "Enregistrer les modifications"}
              </button>
            </form>
          </section>

          <section className="space-y-2">
            <h4 className="px-1 text-[10px] uppercase tracking-wider font-bold text-ink-500">Gestion</h4>
            <div className="grid grid-cols-1 gap-2">
              <a
                href={`/api/households/${householdId}/savings/boxes/${box.id}/export`}
                className="btn-secondary inline-flex items-center justify-center gap-2 py-3 text-sm font-bold"
                download
              >
                <Download className="size-4" />
                Exporter en CSV
              </a>
              <button
                type="button"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("_action", box.isArchived ? "unarchive" : "archive");
                  archive.submit(fd);
                }}
                disabled={archive.isSubmitting}
                className="btn-secondary inline-flex items-center justify-center gap-2 py-3 text-sm font-bold disabled:opacity-50"
              >
                <Archive className="size-4" />
                {box.isArchived ? "Désarchiver" : "Archiver l'enveloppe"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="btn-quiet inline-flex items-center justify-center gap-2 py-3 text-sm font-bold text-red-700 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                Supprimer définitivement
              </button>
            </div>
          </section>
        </div>
      ) : settingsTab === "autofill" ? (
        <div>
          <section className="app-surface rounded-2xl p-5 border border-black/[0.03]">
            <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-coral-500">
              <Sparkles className="size-4" /> Auto-versement
            </h4>
            <AutoFillForm
              householdId={householdId}
              boxId={box.id}
              current={box.autoFillRule}
            />
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <CalculatorRunner
            key={refreshCalculatorsKey}
            householdId={householdId}
            boxId={box.id}
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
            onRun={reloadEntries}
          />

          <CalculatorManager
            householdId={householdId}
            currentBoxId={box.id}
            boxes={activeBoxes}
            isOpen={managerOpen}
            initialEditingId={editingCalculatorId}
            onClose={() => {
              setManagerOpen(false);
              setEditingCalculatorId(null);
            }}
            onSuccess={() => setRefreshCalculatorsKey((k) => k + 1)}
          />
        </div>
      )}
    </div>
  );
}
