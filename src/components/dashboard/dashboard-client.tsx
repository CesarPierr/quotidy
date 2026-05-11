"use client";

import { useState } from "react";
import Link from "next/link";

import { HomeHeader } from "@/components/layout/home-header";
import { MoiFoyerSwitch } from "@/components/layout/moi-foyer-switch";
import { TaskWorkspaceClient } from "@/components/tasks/task-workspace-client";
import { UxEventTracker } from "@/components/shared/ux-event-tracker";
import { WeekKanban } from "@/components/tasks/week-kanban";
import type { MemberStat, RollingPeriod, ActivityEntry } from "@/components/dashboard/stats-drawer";

// ─── Serializable prop types ────────────────────────────────────────────────
// These mirror the data shapes that DashboardSurface used to compute from the
// server context.  The parent page now pre-computes them so this component
// stays fully client-side — no server-only imports.

type ViewMetrics = {
  headerName: string;
  scopeLabel: string;
  todayCount: number;
  overdueCount: number;
  weekDone: number;
  weekTotal: number;
};

type OccurrenceSlim = {
  id: string;
  scheduledDate: Date | string;
  status: string;
  notes: string | null;
  actualMinutes: number | null;
  assignedMemberId?: string | null;
  taskTemplateId?: string;
  isManuallyModified?: boolean;
  rescheduleCount?: number;
  taskTemplate: {
    title: string;
    category: string | null;
    room?: string | null;
    icon?: string | null;
    estimatedMinutes: number;
    color: string;
    isCollective?: boolean;
  };
  assignedMember: { id: string; displayName: string; color: string } | null;
  wasCompletedAlone?: boolean | null;
  updatedAt: Date | string;
  completedAt?: Date | string | null;
  completedByMemberId?: string | null;
};

export type DashboardClientProps = {
  householdId: string;
  householdName: string;
  manageable: boolean;
  currentMemberId: string | null;
  members: Array<{ id: string; displayName: string }>;
  /** Pre-computed metrics for the "moi" view */
  moiMetrics: ViewMetrics;
  /** Pre-computed metrics for the "foyer" view */
  foyerMetrics: ViewMetrics;
  /** Shared analytics */
  streak: number;
  memberStats: MemberStat[];
  rollingMetrics: RollingPeriod[];
  recentActivity: ActivityEntry[];
  /** All occurrences — the workspace shows everything */
  occurrences: OccurrenceSlim[];
  /** Week occurrences for the kanban */
  weekOccurrences: OccurrenceSlim[];
  /** Total completed count for the "support" CTA */
  completedCount: number;
  /** Initial view */
  initialView: "moi" | "foyer";
  autoStartSession?: boolean;
  dashboardMessage?: string | null;
};

export function DashboardClient({
  householdId,
  manageable,
  currentMemberId,
  members,
  moiMetrics,
  foyerMetrics,
  streak,
  memberStats,
  rollingMetrics,
  recentActivity,
  occurrences,
  weekOccurrences,
  completedCount,
  initialView,
  autoStartSession,
  dashboardMessage,
}: DashboardClientProps) {
  const [view, setView] = useState<"moi" | "foyer">(initialView);
  const isPersonal = view === "moi";
  const metrics = isPersonal ? moiMetrics : foyerMetrics;

  return (
    <div className="space-y-4">
      <UxEventTracker
        event="home.rendered"
        props={{
          householdId,
          todayCount: metrics.todayCount,
          overdueCount: metrics.overdueCount,
          weekTotal: metrics.weekTotal,
          view,
        }}
      />

      {dashboardMessage ? (
        <div className="app-surface rounded-[1.7rem] border border-[rgba(56,115,93,0.12)] px-4 py-3 text-sm leading-6 text-leaf-600">
          {dashboardMessage}
        </div>
      ) : null}

      <div className="flex justify-center sm:justify-start">
        <MoiFoyerSwitch active={view} onViewChange={setView} />
      </div>

      <HomeHeader
        firstName={metrics.headerName}
        scopeLabel={metrics.scopeLabel}
        todayCount={metrics.todayCount}
        overdueCount={metrics.overdueCount}
        weekDone={metrics.weekDone}
        weekTotal={metrics.weekTotal}
        streak={streak}
        memberStats={memberStats}
        rollingMetrics={rollingMetrics}
        recentActivity={recentActivity}
        householdId={householdId}
      />

      <TaskWorkspaceClient
        householdId={householdId}
        manageable={manageable}
        currentMemberId={currentMemberId}
        members={members}
        occurrences={occurrences}
        autoStartSession={autoStartSession}
        scope={isPersonal ? "mine" : "household"}
      />

      {completedCount >= 3 ? (
        <div className="rounded-[1.5rem] border border-line bg-white/60 px-4 py-3 text-sm text-ink-700 dark:bg-[#262830]/60">
          L&apos;app commence à vous servir ?{" "}
          <Link className="font-semibold text-coral-600 underline" href="/support">
            Soutenir le projet
          </Link>
          .
        </div>
      ) : null}

      <aside aria-label={isPersonal ? "Vue d'ensemble de la semaine" : "Vue d'ensemble du foyer"}>
        <details className="app-surface group rounded-[2rem] p-5 sm:p-6 [&[open]>summary>span.chev]:rotate-180">
          <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
            <div>
              <p className="section-kicker">Vue d&apos;ensemble</p>
              <h3 className="display-title mt-1 text-xl">
                {isPersonal ? "Ma semaine" : "La semaine du foyer"}
              </h3>
            </div>
            <span className="chev rounded-full border border-line bg-white/70 dark:bg-[#262830]/70 p-1.5 text-ink-500 transition-transform">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
            </span>
          </summary>
          <div className="mt-4">
            <WeekKanban
              occurrences={weekOccurrences}
              currentMemberId={isPersonal ? currentMemberId ?? undefined : undefined}
            />
          </div>
        </details>
      </aside>

      <footer className="pb-8 pt-4 text-center">
        <a
          href={`/app/history?household=${householdId}`}
          className="btn-quiet px-6 py-3 text-sm font-semibold inline-flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20v-6M9 20V10M15 20V4M3 20h18" /></svg>
          Voir tout le journal d&apos;activité
        </a>
      </footer>
    </div>
  );
}
