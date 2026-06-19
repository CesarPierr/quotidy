import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    budgetIncome: { findMany: vi.fn() },
    budgetCharge: { findMany: vi.fn() },
    budgetPocket: { findMany: vi.fn() },
    budgetExpense: { findMany: vi.fn() },
  },
}));

import { getBudgetOverview, normalizePeriod } from "@/lib/budget";
import { db } from "@/lib/db";

const d = (s: string) => new Date(s);
// June 18 2026 → in-month week 3 (days 15–21), so weekly pockets only count
// expenses from the 15th–21st even though the month total is larger.
const NOW = new Date("2026-06-18T12:00:00");

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(db.budgetIncome.findMany).mockResolvedValue([
    { id: "i1", label: "Salaire", amount: 2000, sortOrder: 0, createdAt: d("2026-06-01") },
  ] as never);

  vi.mocked(db.budgetCharge.findMany).mockResolvedValue([
    { id: "c1", label: "Loyer", amount: 800, dayOfMonth: 5, savingsBoxId: null, sortOrder: 0, createdAt: d("2026-06-01"), savingsBox: null },
  ] as never);

  vi.mocked(db.budgetPocket.findMany).mockResolvedValue([
    { id: "p1", name: "Alimentation", color: "#38735d", period: "monthly", quota: 400, sortOrder: 0, createdAt: d("2026-06-01") },
    { id: "p2", name: "Loisirs", color: "#2f6d88", period: "weekly", quota: 50, sortOrder: 1, createdAt: d("2026-06-01") },
  ] as never);

  vi.mocked(db.budgetExpense.findMany).mockResolvedValue([
    { id: "e1", label: "Courses", amount: 120, pocketId: "p1", spentAt: d("2026-06-10T10:00:00"), pocket: { name: "Alimentation", color: "#38735d" }, createdByMember: { displayName: "Alex" } },
    { id: "e2", label: "Ciné", amount: 30, pocketId: "p2", spentAt: d("2026-06-02T10:00:00"), pocket: { name: "Loisirs", color: "#2f6d88" }, createdByMember: null },
    { id: "e3", label: "Resto", amount: 15, pocketId: "p2", spentAt: d("2026-06-18T10:00:00"), pocket: { name: "Loisirs", color: "#2f6d88" }, createdByMember: null },
    { id: "e4", label: "Café", amount: 20, pocketId: null, spentAt: d("2026-06-15T10:00:00"), pocket: null, createdByMember: null },
  ] as never);
});

describe("normalizePeriod", () => {
  it("defaults anything but 'weekly' to monthly", () => {
    expect(normalizePeriod("weekly")).toBe("weekly");
    expect(normalizePeriod("monthly")).toBe("monthly");
    expect(normalizePeriod("bogus")).toBe("monthly");
    expect(normalizePeriod(null)).toBe("monthly");
  });
});

describe("getBudgetOverview", () => {
  it("computes the monthly account remaining = income − charges − month expenses", async () => {
    const o = await getBudgetOverview("h1", NOW);
    expect(o.totals.income).toBe(2000);
    expect(o.totals.charges).toBe(800);
    expect(o.totals.monthExpenses).toBe(185); // 120 + 30 + 15 + 20
    expect(o.totals.reste).toBe(1015); // 2000 − 800 − 185
    expect(o.totals.plannedReste).toBe(750); // 2000 − 800 − (400 + 50)
    expect(o.month).toBe("2026-06");
    expect(o.week.index).toBe(3); // days 15–21
    expect(o.week.label).toMatch(/juin/);
    expect(o.expenses.length).toBe(4);
  });

  it("classifies the month's spending by type for the Analyse panel", async () => {
    const o = await getBudgetOverview("h1", NOW);
    expect(o.analysis.total).toBe(185);
    // p1=120, p2=30+15=45, uncategorised=20 → biggest first.
    expect(o.analysis.byType.map((t) => [t.name, t.amount])).toEqual([
      ["Alimentation", 120],
      ["Loisirs", 45],
      ["Sans poste", 20],
    ]);
    // By date: Ciné 30 → S1 (2nd), Courses 120 → S2 (10th), Resto 15 + Café 20 → S3 (15th/18th).
    const wk = Object.fromEntries(o.analysis.byWeek.map((w) => [w.label, w.amount]));
    expect(wk.S1).toBe(30);
    expect(wk.S2).toBe(120);
    expect(wk.S3).toBe(35);
  });

  it("tracks a monthly pocket against the whole month", async () => {
    const o = await getBudgetOverview("h1", NOW);
    const p1 = o.pockets.find((p) => p.id === "p1")!;
    expect(p1.period).toBe("monthly");
    expect(p1.spent).toBe(120);
    expect(p1.remaining).toBe(280);
    expect(p1.over).toBe(false);
  });

  it("tracks a weekly pocket against the in-month week only (not the whole month)", async () => {
    const o = await getBudgetOverview("h1", NOW);
    const p2 = o.pockets.find((p) => p.id === "p2")!;
    expect(p2.period).toBe("weekly");
    // Month total for p2 is 45 (30 on the 2nd + 15 on the 18th) but week 3
    // (15–21) only contains the 15 from the 18th.
    expect(p2.spent).toBe(15);
    expect(p2.remaining).toBe(35);
    expect(p2.over).toBe(false);
  });

  it("flags an over-budget pocket", async () => {
    vi.mocked(db.budgetExpense.findMany).mockResolvedValue([
      { id: "e1", label: "Courses", amount: 500, pocketId: "p1", spentAt: d("2026-06-10T10:00:00"), pocket: { name: "Alimentation", color: "#38735d" }, createdByMember: null },
    ] as never);
    const o = await getBudgetOverview("h1", NOW);
    const p1 = o.pockets.find((p) => p.id === "p1")!;
    expect(p1.spent).toBe(500);
    expect(p1.over).toBe(true);
    expect(p1.remaining).toBe(-100);
  });

  it("nets received refunds out of expenses and sums what's still owed", async () => {
    vi.mocked(db.budgetIncome.findMany).mockResolvedValue([
      { id: "i1", label: "Salaire", amount: 1000, sortOrder: 0, createdAt: d("2026-06-01") },
    ] as never);
    vi.mocked(db.budgetCharge.findMany).mockResolvedValue([] as never);
    vi.mocked(db.budgetPocket.findMany).mockResolvedValue([] as never);
    vi.mocked(db.budgetExpense.findMany).mockResolvedValue([
      // Pending: paid 50, expect 30 back, nothing received yet → net 50, owed 30.
      { id: "r1", label: "Médecin", amount: 50, refundExpected: 30, refundedAmount: null, pocketId: null, spentAt: d("2026-06-18T10:00:00"), pocket: null, createdByMember: null },
      // Fully refunded: paid 40, got 40 back → net 0, owed 0 (not pending).
      { id: "r2", label: "Kiné", amount: 40, refundExpected: 40, refundedAmount: 40, pocketId: null, spentAt: d("2026-06-17T10:00:00"), pocket: null, createdByMember: null },
    ] as never);

    const o = await getBudgetOverview("h1", NOW);
    expect(o.totals.monthExpenses).toBe(50); // (50−0) + (40−40)
    expect(o.totals.reste).toBe(950); // 1000 − 0 − 50
    expect(o.totals.awaitingRefund).toBe(30); // only r1 still owed
    expect(o.refunds.map((r) => r.id)).toEqual(["r1"]);
    expect(o.refunds[0]?.outstanding).toBe(30);
  });
});
