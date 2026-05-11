import { getCurrentSessionTokenHash, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeNextPath, redirectTo } from "@/lib/request";

function destination(formData: FormData, code: string, params?: Record<string, string | number>) {
  const nextPath = normalizeNextPath(formData.get("nextPath")?.toString()) ?? "/app/settings/account";
  const search = new URLSearchParams({ account: code });
  for (const [key, value] of Object.entries(params ?? {})) {
    search.set(key, String(value));
  }
  return `${nextPath}${nextPath.includes("?") ? "&" : "?"}${search.toString()}`;
}

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const currentTokenHash = await getCurrentSessionTokenHash();

  if (!currentTokenHash) {
    return redirectTo(request, destination(formData, "session_missing"));
  }

  const result = await db.session.deleteMany({
    where: {
      userId: user.id,
      tokenHash: { not: currentTokenHash },
    },
  });

  return redirectTo(request, destination(formData, "sessions_revoked", { count: result.count }));
}
