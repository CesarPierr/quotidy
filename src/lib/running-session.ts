/**
 * Helpers + types for the workspace "running session" persisted in localStorage.
 * Extracted from task-workspace-client to keep the component focused on UI.
 */

export const RUNNING_SESSION_ACTIVE_STATUSES = new Set([
  "planned",
  "due",
  "overdue",
  "rescheduled",
]);

export type RunningSession = {
  room: string;
  occurrenceIds: string[];
  currentIndex: number;
  status: "running" | "paused";
  startedAt: number | null;
  elapsedMs: number;
  /** "optimized" sessions pull tasks across multiple days into a single sequence;
   *  they share the same auto-realign behavior as any completion (always-on). */
  mode?: "room" | "optimized";
  horizonDays?: number;
};

type RunningSessionOccurrenceLike = {
  id: string;
  status: string;
};

// Internal localStorage key — kept under the legacy "quotidy:" namespace on purpose so
// that users with an in-flight running session don't lose it through the Hearthly rebrand.
// This string is never exposed in UI; renaming it would silently drop active sessions.
export function getRunningSessionStorageKey(
  householdId: string,
  currentMemberId?: string | null,
) {
  return `quotidy:running-session:${householdId}:${currentMemberId ?? "shared"}`;
}

/** React event timeStamps are relative to performance.timeOrigin; convert to wall-clock. */
export function getEventTimeMs(eventTimeStamp: number) {
  return Math.round(performance.timeOrigin + eventTimeStamp);
}

export function parseStoredRunningSession(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as RunningSession;
  } catch {
    return null;
  }
}

/**
 * Drop occurrences that are no longer active (cancelled/completed/skipped) from
 * the running session. Returns null if nothing remains.
 */
export function sanitizeRunningSession<T extends RunningSessionOccurrenceLike>(
  session: RunningSession | null,
  occurrenceById: Record<string, T>,
) {
  if (!session) {
    return null;
  }

  const validOccurrenceIds = session.occurrenceIds.filter((occurrenceId) => {
    const occurrence = occurrenceById[occurrenceId];
    return occurrence ? RUNNING_SESSION_ACTIVE_STATUSES.has(occurrence.status) : false;
  });

  if (!validOccurrenceIds.length) {
    return null;
  }

  return {
    ...session,
    occurrenceIds: validOccurrenceIds,
    currentIndex: Math.min(session.currentIndex, validOccurrenceIds.length - 1),
    elapsedMs: Math.max(0, session.elapsedMs),
    startedAt: session.startedAt ? Math.max(0, session.startedAt) : null,
  };
}
