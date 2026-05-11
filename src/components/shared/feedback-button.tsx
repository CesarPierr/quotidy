"use client";

import { useState } from "react";
import { LifeBuoy } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type FeedbackKind = "bug" | "idea" | "question";

const KIND_OPTIONS: { value: FeedbackKind; label: string; description: string }[] = [
  { value: "bug", label: "Bug", description: "Quelque chose ne fonctionne pas comme prévu." },
  { value: "idea", label: "Idée", description: "Une amélioration ou une nouvelle fonctionnalité." },
  { value: "question", label: "Question", description: "Besoin d'aide ou de clarifications." },
];

export function FeedbackButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (message.trim().length < 10) {
      showError("Décris ton problème en au moins 10 caractères.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "fetch" },
        body: JSON.stringify({
          kind,
          message: message.trim(),
          url: typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      success("Merci, ton retour nous est parvenu.");
      setMessage("");
      setIsOpen(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-line bg-glass-bg px-3 py-1.5 text-xs font-semibold text-ink-700 hover:text-ink-950 hover:bg-white shadow-sm transition-colors",
          className,
        )}
        aria-label="Signaler un problème ou suggérer une amélioration"
      >
        <LifeBuoy className="size-3.5" aria-hidden="true" />
        <span className={compact ? "sr-only" : undefined}>Aide / signaler</span>
      </button>

      <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="Aide & signalement" maxHeight={75}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2">Catégorie</p>
            <div className="grid grid-cols-3 gap-2">
              {KIND_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setKind(option.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs font-bold transition-colors",
                    kind === option.value
                      ? "border-coral-500 bg-[var(--coral-50)] text-coral-700"
                      : "border-line bg-glass-bg text-ink-700",
                  )}
                  aria-pressed={kind === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-500">
              {KIND_OPTIONS.find((o) => o.value === kind)?.description}
            </p>
          </div>

          <label className="field-label">
            <span className="text-[10px] uppercase font-bold text-ink-500">Décris en quelques mots</span>
            <textarea
              className="field min-h-[120px]"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                kind === "bug"
                  ? "Que faisais-tu ? Qu'attendais-tu ? Que s'est-il passé à la place ?"
                  : kind === "idea"
                  ? "Quelle situation, quel besoin ?"
                  : "Pose ta question."
              }
              maxLength={4000}
              required
            />
          </label>

          <p className="text-[10px] text-ink-400">
            Pour t&apos;aider, on inclut l&apos;URL de la page courante et la version du navigateur.
            Aucune donnée personnelle supplémentaire n&apos;est envoyée.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn-quiet px-4 py-2.5 text-sm font-semibold"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || message.trim().length < 10}
              className="btn-primary px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {isSubmitting ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}
