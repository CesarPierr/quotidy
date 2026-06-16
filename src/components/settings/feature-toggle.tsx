"use client";

import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";

type FeatureToggleProps = {
  /** POST endpoint that accepts the feature key as a form field. */
  endpoint: string;
  /** The form-field name the endpoint reads (e.g. "savingsEnabled"). */
  fieldName: string;
  /** Initial state from the server. */
  defaultEnabled: boolean;
  /** Visible label for the toggle. */
  label: string;
  /** Helper text shown under the label. */
  description?: string;
  /** Optional success / error toast strings. */
  enabledToast?: string;
  disabledToast?: string;
};

// iOS-style switch row that auto-saves on change. Uses fetch + CSRF cookie so
// the rest of the page (a server component) doesn't need to round-trip through
// a form submission. Optimistic UI: flip immediately, revert on error.
export function FeatureToggle({
  endpoint,
  fieldName,
  defaultEnabled,
  label,
  description,
  enabledToast,
  disabledToast,
}: FeatureToggleProps) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [isPending, startTransition] = useTransition();
  const { success, error: showError } = useToast();

  function toggle(next: boolean) {
    if (isPending) return;
    const previous = enabled;
    setEnabled(next);

    startTransition(async () => {
      try {
        const csrfMatch = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/);
        const headers: HeadersInit = {
          "x-requested-with": "fetch",
          ...(csrfMatch?.[1] ? { "x-csrf-token": csrfMatch[1] } : {}),
        };
        const formData = new FormData();
        formData.set(fieldName, next ? "true" : "false");
        const res = await fetch(endpoint, { method: "POST", body: formData, headers });
        if (!res.ok) throw new Error(`status ${res.status}`);

        const message = next ? enabledToast : disabledToast;
        if (message) success(message);
      } catch {
        setEnabled(previous);
        showError("Impossible d'enregistrer la préférence.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-line bg-white/70 px-4 py-3.5 dark:bg-surface/70">
      <div className="min-w-0">
        <p className="font-semibold text-ink-950">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-5 text-ink-500">{description}</p>
        ) : null}
      </div>

      <button
        aria-pressed={enabled}
        aria-label={`${label} — ${enabled ? "activé" : "désactivé"}`}
        disabled={isPending}
        onClick={() => toggle(!enabled)}
        type="button"
        className={
          "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 disabled:cursor-wait " +
          (enabled
            ? "border-coral-500 bg-coral-500"
            : "border-line bg-[var(--ink-200,#e5e5e5)]")
        }
      >
        <span
          aria-hidden="true"
          className={
            "inline-block size-5 rounded-full bg-white shadow transition-transform duration-150 " +
            (enabled ? "translate-x-6" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}
