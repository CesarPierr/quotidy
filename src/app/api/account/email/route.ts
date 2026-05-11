import { requireUser, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeNextPath, redirectTo } from "@/lib/request";
import { accountEmailSchema } from "@/lib/validation";

function destination(formData: FormData, code: string) {
  const nextPath = normalizeNextPath(formData.get("nextPath")?.toString()) ?? "/app/settings/account";
  return `${nextPath}${nextPath.includes("?") ? "&" : "?"}account=${code}`;
}

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const parsed = accountEmailSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return redirectTo(request, destination(formData, "invalid_email"));
  }

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!fullUser || !(await verifyPassword(parsed.data.password, fullUser.passwordHash))) {
    return redirectTo(request, destination(formData, "invalid_password"));
  }

  if (parsed.data.email === fullUser.email.toLowerCase()) {
    return redirectTo(request, destination(formData, "email_unchanged"));
  }

  const existing = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (existing) {
    return redirectTo(request, destination(formData, "email_taken"));
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      email: parsed.data.email,
      emailVerifiedAt: null,
    },
  });

  return redirectTo(request, destination(formData, "email_saved"));
}
