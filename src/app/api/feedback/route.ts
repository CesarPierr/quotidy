import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logError, logInfo } from "@/lib/logger";

const feedbackSchema = z.object({
  kind: z.enum(["bug", "idea", "question", "abuse", "billing", "security"]).default("bug"),
  message: z.string().trim().min(10, "Décris ton problème en au moins 10 caractères.").max(4000),
  url: z.string().trim().max(500).optional(),
  digest: z.string().trim().max(64).optional(),
  userAgent: z.string().trim().max(500).optional(),
  householdId: z.string().cuid().optional(),
});

const KIND_LABELS: Record<z.infer<typeof feedbackSchema>["kind"], string> = {
  bug: "🐛 Bug",
  idea: "💡 Idée",
  question: "❓ Question",
  abuse: "🚩 Signalement",
  billing: "💳 Paiement",
  security: "🔒 Sécurité",
};

async function postToGithub(title: string, body: string) {
  const repo = process.env.GITHUB_REPORT_REPO;
  const token = process.env.GITHUB_REPORT_TOKEN;
  if (!repo || !token) return null;

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "quotidy-feedback-bot",
      },
      body: JSON.stringify({ title, body, labels: ["user-report"] }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logError("feedback.github_post_failed", new Error(`HTTP ${response.status}: ${text}`));
      return null;
    }
    const data = (await response.json()) as { html_url?: string; number?: number };
    return data;
  } catch (error) {
    logError("feedback.github_post_failed", error);
    return null;
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }

  const { kind, message, url, digest, userAgent, householdId } = parsed.data;
  const reporter = user
    ? `user ${user.id} (${user.email})`
    : "guest";

  let resolvedHouseholdId: string | null = null;
  if (user && householdId) {
    const membership = await db.householdMember.findFirst({
      where: { householdId, userId: user.id },
      select: { householdId: true },
    });
    resolvedHouseholdId = membership?.householdId ?? null;
  }

  // Always log — operators see reports even if GitHub isn't wired up.
  logInfo("feedback.received", {
    kind,
    length: message.length,
    url,
    digest,
    reporter: user?.id ?? null,
    householdId: resolvedHouseholdId,
  });

  const title = `[${KIND_LABELS[kind]}] ${message.slice(0, 80)}${message.length > 80 ? "…" : ""}`;
  const body = [
    `**Type :** ${KIND_LABELS[kind]}`,
    `**Reporter :** ${reporter}`,
    url ? `**URL :** ${url}` : null,
    digest ? `**Digest :** \`${digest}\`` : null,
    userAgent ? `**User-Agent :** ${userAgent}` : null,
    "",
    "---",
    "",
    message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const githubIssue = await postToGithub(title, body);

  const report = await db.feedbackReport.create({
    data: {
      kind,
      message,
      url: url ?? null,
      digest: digest ?? null,
      userAgent: userAgent ?? null,
      reporterUserId: user?.id ?? null,
      householdId: resolvedHouseholdId,
      githubUrl: githubIssue?.html_url ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    reportId: report.id,
    githubUrl: githubIssue?.html_url ?? null,
  });
}
