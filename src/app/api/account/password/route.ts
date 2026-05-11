import {
  getCurrentSessionTokenHash,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeNextPath, redirectTo } from "@/lib/request";
import { accountPasswordSchema } from "@/lib/validation";

function destination(formData: FormData, code: string) {
  const nextPath = normalizeNextPath(formData.get("nextPath")?.toString()) ?? "/app/settings/account";
  return `${nextPath}${nextPath.includes("?") ? "&" : "?"}account=${code}`;
}

export async function POST(request: Request) {
  const user = await requireUser();
  const currentTokenHash = await getCurrentSessionTokenHash();
  const formData = await request.formData();
  const parsed = accountPasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return redirectTo(request, destination(formData, "invalid_password_form"));
  }

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, passwordHash: true },
  });

  if (!fullUser || !(await verifyPassword(parsed.data.currentPassword, fullUser.passwordHash))) {
    return redirectTo(request, destination(formData, "invalid_password"));
  }

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    }),
    db.session.deleteMany({
      where: {
        userId: user.id,
        ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
      },
    }),
  ]);

  return redirectTo(request, destination(formData, "password_saved"));
}
