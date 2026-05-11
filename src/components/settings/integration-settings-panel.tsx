"use client";

import { useState, useTransition } from "react";
import { Bot, KeyRound, Link2, Power, RotateCcw } from "lucide-react";

import { CopyValueButton } from "@/components/shared/copy-value-button";
import type { OpenClawIntegrationSettingsSnapshot } from "@/lib/integrations/types";

type IntegrationSettingsPanelProps = {
  householdId: string;
  canManage: boolean;
  initialSettings: OpenClawIntegrationSettingsSnapshot;
};

type SaveResponse = {
  integration: OpenClawIntegrationSettingsSnapshot;
  apiKey?: string | null;
  error?: string;
};

export function IntegrationSettingsPanel({
  householdId,
  canManage,
  initialSettings,
}: IntegrationSettingsPanelProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [enabled, setEnabled] = useState(initialSettings.isEnabled);
  const [serverUrl, setServerUrl] = useState(initialSettings.serverUrl ?? "");
  const [clientLabel, setClientLabel] = useState(initialSettings.clientLabel ?? "OpenClaw local");
  const [freshApiKey, setFreshApiKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function saveSettings(regenerateKey: boolean) {
    setFeedback(null);

    const response = await fetch("/api/integrations/mcp/openclaw/settings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        householdId,
        isEnabled: enabled,
        serverUrl,
        clientLabel,
        regenerateKey,
      }),
    });

    const payload = (await response.json().catch(() => null)) as SaveResponse | null;

    if (!response.ok || !payload?.integration) {
      setFeedback("Impossible d’enregistrer cette intégration pour le moment.");
      return;
    }

    setSettings(payload.integration);
    setFreshApiKey(payload.apiKey ?? null);
    setFeedback(regenerateKey ? "Nouvelle clé générée." : "Paramètres enregistrés.");
  }

  async function disableIntegration() {
    setFeedback(null);

    const response = await fetch("/api/integrations/mcp/openclaw/settings", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        householdId,
      }),
    });

    const payload = (await response.json().catch(() => null)) as SaveResponse | null;

    if (!response.ok || !payload?.integration) {
      setFeedback("Impossible de désactiver l’intégration.");
      return;
    }

    setSettings(payload.integration);
    setEnabled(false);
    setFreshApiKey(null);
    setFeedback("Intégration désactivée.");
  }

  if (!canManage) {
    return (
      <section className="soft-panel compact-stack p-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[rgba(47,109,136,0.12)] text-sky-600">
            <Bot className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-950">MCP / OpenClaw</p>
            <p className="text-sm text-ink-700">Accès réservé aux gestionnaires du foyer.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="soft-panel compact-stack p-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[rgba(47,109,136,0.12)] text-sky-600">
          <Bot className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-950">MCP / OpenClaw</p>
          <p className="text-sm text-ink-700">
            Point d’entrée avancé pour IA locale, OpenClaw et serveur MCP plus tard.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label">
          <span className="field-help">Connexion</span>
          <button
            className={enabled ? "btn-primary justify-center px-4 py-2.5 text-sm" : "btn-secondary justify-center px-4 py-2.5 text-sm"}
            onClick={() => setEnabled((value) => !value)}
            type="button"
          >
            <Power className="size-4" />
            {enabled ? "Activée" : "Désactivée"}
          </button>
        </label>

        <label className="field-label">
          <span className="field-help">Client</span>
          <input
            className="field"
            maxLength={80}
            onChange={(event) => setClientLabel(event.currentTarget.value)}
            placeholder="OpenClaw local"
            type="text"
            value={clientLabel}
          />
        </label>
      </div>

      <label className="field-label">
        <span className="field-help">URL du serveur</span>
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" />
          <input
            className="field pl-10"
            inputMode="url"
            onChange={(event) => setServerUrl(event.currentTarget.value)}
            placeholder="http://127.0.0.1:8787"
            type="url"
            value={serverUrl}
          />
        </div>
      </label>

      <div className="rounded-2xl border border-line bg-white/70 dark:bg-[#262830]/70 p-3 text-sm text-ink-700">
        <p className="font-medium text-ink-950">Clé locale</p>
        <p className="mt-1">
          {settings.hasApiKey ? `Clé active: ${settings.apiKeyPreview ?? "masquée"}` : "Aucune clé générée pour le moment."}
        </p>
        <p className="mt-1 text-xs text-ink-500">
          Les outils externes peuvent utiliser <code>x-quotidy-key</code> et <code>x-quotidy-household</code> (les anciens en-têtes <code>x-quotidy-*</code> restent acceptés).
        </p>
      </div>

      {freshApiKey ? (
        <div className="compact-stack rounded-2xl border border-[rgba(56,115,93,0.18)] bg-[rgba(56,115,93,0.08)] p-3">
          <p className="text-sm font-medium text-ink-950">Nouvelle clé générée</p>
          <CopyValueButton
            className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
            label="Copier la clé"
            value={freshApiKey}
          />
        </div>
      ) : null}

      {feedback ? <p className="text-sm text-ink-700">{feedback}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary px-4 py-2.5 text-sm"
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              void saveSettings(false);
            })
          }
          type="button"
        >
          Enregistrer
        </button>
        <button
          className="btn-secondary px-4 py-2.5 text-sm"
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              void saveSettings(true);
            })
          }
          type="button"
        >
          <KeyRound className="size-4" />
          Générer une clé
        </button>
        <button
          className="btn-secondary px-4 py-2.5 text-sm"
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              void disableIntegration();
            })
          }
          type="button"
        >
          <RotateCcw className="size-4" />
          Désactiver
        </button>
      </div>
    </section>
  );
}
