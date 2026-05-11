import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logInfo } from "@/lib/logger";

/**
 * RGPD Article 20 — right to data portability.
 * Returns every record tied to the current user as a single JSON document.
 * Pre-existing internal cuids are preserved so the bundle is self-referential.
 */
export async function GET() {
  const user = await requireUser();
  const exportRequest = await db.dataExportRequest.create({
    data: {
      userId: user.id,
      status: "processing",
      metadata: { format: "json", source: "self_service" },
    },
  });

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    include: {
      sessions: { select: { id: true, expiresAt: true, createdAt: true } },
      passwordResetTokens: { select: { id: true, expiresAt: true, usedAt: true, createdAt: true } },
      memberships: {
        include: {
          availabilities: true,
          household: {
            include: {
              members: {
                select: {
                  id: true,
                  displayName: true,
                  color: true,
                  role: true,
                  isActive: true,
                  weightingFactor: true,
                  weeklyCapacityMinutes: true,
                  createdAt: true,
                },
              },
              tasks: {
                include: {
                  recurrenceRule: true,
                  assignmentRule: true,
                },
              },
              occurrences: {
                where: { OR: [{ assignedMemberId: { not: null } }, { completedByMemberId: { not: null } }] },
                include: {
                  comments: true,
                },
              },
              holidays: true,
              savingsBoxes: {
                include: {
                  entries: true,
                  autoFillRule: true,
                },
              },
              savingsCalculators: {
                include: {
                  fields: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!fullUser) {
    await db.dataExportRequest.update({
      where: { id: exportRequest.id },
      data: { status: "rejected", metadata: { reason: "user_not_found" } },
    });
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const bundle = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    notice:
      "Données personnelles exportées au titre de l'article 20 du RGPD. Les données partagées (foyers, tâches du foyer) sont incluses uniquement pour les foyers dont vous êtes membre.",
    user: {
      id: fullUser.id,
      email: fullUser.email,
      displayName: fullUser.displayName,
      createdAt: fullUser.createdAt,
      updatedAt: fullUser.updatedAt,
      lastLoginAt: fullUser.lastLoginAt,
    },
    sessions: fullUser.sessions,
    passwordResetTokens: fullUser.passwordResetTokens,
    memberships: fullUser.memberships,
  };

  await db.dataExportRequest.update({
    where: { id: exportRequest.id },
    data: { status: "completed", completedAt: new Date() },
  });

  logInfo("user.data_exported", { userId: user.id, requestId: exportRequest.id });

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="foyer-export-${user.id}-${Date.now()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
