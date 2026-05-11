import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeNextPath, redirectTo } from "@/lib/request";
import { accountProfileSchema } from "@/lib/validation";

function destination(formData: FormData, code: string) {
  const nextPath = normalizeNextPath(formData.get("nextPath")?.toString()) ?? "/app/settings/account";
  return `${nextPath}${nextPath.includes("?") ? "&" : "?"}account=${code}`;
}

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const parsed = accountProfileSchema.safeParse({
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return redirectTo(request, destination(formData, "invalid_profile"));
  }

  await db.user.update({
    where: { id: user.id },
    data: { displayName: parsed.data.displayName },
  });

  return redirectTo(request, destination(formData, "profile_saved"));
}
