import { z } from "zod";

import { parseDateInput } from "@/lib/date-input";

export const registerSchema = z.object({
  displayName: z.string().min(2).max(60),
  email: z.email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

export const accountProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
});

export const accountEmailSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const accountPasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: "passwords_mismatch",
  path: ["confirmPassword"],
});

export const householdSchema = z.object({
  name: z.string().min(2).max(80),
  timezone: z.string().min(2).max(60).default(process.env.DEFAULT_TIMEZONE ?? "Europe/Paris"),
});

export const memberSchema = z.object({
  householdId: z.string().cuid(),
  displayName: z.string().min(2).max(60),
  role: z.enum(["owner", "admin", "member"]).default("member"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#E86A33"),
  weeklyCapacityMinutes: z.coerce.number().int().min(0).max(10080).optional(),
});

export const absenceSchema = z.object({
  memberId: z.string().cuid(),
  startDate: z.preprocess((value) => parseDateInput(String(value ?? "")), z.date()),
  endDate: z.preprocess((value) => parseDateInput(String(value ?? "")), z.date()),
  notes: z.string().max(240).optional(),
}).refine((value) => value.endDate >= value.startDate, {
  message: "endDate must be on or after startDate",
  path: ["endDate"],
});

export const recurrenceSchema = z.object({
  type: z.enum(["daily", "every_x_days", "weekly", "every_x_weeks", "monthly_simple"]),
  mode: z.enum(["FIXED", "SLIDING"]).default("SLIDING"),
  interval: z.coerce.number().int().min(1).max(90).default(1),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  anchorDate: z.preprocess((value) => parseDateInput(String(value ?? "")), z.date()),
  dueOffsetDays: z.coerce.number().int().min(0).max(30).default(0),
});

export const assignmentSchema = z.object({
  mode: z.enum([
    "fixed",
    "manual",
    "strict_alternation",
    "round_robin",
    "least_assigned_count",
    "least_assigned_minutes",
  ]),
  eligibleMemberIds: z.array(z.string().cuid()).min(1),
  fixedMemberId: z.string().cuid().optional(),
  rotationOrder: z.array(z.string().cuid()).optional(),
  fairnessWindowDays: z.coerce.number().int().min(1).max(90).default(14),
  rebalanceOnMemberAbsence: z.boolean().default(true),
  lockAssigneeAfterGeneration: z.boolean().default(true),
});

export const taskTemplateSchema = z.object({
  householdId: z.string().cuid(),
  title: z.string().min(2).max(80),
  description: z.string().max(280).optional(),
  category: z.string().max(40).optional(),
  room: z.string().max(40).optional(),
  icon: z.string().max(40).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#D8643D"),
  estimatedMinutes: z.coerce.number().int().min(1).max(480).default(30),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  startsOn: z.preprocess((value) => parseDateInput(String(value ?? "")), z.date()),
  endsOn: z.preprocess((value) => (value ? parseDateInput(String(value)) : undefined), z.date()).optional(),
  recurrence: recurrenceSchema,
  assignment: assignmentSchema,
});

export const occurrenceActionSchema = z.object({
  occurrenceId: z.string().cuid(),
  memberId: z.string().cuid().optional(),
  notes: z.string().max(280).optional(),
  date: z.preprocess((value) => (value ? parseDateInput(String(value)) : undefined), z.date()).optional(),
  actualMinutes: z.coerce.number().int().min(0).max(480).optional(),
  wasCompletedAlone: z.coerce.boolean().optional(),
});

export const householdInviteSchema = z.object({
  householdId: z.string().cuid(),
  role: z.enum(["owner", "admin", "member"]).default("member"),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

export const redeemInviteSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6)
    .max(24)
    .transform((value) => value.toUpperCase()),
});

const amountString = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, ""))
  .refine((value) => /^-?\d+([.,]\d{1,2})?$/.test(value), "Montant invalide")
  .transform((value) => Math.round(Number.parseFloat(value.replace(",", ".")) * 100) / 100)
  .refine((n) => Number.isFinite(n) && Math.abs(n) < 1_000_000_000_000, "Montant hors limites");

const positiveAmount = amountString.refine((n) => n >= 0, "Le montant doit être positif ou nul");

export const colorString = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Couleur invalide")
  .default("#D8643D");

const calculatorNumberString = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, ""))
  .refine((value) => value === "" || /^-?\d+([.,]\d{1,4})?$/.test(value), "Nombre invalide")
  .transform((value) => (value === "" ? undefined : Math.round(Number.parseFloat(value.replace(",", ".")) * 10000) / 10000))
  .refine((n) => n === undefined || (Number.isFinite(n) && Math.abs(n) < 1_000_000_000_000), "Nombre hors limites");

export const savingsBoxCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(["savings", "project", "debt", "provision"]).default("savings"),
  icon: z.string().max(40).optional(),
  color: colorString,
  initialBalance: amountString.optional(),
  targetAmount: positiveAmount.optional(),
  targetDate: z.preprocess(
    (value) => (value ? parseDateInput(String(value)) : undefined),
    z.date(),
  ).optional(),
  allowNegative: z.coerce.boolean().default(false),
  notes: z.string().max(280).optional(),
});

export const savingsBoxUpdateSchema = savingsBoxCreateSchema.partial().extend({
  isArchived: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

export const savingsEntrySchema = z.object({
  type: z.enum(["deposit", "withdrawal"]),
  amount: positiveAmount,
  occurredOn: z.preprocess(
    (value) => parseDateInput(String(value ?? "")),
    z.date(),
  ),
  reason: z.string().max(280).optional(),
});

export const savingsEntryUpdateSchema = z.object({
  amount: positiveAmount.optional(),
  occurredOn: z.preprocess(
    (value) => (value ? parseDateInput(String(value)) : undefined),
    z.date(),
  ).optional(),
  reason: z.string().max(280).optional(),
});

export const savingsAdjustSchema = z.object({
  targetAmount: amountString,
  occurredOn: z.preprocess(
    (value) => parseDateInput(String(value ?? "")),
    z.date(),
  ),
  reason: z.string().max(280).optional(),
});

export const savingsTransferSchema = z.object({
  fromBoxId: z.string().cuid(),
  toBoxId: z.string().cuid(),
  amount: positiveAmount,
  occurredOn: z.preprocess(
    (value) => parseDateInput(String(value ?? "")),
    z.date(),
  ),
  reason: z.string().max(280).optional(),
}).refine((value) => value.fromBoxId !== value.toBoxId, {
  message: "Source et destination doivent être différentes",
  path: ["toBoxId"],
});

export const savingsAutoFillSchema = z.object({
  amount: positiveAmount,
  type: z.enum(["daily", "every_x_days", "weekly", "every_x_weeks", "monthly_simple"]),
  interval: z.coerce.number().int().min(1).max(90).default(1),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  anchorDate: z.preprocess((value) => parseDateInput(String(value ?? "")), z.date()),
  startsOn: z.preprocess((value) => parseDateInput(String(value ?? "")), z.date()),
  endsOn: z.preprocess(
    (value) => (value ? parseDateInput(String(value)) : undefined),
    z.date(),
  ).optional(),
  isPaused: z.coerce.boolean().default(false),
});

const calculatorFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Clé de variable invalide"),
  label: z.string().trim().min(1).max(60),
  type: z.enum(["number", "amount", "percent"]).default("number"),
  defaultValue: calculatorNumberString.optional(),
  helperText: z.string().trim().max(160).optional(),
  isRequired: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export const savingsCalculatorSchema = z.object({
  boxId: z.preprocess((value) => (value ? value : undefined), z.string().cuid().optional()),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional(),
  formula: z.string().trim().min(1).max(500),
  reasonTemplate: z.string().trim().max(180).optional(),
  resultMode: z.enum(["deposit", "withdrawal", "none"]).default("deposit"),
  negativeMode: z.enum(["clamp_to_zero", "convert_to_opposite"]).default("clamp_to_zero"),
  roundingMode: z.enum(["cents", "euro_floor", "euro_ceil", "euro_nearest"]).default("cents"),
  fields: z.array(calculatorFieldSchema).min(0).max(12),
}).refine((value) => new Set(value.fields.map((field) => field.key)).size === value.fields.length, {
  message: "Les clés de variables doivent être uniques.",
  path: ["fields"],
});

export const savingsCalculatorRunSchema = z.object({
  targetBoxId: z.preprocess((value) => (value ? value : undefined), z.string().cuid().optional()),
  inputs: z.record(z.string(), z.string().max(80)),
});

// ─── Checklists & Foyer notes ────────────────────────────────────────────────

export const checklistCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().max(40).optional(),
  color: colorString,
  taskTemplateId: z.preprocess((v) => (v ? v : undefined), z.string().cuid().optional()),
});

export const checklistUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  icon: z.string().max(40).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur invalide").optional(),
  taskTemplateId: z.preprocess((v) => (v === "" ? null : v), z.string().cuid().nullable().optional()),
  isArchived: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

export const checklistItemCreateSchema = z.object({
  label: z.string().trim().min(1).max(200),
});

export const checklistItemUpdateSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  isChecked: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

export const householdNoteCreateSchema = z.object({
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1).max(1000),
  color: colorString,
});

export const householdNoteUpdateSchema = z.object({
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1).max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur invalide").optional(),
  isPinned: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

export const noteRetentionSchema = z.object({
  noteRetentionDays: z.coerce.number().int().min(1).max(365),
});

// ── Budget ───────────────────────────────────────────────────────────────────

export const budgetIncomeSchema = z.object({
  label: z.string().trim().min(1).max(80),
  amount: positiveAmount,
});
export const budgetIncomeUpdateSchema = budgetIncomeSchema.partial();

export const budgetChargeSchema = z.object({
  label: z.string().trim().min(1).max(80),
  amount: positiveAmount,
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  savingsBoxId: z.string().trim().min(1).optional(),
});
export const budgetChargeUpdateSchema = budgetChargeSchema.partial();

export const budgetPocketSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: colorString,
  period: z.enum(["monthly", "weekly"]).default("monthly"),
  quota: positiveAmount,
});
export const budgetPocketUpdateSchema = budgetPocketSchema.partial();

export const budgetExpenseSchema = z.object({
  label: z.string().trim().max(120).optional(),
  amount: positiveAmount,
  pocketId: z.string().trim().min(1).optional(),
  spentAt: z.string().trim().min(1).optional(),
});
export const budgetExpenseUpdateSchema = budgetExpenseSchema.partial();
