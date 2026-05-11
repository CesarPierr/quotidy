import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logInfo } from "@/lib/logger";

const ALLOWED_EVENTS = new Set([
  "home.rendered",
  "onboarding.started",
  "onboarding.step_viewed",
  "onboarding.completed",
  "activation.checklist_viewed",
  "quick_add.submitted",
  "session.started",
  "session.completed",
  "task_detail.opened",
  "filter.toggled",
  "calendar.opened",
  "savings.opened",
  "support.opened",
  "feedback.opened",
]);

function sanitizeProps(props: Record<string, unknown> | undefined) {
  if (!props) return undefined;

  return Object.fromEntries(
    Object.entries(props)
      .slice(0, 20)
      .map(([key, value]) => {
        if (typeof value === "string") return [key, value.slice(0, 160)];
        if (typeof value === "number" || typeof value === "boolean" || value === null) return [key, value];
        return [key, String(value).slice(0, 160)];
      }),
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 204 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = typeof body === "object" && body && "event" in body ? String((body as { event: unknown }).event) : "";
  if (!ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  const props =
    typeof body === "object" && body && "props" in body
      ? ((body as { props: unknown }).props as Record<string, unknown> | undefined)
      : undefined;
  const sanitizedProps = sanitizeProps(props && typeof props === "object" ? props : undefined);

  const householdId =
    sanitizedProps && typeof sanitizedProps.householdId === "string"
      ? sanitizedProps.householdId
      : null;
  const membership = householdId
    ? await db.householdMember.findFirst({
        where: { householdId, userId: user.id },
        select: { householdId: true },
      })
    : null;

  logInfo("ux.event", {
    event,
    userId: user.id,
    householdId: membership?.householdId ?? null,
    ...(sanitizedProps ? { props: sanitizedProps } : {}),
  });

  await db.uxEvent.create({
    data: {
      event,
      userId: user.id,
      householdId: membership?.householdId ?? null,
      path: sanitizedProps && typeof sanitizedProps.path === "string" ? sanitizedProps.path : null,
      props: sanitizedProps,
    },
  });

  return new NextResponse(null, { status: 204 });
}
