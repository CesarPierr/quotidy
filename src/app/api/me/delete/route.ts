import { NextResponse } from "next/server";

import { requireUser, verifyPassword, destroySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logInfo, logWarn } from "@/lib/logger";
import { redirectTo } from "@/lib/request";

/**
 * RGPD Article 17 — right to erasure.
 *
 * Flow:
 *  1. Re-authenticate by password (defense in depth — a stolen session alone can't nuke an account).
 *  2. Refuse if the user is the sole owner of a household with other active members (they must
 *     either transfer ownership or remove the other members first; we never silently abandon
 *     other people's data).
 *  3. Delete owned households (cascades members/tasks/occurrences/savings).
 *  4. Anonymize the user's `HouseholdMember` row in shared households where they are not owner
 *     so historical attribution survives without leaking identity.
 *  5. Delete the user. Sessions and password-reset tokens cascade automatically.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  const deletionRequest = await db.deletionRequest.create({
    data: {
      userId: user.id,
      status: "processing",
      reason: "self_service_account_deletion",
    },
  });

  const formData = await request.formData().catch(() => null);
  const isFormPost = formData !== null;
  const password = isFormPost
    ? String(formData.get("password") ?? "")
    : await request
        .clone()
        .json()
        .then((body) => String(body?.password ?? ""))
        .catch(() => "");

  if (!password) {
    await db.deletionRequest.update({
      where: { id: deletionRequest.id },
      data: { status: "rejected", metadata: { reason: "missing_password" } },
    });
    return isFormPost
      ? redirectTo(request, "/app/foyer/zone-sensible?delete_account=missing_password")
      : NextResponse.json({ error: "Mot de passe requis" }, { status: 400 });
  }

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, passwordHash: true },
  });

  if (!fullUser || !(await verifyPassword(password, fullUser.passwordHash))) {
    logWarn("user.delete_failed_password", { userId: user.id });
    await db.deletionRequest.update({
      where: { id: deletionRequest.id },
      data: { status: "rejected", metadata: { reason: "invalid_password" } },
    });
    return isFormPost
      ? redirectTo(request, "/app/foyer/zone-sensible?delete_account=invalid_password")
      : NextResponse.json({ error: "Mot de passe invalide" }, { status: 401 });
  }

  // Pre-flight: detect blocking household ownerships.
  const ownedHouseholds = await db.household.findMany({
    where: { createdByUserId: user.id },
    include: {
      members: {
        where: { isActive: true, NOT: { userId: user.id } },
        select: { id: true, role: true },
      },
    },
  });

  const blockingHouseholds = ownedHouseholds.filter((h) => h.members.length > 0);
  if (blockingHouseholds.length > 0) {
    await db.deletionRequest.update({
      where: { id: deletionRequest.id },
      data: {
        status: "rejected",
        metadata: {
          reason: "needs_transfer",
          householdIds: blockingHouseholds.map((h) => h.id),
        },
      },
    });
    return isFormPost
      ? redirectTo(request, "/app/foyer/zone-sensible?delete_account=needs_transfer")
      : NextResponse.json(
          {
            error: "shared_households",
            message:
              "Vous êtes propriétaire de foyers contenant d'autres membres actifs. Transférez la propriété ou retirez les membres avant de supprimer votre compte.",
            households: blockingHouseholds.map((h) => ({ id: h.id, name: h.name })),
          },
          { status: 409 },
        );
  }

  // 1. Delete households owned solely by this user (cascades all related rows).
  for (const household of ownedHouseholds) {
    await db.household.delete({ where: { id: household.id } }).catch((err) => {
      logWarn("user.delete_household_failed", {
        userId: user.id,
        householdId: household.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // 2. Anonymize membership rows in shared households so attribution survives.
  await db.householdMember.updateMany({
    where: { userId: user.id },
    data: { userId: null, displayName: "Compte supprimé" },
  });

  // 3. Delete the user — sessions and reset tokens cascade.
  await db.deletionRequest.update({
    where: { id: deletionRequest.id },
    data: { status: "completed", completedAt: new Date() },
  });
  await db.user.delete({ where: { id: user.id } });

  logInfo("user.deleted", {
    userId: user.id,
    requestId: deletionRequest.id,
    ownedHouseholdsDeleted: ownedHouseholds.length,
  });

  await destroySession();

  return isFormPost
    ? redirectTo(request, "/login?account_deleted=1")
    : NextResponse.json({ ok: true });
}
