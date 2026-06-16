"use client";

import { useState } from "react";
import { CloudSync, Download, Globe, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarSyncPanel } from "./calendar-sync-panel";

type CalendarSidebarProps = {
  householdFeedUrl: string;
  personalFeedUrl?: string | null;
  householdId: string;
};

export function CalendarSidebar({ householdFeedUrl, personalFeedUrl, householdId }: CalendarSidebarProps) {
  const [activeTab, setActiveTab] = useState<"sync" | "export" | null>(null);

  const toggleTab = (tab: "sync" | "export") => {
    setActiveTab(activeTab === tab ? null : tab);
  };

  return (
    <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
      <div className="app-surface rounded-[2rem] p-5">
        <p className="section-kicker">Raccourcis</p>
        <h3 className="display-title mt-2 text-2xl">Partager le planning</h3>
        <p className="mt-3 text-sm leading-6 text-ink-700">
          Synchronisez votre agenda ou exportez le foyer sans chercher les bons liens dans plusieurs écrans.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => toggleTab("sync")}
          className={cn(
            "flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-6 transition-all duration-300 group",
            activeTab === "sync"
              ? "bg-ink-950 text-white border-ink-950 shadow-xl shadow-black/10 scale-[1.02]"
              : "bg-white dark:bg-surface border-line text-ink-700 hover:border-ink-300 hover:bg-[var(--ink-50)]"
          )}
        >
          <div className={cn(
            "flex size-12 items-center justify-center rounded-full transition-colors",
            activeTab === "sync" ? "bg-white/10 dark:bg-surface/10" : "bg-[var(--ink-50)] group-hover:bg-white dark:bg-surface"
          )}>
            <CloudSync className="size-6" />
          </div>
          <span className="text-sm font-bold">Synchroniser</span>
        </button>

        <button
          onClick={() => toggleTab("export")}
          className={cn(
            "flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-6 transition-all duration-300 group",
            activeTab === "export"
              ? "bg-ink-950 text-white border-ink-950 shadow-xl shadow-black/10 scale-[1.02]"
              : "bg-white dark:bg-surface border-line text-ink-700 hover:border-ink-300 hover:bg-[var(--ink-50)]"
          )}
        >
          <div className={cn(
            "flex size-12 items-center justify-center rounded-full transition-colors",
            activeTab === "export" ? "bg-white/10 dark:bg-surface/10" : "bg-[var(--ink-50)] group-hover:bg-white dark:bg-surface"
          )}>
            <Download className="size-6" />
          </div>
          <span className="text-sm font-bold">Exporter</span>
        </button>
      </div>

      <div className="relative">
        {activeTab === "sync" && (
          <div className="app-surface rounded-[2rem] p-6 animate-in fade-in zoom-in-95 duration-300 origin-top">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink-950">
                <CloudSync className="size-5" />
                <h3 className="font-bold">Abonnement iCal</h3>
              </div>
              <button onClick={() => setActiveTab(null)} className="text-xs font-bold text-ink-500 hover:text-ink-950">Fermer</button>
            </div>
            <CalendarSyncPanel
              householdFeedUrl={householdFeedUrl}
              personalFeedUrl={personalFeedUrl}
            />
          </div>
        )}

        {activeTab === "export" && (
          <div className="app-surface rounded-[2rem] p-6 animate-in fade-in zoom-in-95 duration-300 origin-top">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink-950">
                <Download className="size-5" />
                <h3 className="font-bold">Télécharger</h3>
              </div>
              <button onClick={() => setActiveTab(null)} className="text-xs font-bold text-ink-500 hover:text-ink-950">Fermer</button>
            </div>
            <div className="grid gap-3">
              <a
                className="btn-secondary flex items-center justify-between gap-3 px-5 py-4 text-sm font-bold transition-all hover:bg-ink-950 hover:text-white"
                href={`/api/calendar/feed.ics?household=${householdId}`}
              >
                <span>Export complet foyer</span>
                <Share2 className="size-4 opacity-50" />
              </a>
              {personalFeedUrl ? (
                <a
                  className="btn-secondary flex items-center justify-between gap-3 px-5 py-4 text-sm font-bold transition-all hover:bg-ink-950 hover:text-white"
                  href={`/api/calendar/member/${personalFeedUrl.split("/")[6]}/feed.ics?household=${householdId}`}
                >
                  <span>Export personnel</span>
                  <Globe className="size-4 opacity-50" />
                </a>
              ) : null}
            </div>
            <p className="mt-4 text-center text-xs text-ink-500">
              Fichier .ics compatible Google, Apple & Outlook
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
