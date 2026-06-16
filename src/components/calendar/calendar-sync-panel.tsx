"use client";

import { ExternalLink } from "lucide-react";

import { CopyValueButton } from "@/components/shared/copy-value-button";

type CalendarSyncPanelProps = {
  householdFeedUrl: string;
  personalFeedUrl?: string | null;
};

export function CalendarSyncPanel({
  householdFeedUrl,
  personalFeedUrl,
}: CalendarSyncPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-ink-950">Lien direct vers Google Calendar</p>
          <p className="text-xs text-ink-700">Ajoutez l&apos;URL iCal copiée ci-dessous dans l&apos;interface de Google.</p>
        </div>
        <a
          className="btn-secondary flex items-center justify-center gap-2 rounded-full border-2 border-ink-950/5 bg-white dark:bg-surface px-5 py-2.5 text-sm font-bold shadow-sm transition-all hover:border-ink-950/10 hover:shadow-md active:scale-95"
          href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
          rel="noreferrer"
          target="_blank"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#4285F4"/>
            <path d="M16.5 12h-9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 7.5v9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Ouvrir Google Calendar
          <ExternalLink className="size-3.5 opacity-50" />
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="soft-panel flex flex-col justify-between p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Agenda du foyer</p>
            <p className="mt-1 text-sm text-ink-700">Toutes les tâches prévues pour tout le monde.</p>
          </div>
          <div className="mt-4">
            <CopyValueButton label="Copier l’URL" value={householdFeedUrl} />
          </div>
        </div>
        {personalFeedUrl ? (
          <div className="soft-panel flex flex-col justify-between p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Mon agenda</p>
              <p className="mt-1 text-sm text-ink-700">Uniquement les tâches qui vous sont attribuées.</p>
            </div>
            <div className="mt-4">
              <CopyValueButton label="Copier l’URL" value={personalFeedUrl} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl bg-[var(--sky-50)] p-4">
        <p className="text-xs leading-relaxed text-[var(--sky-700)]">
          <strong>Astuce :</strong> Dans Google Calendar, cliquez sur le petit &quot;+&quot; à côté de &quot;Autres agendas&quot;, puis choisissez &quot;À partir de l&apos;URL&quot; et collez le lien copié.
        </p>
      </div>
    </div>
  );
}
