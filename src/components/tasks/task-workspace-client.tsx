"use client";

import { addDays, isSameDay, startOfDay } from "date-fns";
import Link from "next/link";
import { CircleCheckBig, ListPlus, SearchX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FocusSession } from "@/components/dashboard/focus-session";
import { OccurrenceCard } from "@/components/tasks/occurrence-card";
import { TaskWorkspaceFilters } from "@/components/tasks/task-workspace-filters";
import { TaskWorkspaceOptimizedPicker } from "@/components/tasks/task-workspace-optimized-picker";
import { useToast } from "@/components/ui/toast";
import { groupOccurrencesByRoom } from "@/lib/experience";
import { RUNNING_SESSION_ACTIVE_STATUSES as ACTIVE_STATUSES } from "@/lib/running-session";
import { useRunningSession } from "@/lib/use-running-session";

type WorkspaceOccurrence = {
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
};

type TaskWorkspaceClientProps = {
  householdId: string;
  currentMemberId?: string | null;
  manageable: boolean;
  members: { id: string; displayName: string }[];
  occurrences: WorkspaceOccurrence[];
  autoStartSession?: boolean;
  /**
   * Defines the scope of tasks to show. Now fully controlled by the parent dashboard.
   */
  scope: "mine" | "household";
};

export function TaskWorkspaceClient({
  householdId,
  currentMemberId,
  manageable,
  members,
  occurrences,
  autoStartSession,
  scope,
}: TaskWorkspaceClientProps) {
  const { success, error: showError } = useToast();
  const effectiveScope = scope;
  const [search, setSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [filterType, setFilterType] = useState<"active" | "history">("active");
  const [showOptimizedPicker, setShowOptimizedPicker] = useState(false);
  const [horizon, setHorizon] = useState<3 | 7 | 30>(3);
  const dashboardPath = `/app?household=${householdId}`;

  const normalizedOccurrences = useMemo(
    () =>
      occurrences.map((occurrence) => ({
        ...occurrence,
        scheduledDate: new Date(occurrence.scheduledDate),
        updatedAt: new Date(occurrence.updatedAt),
        completedAt: occurrence.completedAt ? new Date(occurrence.completedAt) : null,
      })),
    [occurrences],
  );

  const today = startOfDay(new Date());
  const baseOccurrences =
    effectiveScope === "mine" && currentMemberId
      ? normalizedOccurrences.filter((occurrence) => occurrence.assignedMemberId === currentMemberId)
      : normalizedOccurrences;

  const filteredActiveOccurrences = baseOccurrences.filter((occurrence) => {
    const isActive = ACTIVE_STATUSES.has(occurrence.status);
    const isDone = occurrence.status === "completed" || occurrence.status === "skipped";
    
    if (filterType === "active" && !isActive) return false;
    if (filterType === "history" && !isDone) return false;
    
    if (roomFilter !== "all" && (occurrence.taskTemplate.room?.trim() || "Tout l'appartement") !== roomFilter) return false;
    if (assigneeFilter !== "all" && occurrence.assignedMemberId !== assigneeFilter) return false;
    if (overdueOnly && occurrence.status !== "overdue") return false;

    const haystack = [
      occurrence.taskTemplate.title,
      occurrence.taskTemplate.room ?? "",
      occurrence.taskTemplate.category ?? "",
      occurrence.assignedMember?.displayName ?? "",
      occurrence.status === "completed" ? "terminée fait" : "",
      occurrence.status === "skipped" ? "sautée" : "",
      occurrence.status === "cancelled" ? "annulée" : "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search.trim().toLowerCase());
  });

  const sortedFiltered = useMemo(() => {
    return [...filteredActiveOccurrences].sort((left, right) => {
      if (filterType === "active") {
        // Sort by status priority: overdue first, then by date
        if (left.status === "overdue" && right.status !== "overdue") return -1;
        if (left.status !== "overdue" && right.status === "overdue") return 1;

        if (left.scheduledDate.getTime() !== right.scheduledDate.getTime()) {
          return left.scheduledDate.getTime() - right.scheduledDate.getTime();
        }
      } else {
        // History: Most recent first
        if (left.scheduledDate.getTime() !== right.scheduledDate.getTime()) {
          return right.scheduledDate.getTime() - left.scheduledDate.getTime();
        }
      }

      return left.taskTemplate.title.localeCompare(right.taskTemplate.title, "fr");
    });
  }, [filteredActiveOccurrences, filterType]);

  const timelineGroups = useMemo(() => {
    const groups: { label: string; date?: Date; occurrences: WorkspaceOccurrence[] }[] = [];
    
    const overdue = sortedFiltered.filter(o => o.status === "overdue" && startOfDay(o.scheduledDate) < today);
    if (overdue.length > 0) {
      groups.push({ label: "En retard", occurrences: overdue });
    }

    const others = sortedFiltered.filter(o => !(o.status === "overdue" && startOfDay(o.scheduledDate) < today));
    
    const dayMap = new Map<string, WorkspaceOccurrence[]>();
    others.forEach(o => {
      const key = startOfDay(o.scheduledDate).toISOString();
      if (!dayMap.has(key)) dayMap.set(key, []);
      dayMap.get(key)!.push(o);
    });

    const sortedDays = [...dayMap.keys()].sort();
    if (filterType === "history") sortedDays.reverse();
    
    sortedDays.forEach(key => {
      const date = new Date(key);
      const occurrences = dayMap.get(key)!;
      
      // Filter by horizon
      const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= horizon && filterType === "active" && !search) return;

      let label = "";
      
      if (isSameDay(date, today)) label = "Aujourd'hui";
      else if (isSameDay(date, addDays(today, 1))) label = "Demain";
      else if (date < addDays(today, 7)) {
        label = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric" }).format(date);
      } else {
        label = new Intl.DateTimeFormat("fr-FR", { month: "long", day: "numeric" }).format(date);
      }

      const existing = groups.find(g => g.label === label);
      if (existing) {
        existing.occurrences.push(...occurrences);
      } else {
        groups.push({ label, date, occurrences });
      }
    });

    return groups;
  }, [sortedFiltered, today, horizon, filterType, search]);

  const busiestNowRoom = useMemo(() => {
    const now = sortedFiltered.filter(o => startOfDay(o.scheduledDate).getTime() <= today.getTime() && ACTIVE_STATUSES.has(o.status));
    const groups = groupOccurrencesByRoom(now);
    return groups.sort((a, b) => {
      const aOverdue = a.occurrences.filter((o) => o.status === "overdue").length;
      const bOverdue = b.occurrences.filter((o) => o.status === "overdue").length;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      return b.occurrences.length - a.occurrences.length;
    })[0] ?? null;
  }, [sortedFiltered, today]);

  const rooms = useMemo(
    () =>
      [...new Set(
        normalizedOccurrences
          .filter((occurrence) => ACTIVE_STATUSES.has(occurrence.status))
          .map((occurrence) => occurrence.taskTemplate.room?.trim() || "Tout l'appartement"),
      )].sort((left, right) => left.localeCompare(right, "fr")),
    [normalizedOccurrences],
  );

  const occurrenceById = useMemo(
    () =>
      Object.fromEntries(
        normalizedOccurrences.map((occurrence) => [occurrence.id, occurrence] as const),
      ),
    [normalizedOccurrences],
  );

  const {
    activeRunningSession,
    currentRunningOccurrence,
    sessionNextOccurrence,
    effectiveElapsedMs,
    isSubmitting,
    startSession,
    stopSession,
    pauseOrResumeSession,
    finishCurrentRunningTask,
    skipCurrentRunningTask,
  } = useRunningSession({
    householdId,
    currentMemberId,
    occurrenceById,
    dashboardPath,
  });

  function startRoomSession(room: string, roomOccurrences: WorkspaceOccurrence[], startedAt: number) {
    startSession({
      room,
      occurrenceIds: roomOccurrences.map((occurrence) => occurrence.id),
      startedAt,
      mode: "room",
    });
    success(`Session lancée pour ${room}.`);
  }

  function startOptimizedSession(horizonDays: number, startedAt: number) {
    const cutoff = addDays(today, horizonDays);
    const occs = filteredActiveOccurrences
      .filter((o) => startOfDay(o.scheduledDate).getTime() < cutoff.getTime())
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

    if (occs.length === 0) {
      showError("Aucune tâche à planifier dans cette plage.");
      return;
    }

    startSession({
      room: `Plan optimisé · ${horizonDays} jour${horizonDays > 1 ? "s" : ""}`,
      occurrenceIds: occs.map((o) => o.id),
      startedAt,
      mode: "optimized",
      horizonDays,
    });
    setShowOptimizedPicker(false);
    success(
      `Mode optimisé · ${occs.length} tâche${occs.length > 1 ? "s" : ""} sur ${horizonDays} jour${horizonDays > 1 ? "s" : ""}.`,
    );
  }

  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStartSession || autoStartedRef.current || activeRunningSession || !busiestNowRoom) {
      return;
    }
    autoStartedRef.current = true;
    startRoomSession(busiestNowRoom.room, busiestNowRoom.occurrences, Date.now());
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("start");
      window.history.replaceState(null, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartSession, activeRunningSession, busiestNowRoom]);

  return (
    <div className="space-y-4">
      {activeRunningSession && currentRunningOccurrence ? (
        <FocusSession
          room={activeRunningSession.room}
          status={activeRunningSession.status}
          currentIndex={activeRunningSession.currentIndex}
          totalCount={activeRunningSession.occurrenceIds.length}
          currentOccurrence={currentRunningOccurrence}
          nextOccurrence={sessionNextOccurrence}
          elapsedMs={effectiveElapsedMs}
          isSubmitting={isSubmitting}
          onPauseOrResume={pauseOrResumeSession}
          onFinishWithTimer={finishCurrentRunningTask}
          onSkip={skipCurrentRunningTask}
          onStop={stopSession}
        />
      ) : null}

      <TaskWorkspaceFilters
        search={search}
        setSearch={setSearch}
        roomFilter={roomFilter}
        setRoomFilter={setRoomFilter}
        assigneeFilter={assigneeFilter}
        setAssigneeFilter={setAssigneeFilter}
        overdueOnly={overdueOnly}
        setOverdueOnly={setOverdueOnly}
        filterType={filterType}
        setFilterType={setFilterType}
        scope={effectiveScope}
        rooms={rooms}
        members={members}
        activeRunningSession={Boolean(activeRunningSession)}
        setShowOptimizedPicker={setShowOptimizedPicker}
        householdId={householdId}
        filteredCount={filteredActiveOccurrences.length}
      />

      <section className="app-surface rounded-[1.6rem] p-3.5 pt-0 sm:rounded-[2rem] sm:p-6 sm:pt-0">
        <div className="mt-4 space-y-5 sm:mt-6 sm:space-y-8">
          {timelineGroups.length > 0 ? (
            timelineGroups.map((group) => (
              <div key={group.label} className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h4 className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-ink-500 sm:text-xs sm:tracking-[0.2em]">
                    {group.label}
                  </h4>
                  <div className="h-px flex-1 bg-line" />
                </div>
                
                <div className="grid gap-3">
                  {group.occurrences.map((occurrence) => (
                    <OccurrenceCard
                      key={occurrence.id}
                      compact={!isSameDay(occurrence.scheduledDate, today) && occurrence.status !== "overdue"}
                      occurrence={occurrence}
                      members={members}
                      currentMemberId={currentMemberId}
                      returnTo={dashboardPath}
                      householdId={householdId}
                      canEditTemplate={manageable}
                      taskTemplateId={occurrence.taskTemplateId}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.3rem] border border-line bg-glass-bg p-5 text-center text-sm text-ink-700 sm:rounded-[1.6rem] sm:p-8">
              {search ? (
                <SearchX className="mx-auto size-7 text-coral-500" aria-hidden="true" />
              ) : (
                <CircleCheckBig className="mx-auto size-7 text-leaf-600" aria-hidden="true" />
              )}
              <h4 className="mt-3 text-base font-bold text-ink-950">
                {search ? "Aucune tâche trouvée" : "Rien à faire maintenant"}
              </h4>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6">
                {search
                  ? "Essayez un autre mot-clé ou retirez les filtres actifs."
                  : "La vue est à jour. Vous pouvez créer une routine si quelque chose manque."}
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full border border-line bg-white/70 px-4 text-xs font-bold text-coral-600 hover:bg-white dark:bg-[#262830]/70"
                  type="button"
                >
                  Réinitialiser la recherche
                </button>
              )}
              {!search && manageable ? (
                <Link
                  className="btn-secondary mt-4 inline-flex min-h-10 items-center justify-center gap-2 px-4 text-xs font-bold"
                  href={`/app/settings/tasks?household=${householdId}&tab=wizard`}
                >
                  <ListPlus className="size-4" aria-hidden="true" />
                  Ajouter une routine
                </Link>
              ) : null}
            </div>
          )}
        </div>

        {filterType === "active" && !search && (
          <div className="mt-5 flex flex-col items-center gap-3 border-t border-line pt-5 sm:mt-8 sm:pt-8">
            <div className="flex gap-2">
              {horizon === 3 && (
                <button
                  onClick={() => setHorizon(7)}
                  className="rounded-full border border-line bg-glass-bg px-4 py-2 text-xs font-bold text-ink-700 shadow-sm transition-all active:scale-95 hover:bg-sand-100 sm:px-6 sm:py-2.5 sm:hover:scale-105"
                >
                  Étendre à la semaine
                </button>
              )}
              {horizon === 7 && (
                <button
                  onClick={() => setHorizon(30)}
                  className="rounded-full bg-[var(--ink-50)] px-4 py-2 text-xs font-bold text-ink-700 shadow-sm transition-all active:scale-95 hover:bg-[var(--ink-100)] sm:px-6 sm:py-2.5 sm:hover:scale-105"
                >
                  Étendre au mois
                </button>
              )}
              {horizon > 3 && (
                <button
                  onClick={() => setHorizon(3)}
                  className="rounded-full bg-[var(--ink-50)] px-4 py-2 text-xs font-bold text-ink-400 transition-all hover:bg-[var(--ink-100)] hover:text-[var(--ink-600)] sm:px-6 sm:py-2.5"
                >
                  Réduire
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <TaskWorkspaceOptimizedPicker
        isOpen={showOptimizedPicker}
        onClose={() => setShowOptimizedPicker(false)}
        filteredActiveOccurrences={filteredActiveOccurrences}
        today={today}
        onStartSession={startOptimizedSession}
      />
    </div>
  );
}
