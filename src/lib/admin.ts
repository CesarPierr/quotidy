import "server-only";

import { redirect } from "next/navigation";

import type { Prisma, User } from "@prisma/client";

import { db } from "@/lib/db";
import { logWarn } from "@/lib/logger";

function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSiteAdmin(user: Pick<User, "email" | "isSiteAdmin">) {
  return user.isSiteAdmin || configuredAdminEmails().has(user.email.toLowerCase());
}

export async function requireSiteAdmin(user: Pick<User, "id" | "email" | "isSiteAdmin">) {
  if (!isSiteAdmin(user)) {
    logWarn("admin.access_denied", { userId: user.id });
    redirect("/app");
  }
}

export async function writeAdminAudit(params: {
  actorUserId: string;
  action: string;
  householdId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.adminAuditEvent.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      householdId: params.householdId ?? null,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      metadata: params.metadata as Prisma.InputJsonObject | undefined,
    },
  });
}
