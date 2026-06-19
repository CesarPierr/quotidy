import "server-only";

import { Prisma } from "@prisma/client";
import { addDays, endOfDay, endOfMonth, format, startOfDay, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

import { db } from "@/lib/db";

export type BudgetPeriod = "monthly" | "weekly";

export function normalizePeriod(value: string | null | undefined): BudgetPeriod {
  return value === "weekly" ? "weekly" : "monthly";
}

const dec = (d: Prisma.Decimal | null | undefined): number => (d ? Number(d) : 0);

export type SerializedIncome = {
  id: string;
  label: string;
  amount: number;
  sortOrder: number;
};

export type SerializedCharge = {
  id: string;
  label: string;
  amount: number;
  dayOfMonth: number | null;
  savingsBoxId: string | null;
  savingsBoxName: string | null;
  sortOrder: number;
  /** True for a charge derived from a savings auto-versement (read-only here). */
  isAuto: boolean;
  /** True for a manual charge that duplicates an auto-versement (shown, not counted). */
  duplicateOfAuto: boolean;
};

export type SerializedPocket = {
  id: string;
  name: string;
  icon: string | null;
  color: string;
  period: BudgetPeriod;
  quota: number;
  sortOrder: number;
  /** Spent within the pocket's own period window (month or current week). */
  spent: number;
  remaining: number;
  /** 0..1+ — share of quota consumed (can exceed 1 when over budget). */
  ratio: number;
  over: boolean;
};

export type SerializedExpense = {
  id: string;
  label: string | null;
  amount: number;
  pocketId: string | null;
  pocketName: string | null;
  pocketColor: string | null;
  spentAt: string;
  createdByName: string | null;
  /** Amount expected back (refundable expense), or null if not refundable. */
  refundExpected: number | null;
  /** Amount received back so far, or null if nothing received yet. */
  refundedAmount: number | null;
  /** Still owed = max(refundExpected − refundedAmount, 0). */
  outstanding: number;
};

export type BudgetAnalysis = {
  /** Total net spending this month. */
  total: number;
  /** Spending grouped by type (pocket, + "Sans poste"), biggest first. */
  byType: { key: string; name: string; color: string; amount: number; ratio: number }[];
  /** Net spending per in-month week (same 7-day blocks as weekly pockets). */
  byWeek: { label: string; amount: number }[];
};

export type BudgetOverview = {
  /** ISO `YYYY-MM` key for the month the account figures cover. */
  month: string;
  /** The current in-month week (1-based) and a "15 – 21 juin" style label. */
  week: { index: number; label: string };
  totals: {
    income: number;
    charges: number;
    /** All expenses logged in the current month (across every pocket + uncategorised). */
    monthExpenses: number;
    /** « Reste sur le compte » = income − charges − monthExpenses. */
    reste: number;
    /** Income − charges − sum(pocket quotas) — what's left once every budget is funded. */
    plannedReste: number;
    /** Money still owed to the household across all pending/partial refunds. */
    awaitingRefund: number;
    /** Conservative spendable: income − charges − reserved budgets (every pocket's
     *  full quota, or what it already overspent) − unbudgeted spend. Pending
     *  refunds stay counted as spent, so the figure can't be over-stated. */
    freeMoney: number;
  };
  income: SerializedIncome[];
  charges: SerializedCharge[];
  pockets: SerializedPocket[];
  /** All expenses logged this month (newest first), capped for safety. */
  expenses: SerializedExpense[];
  /** Refundable expenses still awaiting (full or partial) reimbursement. */
  refunds: SerializedExpense[];
  /** Month spending classified by type, for the Analyse panel. */
  analysis: BudgetAnalysis;
};

const DAYS_PER_MONTH = 30.4368;
const WEEKS_PER_MONTH = 4.348;

/** Monthly-equivalent amount of a savings auto-versement rule, so it can surface
 *  as a recurring budget charge. Exact for monthly_simple; estimated otherwise. */
function monthlyEquivalent(rule: { amount: Prisma.Decimal; type: string; interval: number; weekdays: unknown }): number {
  const a = dec(rule.amount);
  const interval = Math.max(1, rule.interval || 1);
  const weekdayCount = Array.isArray(rule.weekdays) ? Math.max(1, rule.weekdays.length) : 1;
  let m: number;
  switch (rule.type) {
    case "daily":
      m = a * DAYS_PER_MONTH;
      break;
    case "every_x_days":
      m = a * (DAYS_PER_MONTH / interval);
      break;
    case "weekly":
      m = a * weekdayCount * WEEKS_PER_MONTH;
      break;
    case "every_x_weeks":
      m = a * (WEEKS_PER_MONTH / interval);
      break;
    case "monthly_simple":
      m = a / interval;
      break;
    default:
      m = a;
  }
  return Math.round(m * 100) / 100;
}

/**
 * Aggregate the current-month household budget. Expense figures are NET of
 * refunds already received (amount − refundedAmount) — what each expense really
 * cost. The "account" figures use the month window; each pocket is tracked
 * against its own period window (monthly = whole month, weekly = the in-month
 * week). Refundable expenses still owed are summed into `awaitingRefund`.
 */
export async function getBudgetOverview(householdId: string, now: Date = new Date()): Promise<BudgetOverview> {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  // Weekly pockets are tracked against the current week *within the month*
  // (7-day blocks counted from the 1st, the last one clamped to month-end) —
  // not a rolling ISO week that could spill into another month. This keeps live
  // "what's left this week" anchored to the monthly budget.
  const weekIndex = Math.floor((now.getDate() - 1) / 7);
  const weekStart = startOfDay(addDays(monthStart, weekIndex * 7));
  const weekEndRaw = endOfDay(addDays(weekStart, 6));
  const weekEnd = weekEndRaw > monthEnd ? monthEnd : weekEndRaw;

  const [income, charges, pockets, monthExpenses, refundRows, autoFillRules] = await Promise.all([
    db.budgetIncome.findMany({ where: { householdId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.budgetCharge.findMany({
      where: { householdId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { savingsBox: { select: { name: true } } },
    }),
    db.budgetPocket.findMany({ where: { householdId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.budgetExpense.findMany({
      where: { householdId, spentAt: { gte: monthStart, lte: monthEnd } },
      include: { pocket: { select: { name: true, color: true } }, createdByMember: { select: { displayName: true } } },
      orderBy: { spentAt: "desc" },
    }),
    db.budgetExpense.findMany({
      where: { householdId, refundExpected: { not: null } },
      include: { pocket: { select: { name: true, color: true } }, createdByMember: { select: { displayName: true } } },
      orderBy: { spentAt: "desc" },
    }),
    db.savingsAutoFillRule.findMany({
      where: { isPaused: false, box: { householdId, isArchived: false } },
      include: { box: { select: { id: true, name: true } } },
    }),
  ]);

  // Net of refunds already received — the real cost of an expense.
  const net = (e: { amount: Prisma.Decimal; refundedAmount: Prisma.Decimal | null }) => dec(e.amount) - dec(e.refundedAmount);
  const outstandingOf = (e: { refundExpected: Prisma.Decimal | null; refundedAmount: Prisma.Decimal | null }) =>
    Math.max(dec(e.refundExpected) - dec(e.refundedAmount), 0);
  const serializeExpense = (e: (typeof monthExpenses)[number]): SerializedExpense => ({
    id: e.id,
    label: e.label,
    amount: dec(e.amount),
    pocketId: e.pocketId,
    pocketName: e.pocket?.name ?? null,
    pocketColor: e.pocket?.color ?? null,
    spentAt: e.spentAt.toISOString(),
    createdByName: e.createdByMember?.displayName ?? null,
    refundExpected: e.refundExpected == null ? null : dec(e.refundExpected),
    refundedAmount: e.refundedAmount == null ? null : dec(e.refundedAmount),
    outstanding: outstandingOf(e),
  });

  const totalIncome = income.reduce((sum, row) => sum + dec(row.amount), 0);

  // Active auto-versements (savings) surface as read-only "auto" charges so the
  // budget reflects recurring savings without a duplicate manual entry.
  const activeRules = autoFillRules.filter((r) => r.startsOn <= now && (r.endsOn == null || r.endsOn >= now));
  const autoBoxIds = new Set(activeRules.map((r) => r.boxId));
  const derivedCharges: SerializedCharge[] = activeRules.map((r) => ({
    id: `auto-${r.boxId}`,
    label: r.box.name,
    amount: monthlyEquivalent(r),
    dayOfMonth: r.dayOfMonth,
    savingsBoxId: r.boxId,
    savingsBoxName: r.box.name,
    sortOrder: 1000,
    isAuto: true,
    duplicateOfAuto: false,
  }));
  const manualCharges: SerializedCharge[] = charges.map((c) => ({
    id: c.id,
    label: c.label,
    amount: dec(c.amount),
    dayOfMonth: c.dayOfMonth,
    savingsBoxId: c.savingsBoxId,
    savingsBoxName: c.savingsBox?.name ?? null,
    sortOrder: c.sortOrder,
    isAuto: false,
    duplicateOfAuto: c.savingsBoxId != null && autoBoxIds.has(c.savingsBoxId),
  }));
  const allCharges = [...manualCharges, ...derivedCharges];
  // A manual charge that duplicates an auto-versement is shown (with a warning)
  // but NOT counted, to avoid charging the same recurring savings twice.
  const totalCharges =
    manualCharges.filter((c) => !c.duplicateOfAuto).reduce((sum, c) => sum + c.amount, 0) +
    derivedCharges.reduce((sum, c) => sum + c.amount, 0);
  const totalMonthExpenses = monthExpenses.reduce((sum, row) => sum + net(row), 0);

  const monthByPocket = new Map<string, number>();
  for (const e of monthExpenses) {
    if (e.pocketId) monthByPocket.set(e.pocketId, (monthByPocket.get(e.pocketId) ?? 0) + net(e));
  }
  const weekByPocket = new Map<string, number>();
  for (const e of monthExpenses) {
    if (e.pocketId && e.spentAt >= weekStart && e.spentAt <= weekEnd) {
      weekByPocket.set(e.pocketId, (weekByPocket.get(e.pocketId) ?? 0) + net(e));
    }
  }

  const pendingRefunds = refundRows.filter((e) => outstandingOf(e) > 0.001);
  const awaitingRefund = pendingRefunds.reduce((sum, e) => sum + outstandingOf(e), 0);

  // ── Analyse panel: classify the month's spending by type + by week ──────────
  const typeMap = new Map<string, { key: string; name: string; color: string; amount: number }>();
  for (const e of monthExpenses) {
    const key = e.pocketId ?? "none";
    const entry = typeMap.get(key) ?? { key, name: e.pocket?.name ?? "Sans poste", color: e.pocket?.color ?? "#8a93a0", amount: 0 };
    entry.amount += net(e);
    typeMap.set(key, entry);
  }
  const byType = [...typeMap.values()]
    .filter((t) => t.amount > 0.001)
    .sort((a, b) => b.amount - a.amount)
    .map((t) => ({ ...t, ratio: totalMonthExpenses > 0 ? t.amount / totalMonthExpenses : 0 }));

  const weekCount = Math.ceil(monthEnd.getDate() / 7);
  const byWeek: { label: string; amount: number }[] = [];
  for (let i = 0; i < weekCount; i++) {
    const wStart = startOfDay(addDays(monthStart, i * 7));
    const wEndRaw = endOfDay(addDays(wStart, 6));
    const wEnd = wEndRaw > monthEnd ? monthEnd : wEndRaw;
    let amount = 0;
    for (const e of monthExpenses) if (e.spentAt >= wStart && e.spentAt <= wEnd) amount += net(e);
    byWeek.push({ label: `S${i + 1}`, amount });
  }

  const serializedPockets: SerializedPocket[] = pockets.map((p) => {
    const period = normalizePeriod(p.period);
    const quota = dec(p.quota);
    const spent = (period === "weekly" ? weekByPocket : monthByPocket).get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
      icon: p.icon,
      color: p.color,
      period,
      quota,
      sortOrder: p.sortOrder,
      spent,
      remaining: quota - spent,
      ratio: quota > 0 ? spent / quota : spent > 0 ? 1 : 0,
      over: spent > quota,
    };
  });

  const plannedPocketTotal = serializedPockets.reduce((sum, p) => sum + p.quota, 0);

  // ── Argent libre: conservative spendable. Reserve every pocket's full budget
  // (or its overspend), subtract unbudgeted spend; pending refunds stay counted
  // as spent (net), so the user can't think they have more than they do. ──────
  const pocketedSpent = [...monthByPocket.values()].reduce((sum, v) => sum + v, 0);
  const uncategorizedSpent = totalMonthExpenses - pocketedSpent;
  const reservedBudgets = serializedPockets.reduce((sum, p) => {
    const monthlyBudget = p.period === "weekly" ? p.quota * weekCount : p.quota;
    return sum + Math.max(monthlyBudget, monthByPocket.get(p.id) ?? 0);
  }, 0);
  const freeMoney = totalIncome - totalCharges - reservedBudgets - uncategorizedSpent;

  const weekLabel = `${format(weekStart, "d", { locale: fr })} – ${format(weekEnd, "d MMM", { locale: fr })}`;

  return {
    month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
    week: { index: weekIndex + 1, label: weekLabel },
    totals: {
      income: totalIncome,
      charges: totalCharges,
      monthExpenses: totalMonthExpenses,
      reste: totalIncome - totalCharges - totalMonthExpenses,
      plannedReste: totalIncome - totalCharges - plannedPocketTotal,
      awaitingRefund,
      freeMoney,
    },
    income: income.map((i) => ({ id: i.id, label: i.label, amount: dec(i.amount), sortOrder: i.sortOrder })),
    charges: allCharges,
    pockets: serializedPockets,
    expenses: monthExpenses.slice(0, 365).map(serializeExpense),
    refunds: pendingRefunds.slice(0, 50).map(serializeExpense),
    analysis: { total: totalMonthExpenses, byType, byWeek },
  };
}
