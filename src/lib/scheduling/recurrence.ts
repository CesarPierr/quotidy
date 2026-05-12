import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  format,
  getDate,
  getDay,
  isAfter,
  isBefore,
  isEqual,
  setDate,
  startOfDay,
} from "date-fns";

import type { RecurrenceRuleInput } from "@/lib/scheduling/types";

function isSingleRunConfig(config: unknown) {
  return Boolean(
    config &&
      typeof config === "object" &&
      !Array.isArray(config) &&
      "singleRun" in config &&
      (config as { singleRun?: unknown }).singleRun === true,
  );
}

function normalize(date: Date) {
  return startOfDay(date);
}

function sameDay(left: Date, right: Date) {
  return isEqual(normalize(left), normalize(right));
}

export function describeRecurrence(rule: RecurrenceRuleInput) {
  if (isSingleRunConfig(rule.config)) {
    return "Une seule fois";
  }

  switch (rule.type) {
    case "daily":
      return "Tous les jours";
    case "every_x_days":
      return `Tous les ${rule.interval} jours`;
    case "weekly":
      return rule.weekdays?.length
        ? `Chaque semaine, jours ${rule.weekdays.join(", ")}`
        : "Chaque semaine";
    case "every_x_weeks":
      return `Toutes les ${rule.interval} semaines`;
    case "monthly_simple":
      return `Chaque mois le ${rule.dayOfMonth ?? getDate(rule.anchorDate)}`;
  }
}

export function generateRecurrenceDates(
  rule: RecurrenceRuleInput,
  rangeStart: Date,
  rangeEnd: Date,
  options?: { baseDate?: Date; baseIndex?: number },
) {
  const isSliding = rule.mode === "SLIDING";
  const anchor = normalize(options?.baseDate ?? rule.anchorDate);
  const start = normalize(rangeStart);
  const end = normalize(rangeEnd);
  const dates: Date[] = [];

  if (isAfter(start, end)) {
    return dates;
  }

  if (rule.type === "daily" || rule.type === "every_x_days") {
    const interval = Math.max(1, rule.interval || 1);
    let cursor = anchor;

    // For sliding tasks, if the anchor (base) is already what we want to generate from,
    // we start from the NEXT interval if the anchor itself is in the past or already handled.
    // But usually generateRecurrenceDates is expected to include the anchor if it's in range.
    if (isSliding && options?.baseDate) {
      cursor = addDays(anchor, interval);
    }

    while (isBefore(cursor, start)) {
      cursor = addDays(cursor, interval);
    }

    while (!isAfter(cursor, end)) {
      dates.push(cursor);
      cursor = addDays(cursor, interval);
    }

    return dates;
  }

  if (rule.type === "weekly") {
    const weekdays = (rule.weekdays?.length ? rule.weekdays : [getDay(anchor)]).sort();
    const interval = Math.max(1, rule.interval || 1);
    let cursor = start;

    if (isSliding && options?.baseDate) {
      // In sliding mode, we must at least move past the current occurrence.
      // We start looking for the next weekday from tomorrow.
      cursor = addDays(anchor, 1);
    }

    while (!isAfter(cursor, end)) {
      if (!isBefore(cursor, anchor) && weekdays.includes(getDay(cursor))) {
        // In sliding mode, we skip the base day itself
        if (!(isSliding && options?.baseDate && sameDay(cursor, anchor))) {
          dates.push(cursor);
        }
      }

      cursor = addDays(cursor, 1);
    }

    return dates;
  }

  if (rule.type === "every_x_weeks") {
    const weekday = getDay(anchor);
    const interval = Math.max(1, rule.interval || 1);
    let cursor = anchor;

    if (isSliding && options?.baseDate) {
      cursor = addWeeks(anchor, interval);
    }

    while (isBefore(cursor, start)) {
      cursor = addWeeks(cursor, interval);
    }

    while (!isAfter(cursor, end)) {
      if (getDay(cursor) === weekday) {
        dates.push(cursor);
      }
      cursor = addWeeks(cursor, interval);
    }

    return dates;
  }

  // monthly_simple
  const interval = Math.max(1, rule.interval || 1);
  const targetDay = rule.dayOfMonth ?? getDate(anchor);
  let cursor = new Date(anchor.getFullYear(), anchor.getMonth(), 1);

  if (isSliding && options?.baseDate) {
    cursor = addMonths(cursor, interval);
  }

  while (isBefore(endOfDay(cursor), start)) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + interval, 1);
  }

  while (!isAfter(cursor, end)) {
    const candidate = setDate(
      new Date(cursor),
      Math.min(targetDay, new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()),
    );

    if (!isBefore(candidate, anchor) && !isBefore(candidate, start) && !isAfter(candidate, end)) {
      if (!(isSliding && options?.baseDate && sameDay(candidate, anchor))) {
        dates.push(startOfDay(candidate));
      }
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + interval, 1);
  }

  return dates;
}

export function computeDueDate(scheduledDate: Date, offsetDays = 0) {
  return endOfDay(addDays(startOfDay(scheduledDate), offsetDays));
}

export function buildGenerationKey(
  taskTemplateId: string,
  date: Date,
  mode: "FIXED" | "SLIDING" = "FIXED",
  index?: number,
) {
  if (mode === "SLIDING" && index !== undefined) {
    return `${taskTemplateId}:sliding:${index}`;
  }
  return `${taskTemplateId}:${format(date, "yyyy-MM-dd")}`;
}

/**
 * Calculates a stable sequence index for a given date relative to the anchor.
 * This ensures that strict alternation and rotation remain consistent even
 * as the generation window slides forward.
 */
export function getStableSequenceIndex(
  rule: RecurrenceRuleInput,
  targetDate: Date,
  options?: { baseDate?: Date; baseIndex?: number },
): number {
  const target = normalize(targetDate);
  const anchor = normalize(options?.baseDate ?? rule.anchorDate);
  const baseIndex = options?.baseIndex ?? 0;
  const interval = Math.max(1, rule.interval || 1);

  if (isBefore(target, anchor)) {
    return baseIndex;
  }

  if (rule.type === "daily" || rule.type === "every_x_days") {
    const diffMs = target.getTime() - anchor.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return baseIndex + Math.floor(diffDays / interval);
  }

  if (rule.type === "every_x_weeks") {
    const diffMs = target.getTime() - anchor.getTime();
    const diffWeeks = Math.round(diffMs / (1000 * 60 * 60 * 24 * 7));
    return baseIndex + Math.floor(diffWeeks / interval);
  }

  if (rule.type === "weekly") {
    const weekdays = (rule.weekdays?.length ? rule.weekdays : [getDay(anchor)]).sort();
    let count = 0;
    let cursor = anchor;
    // Count valid weekdays between anchor and target
    while (isBefore(cursor, target)) {
      if (weekdays.includes(getDay(cursor))) {
        count++;
      }
      cursor = addDays(cursor, 1);
    }
    return baseIndex + count;
  }

  if (rule.type === "monthly_simple") {
    const targetMonthCount = target.getFullYear() * 12 + target.getMonth();
    const anchorMonthCount = anchor.getFullYear() * 12 + anchor.getMonth();
    const diffMonths = targetMonthCount - anchorMonthCount;
    return baseIndex + Math.floor(diffMonths / interval);
  }

  return baseIndex;
}

export function isLogicalOccurrenceDate(rule: RecurrenceRuleInput, date: Date) {
  return generateRecurrenceDates(rule, date, date).some((candidate) => sameDay(candidate, date));
}

/**
 * Compute the next valid recurrence date strictly after `fromDate`. Used when shifting
 * future occurrences after an early or late completion: setting `anchorDate` to this
 * value makes the generator emit the next occurrence at `fromDate + interval` instead
 * of at `fromDate` itself (which would create a duplicate "today" occurrence).
 */
export function computeNextAnchorAfter(rule: RecurrenceRuleInput, fromDate: Date): Date {
  const from = startOfDay(fromDate);
  const interval = Math.max(1, rule.interval || 1);

  if (rule.type === "daily") {
    return addDays(from, 1);
  }

  if (rule.type === "every_x_days") {
    return addDays(from, interval);
  }

  if (rule.type === "weekly") {
    const weekdays = (rule.weekdays?.length ? rule.weekdays : [getDay(rule.anchorDate)])
      .slice()
      .sort((a, b) => a - b);
    let cursor = addDays(from, 1);
    // Bound: at most 14 days to find the next matching weekday
    for (let i = 0; i < 14; i++) {
      if (weekdays.includes(getDay(cursor))) {
        return cursor;
      }
      cursor = addDays(cursor, 1);
    }
    return cursor;
  }

  if (rule.type === "every_x_weeks") {
    return addDays(from, 7 * interval);
  }

  // monthly_simple
  const dayOfMonth = rule.dayOfMonth ?? getDate(rule.anchorDate);
  const candidateThisMonth = setDate(from, dayOfMonth);
  if (isAfter(candidateThisMonth, from)) {
    return startOfDay(candidateThisMonth);
  }
  const nextMonth = addMonths(from, interval);
  const lastDayOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  return startOfDay(setDate(nextMonth, Math.min(dayOfMonth, lastDayOfNextMonth)));
}
