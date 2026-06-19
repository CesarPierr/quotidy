import { dataErrorOrRedirect, dataOrRedirect, withHousehold } from "@/lib/api";
import { getBudgetOverview } from "@/lib/budget";
import { db } from "@/lib/db";
import {
  budgetChargeSchema,
  budgetExpenseSchema,
  budgetIncomeSchema,
  budgetPocketSchema,
  budgetRefundSchema,
} from "@/lib/validation";

/**
 * One POST endpoint for the whole Budget surface, branching on `_action`
 * (mirrors the notes route). Every mutation returns the freshly recomputed
 * overview so the client can re-render the live « reste » without a round-trip.
 * Edits send the full payload, so we validate updates with the create schema.
 */
export const POST = withHousehold<{ id: string }>(async ({ request, params, membership, formData }) => {
  const householdId = params.id;
  const back = `/app/budget?household=${householdId}`;
  const action = formData.get("_action")?.toString() ?? "";
  const id = formData.get("id")?.toString();

  const ok = async () =>
    dataOrRedirect(request, back, { overview: await getBudgetOverview(householdId) }, false);
  const fail = (message: string) => dataErrorOrRedirect(request, 400, message, back);
  const str = (k: string) => formData.get(k)?.toString();

  async function nextSortOrder(model: "income" | "charge" | "pocket") {
    const where = { householdId };
    const count =
      model === "income"
        ? await db.budgetIncome.count({ where })
        : model === "charge"
          ? await db.budgetCharge.count({ where })
          : await db.budgetPocket.count({ where });
    return count;
  }

  switch (action) {
    // ── Revenus ──────────────────────────────────────────────────────────────
    case "income.create": {
      const parsed = budgetIncomeSchema.safeParse({ label: str("label"), amount: str("amount") });
      if (!parsed.success) return fail("Revenu invalide.");
      await db.budgetIncome.create({
        data: { householdId, label: parsed.data.label, amount: parsed.data.amount, sortOrder: await nextSortOrder("income") },
      });
      return ok();
    }
    case "income.update": {
      if (!id) return fail("Identifiant manquant.");
      const parsed = budgetIncomeSchema.safeParse({ label: str("label"), amount: str("amount") });
      if (!parsed.success) return fail("Revenu invalide.");
      const res = await db.budgetIncome.updateMany({ where: { id, householdId }, data: { label: parsed.data.label, amount: parsed.data.amount } });
      if (res.count === 0) return fail("Revenu introuvable.");
      return ok();
    }
    case "income.delete": {
      if (!id) return fail("Identifiant manquant.");
      await db.budgetIncome.deleteMany({ where: { id, householdId } });
      return ok();
    }

    // ── Charges fixes ──────────────────────────────────────────────────────────
    case "charge.create":
    case "charge.update": {
      const savingsBoxId = str("savingsBoxId") || undefined;
      const parsed = budgetChargeSchema.safeParse({
        label: str("label"),
        amount: str("amount"),
        dayOfMonth: str("dayOfMonth") || undefined,
        savingsBoxId,
      });
      if (!parsed.success) return fail("Charge invalide.");
      if (parsed.data.savingsBoxId) {
        const box = await db.savingsBox.findFirst({ where: { id: parsed.data.savingsBoxId, householdId }, select: { id: true } });
        if (!box) return fail("Enveloppe d'épargne introuvable.");
      }
      const data = {
        label: parsed.data.label,
        amount: parsed.data.amount,
        dayOfMonth: parsed.data.dayOfMonth ?? null,
        savingsBoxId: parsed.data.savingsBoxId ?? null,
      };
      if (action === "charge.create") {
        await db.budgetCharge.create({ data: { householdId, ...data, sortOrder: await nextSortOrder("charge") } });
      } else {
        if (!id) return fail("Identifiant manquant.");
        const res = await db.budgetCharge.updateMany({ where: { id, householdId }, data });
        if (res.count === 0) return fail("Charge introuvable.");
      }
      return ok();
    }
    case "charge.delete": {
      if (!id) return fail("Identifiant manquant.");
      await db.budgetCharge.deleteMany({ where: { id, householdId } });
      return ok();
    }

    // ── Postes de dépense ───────────────────────────────────────────────────────
    case "pocket.create":
    case "pocket.update": {
      const parsed = budgetPocketSchema.safeParse({
        name: str("name"),
        color: str("color") || undefined,
        period: str("period") || undefined,
        quota: str("quota"),
      });
      if (!parsed.success) return fail("Poste invalide.");
      const data = { name: parsed.data.name, color: parsed.data.color, period: parsed.data.period, quota: parsed.data.quota };
      if (action === "pocket.create") {
        await db.budgetPocket.create({ data: { householdId, ...data, sortOrder: await nextSortOrder("pocket") } });
      } else {
        if (!id) return fail("Identifiant manquant.");
        const res = await db.budgetPocket.updateMany({ where: { id, householdId }, data });
        if (res.count === 0) return fail("Poste introuvable.");
      }
      return ok();
    }
    case "pocket.delete": {
      if (!id) return fail("Identifiant manquant.");
      await db.budgetPocket.deleteMany({ where: { id, householdId } });
      return ok();
    }

    // ── Dépenses ─────────────────────────────────────────────────────────────
    case "expense.create": {
      const parsed = budgetExpenseSchema.safeParse({
        label: str("label") || undefined,
        amount: str("amount"),
        pocketId: str("pocketId") || undefined,
        spentAt: str("spentAt") || undefined,
        refundExpected: str("refundExpected") || undefined,
      });
      if (!parsed.success) return fail("Dépense invalide.");
      if (parsed.data.pocketId) {
        const pocket = await db.budgetPocket.findFirst({ where: { id: parsed.data.pocketId, householdId }, select: { id: true } });
        if (!pocket) return fail("Poste introuvable.");
      }
      const spentAt = parsed.data.spentAt ? new Date(parsed.data.spentAt) : new Date();
      if (Number.isNaN(spentAt.getTime())) return fail("Date invalide.");
      await db.budgetExpense.create({
        data: {
          householdId,
          label: parsed.data.label ?? null,
          amount: parsed.data.amount,
          pocketId: parsed.data.pocketId ?? null,
          spentAt,
          createdByMemberId: membership.id,
          refundExpected: parsed.data.refundExpected ?? null,
        },
      });
      return ok();
    }
    case "expense.refund": {
      if (!id) return fail("Identifiant manquant.");
      const parsed = budgetRefundSchema.safeParse({ refundedAmount: str("refundedAmount") });
      if (!parsed.success) return fail("Montant de remboursement invalide.");
      const res = await db.budgetExpense.updateMany({ where: { id, householdId }, data: { refundedAmount: parsed.data.refundedAmount } });
      if (res.count === 0) return fail("Dépense introuvable.");
      return ok();
    }
    case "expense.delete": {
      if (!id) return fail("Identifiant manquant.");
      await db.budgetExpense.deleteMany({ where: { id, householdId } });
      return ok();
    }

    default:
      return fail("Action inconnue.");
  }
});
