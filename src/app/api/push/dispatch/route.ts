import { NextRequest, NextResponse } from "next/server";

import { sendPushToAll } from "@/lib/push";

// This route is called by the cron job on the server — protect with a shared secret.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as {
    payload?: { title?: string; body?: string; url?: string };
  };
  const result = await sendPushToAll(
    {
      title: body.payload?.title ?? "Quotidy",
      body: body.payload?.body ?? "Nouvelles tâches à faire !",
      url: body.payload?.url ?? "/app",
    },
    "push.dispatch",
  );

  return NextResponse.json(result);
}
