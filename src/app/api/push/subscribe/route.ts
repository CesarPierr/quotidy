import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { endpoint, keys, memberId } = await request.json() as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      memberId?: string;
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Subscription invalide" }, { status: 400 });
    }

    // Resolve member and enforce ownership of any client-supplied memberId.
    const member = memberId
      ? await db.householdMember.findFirst({ where: { id: memberId, userId: user.id } })
      : await db.householdMember.findFirst({ where: { userId: user.id } });
    const resolvedMemberId = member?.id;

    if (!resolvedMemberId) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });

    await db.pushSubscription.upsert({
      where: { endpoint },
      create: { memberId: resolvedMemberId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { p256dh: keys.p256dh, auth: keys.auth },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("push.subscribe", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
