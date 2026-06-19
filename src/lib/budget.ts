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
};

export type SerializedPocket = {
  id: string;
  name: string;
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
  };
  income: SerializedIncome[];
  charges: SerializedCharge[];
  pockets: SerializedPocket[];
  recentExpenses: SerializedExpense[];
};

/**
 * Aggregate the current-month household budget. The "account" figures use the
 * month window (income − charges − all month expenses). Each pocket is tracked
 * against its OWN period window: monthly pockets sum the month, weekly pockets
 * sum only the current ISO week (Monday-start) — which is why weekly expenses
 * are fetched separately (a week can straddle two months).
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

  const [income, charges, pockets, monthExpenses] = await Promise.all([
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
  ]);

  const totalIncome = income.reduce((sum, row) => sum + dec(row.amount), 0);
  const totalCharges = charges.reduce((sum, row) => sum + dec(row.amount), 0);
  const totalMonthExpenses = monthExpenses.reduce((sum, row) => sum + dec(row.amount), 0);

  const monthByPocket = new Map<string, number>();
  for (const e of monthExpenses) {
    if (e.pocketId) monthByPocket.set(e.pocketId, (monthByPocket.get(e.pocketId) ?? 0) + dec(e.amount));
  }
  const weekByPocket = new Map<string, number>();
  for (const e of monthExpenses) {
    if (e.pocketId && e.spentAt >= weekStart && e.spentAt <= weekEnd) {
      weekByPocket.set(e.pocketId, (weekByPocket.get(e.pocketId) ?? 0) + dec(e.amount));
    }
  }

  const serializedPockets: SerializedPocket[] = pockets.map((p) => {
    const period = normalizePeriod(p.period);
    const quota = dec(p.quota);
    const spent = (period === "weekly" ? weekByPocket : monthByPocket).get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
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
    },
    income: income.map((i) => ({ id: i.id, label: i.label, amount: dec(i.amount), sortOrder: i.sortOrder })),
    charges: charges.map((c) => ({
      id: c.id,
      label: c.label,
      amount: dec(c.amount),
      dayOfMonth: c.dayOfMonth,
      savingsBoxId: c.savingsBoxId,
      savingsBoxName: c.savingsBox?.name ?? null,
      sortOrder: c.sortOrder,
    })),
    pockets: serializedPockets,
    recentExpenses: monthExpenses.slice(0, 12).map((e) => ({
      id: e.id,
      label: e.label,
      amount: dec(e.amount),
      pocketId: e.pocketId,
      pocketName: e.pocket?.name ?? null,
      pocketColor: e.pocket?.color ?? null,
      spentAt: e.spentAt.toISOString(),
      createdByName: e.createdByMember?.displayName ?? null,
    })),
  };
}
