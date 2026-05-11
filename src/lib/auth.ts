import "server-only";

import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";

export const SESSION_COOKIE = "quotidy_session";
// Legacy cookie name kept readable during the rebrand transition. Sessions issued before
// the rename are honored until they expire naturally (max 21 days). Remove once the
// quotidy cookie window has fully elapsed in production.
export const LEGACY_SESSION_COOKIE = "hearthly_session";
const SESSION_DURATION_DAYS = 21;

function readSessionToken(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return (
    cookieStore.get(SESSION_COOKIE)?.value ??
    cookieStore.get(LEGACY_SESSION_COOKIE)?.value ??
    null
  );
}

function shouldUseSecureSessionCookie() {
  return process.env.NODE_ENV === "production" && (process.env.APP_BASE_URL?.startsWith("https") ?? false);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getCurrentSessionTokenHash() {
  const cookieStore = await cookies();
  const token = readSessionToken(cookieStore);

  return token ? hashToken(token) : null;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createIntegrationApiKey() {
  return `qtd_oc_${randomBytes(24).toString("base64url")}`;
}

export async function createSession(userId: string, options?: { secure?: boolean }) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: options?.secure ?? shouldUseSecureSessionCookie(),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = readSessionToken(cookieStore);

  if (token) {
    await db.session.deleteMany({
      where: {
        tokenHash: hashToken(token),
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(LEGACY_SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = readSessionToken(cookieStore);

  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      user: {
        include: {
          memberships: {
            include: {
              household: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    cookieStore.delete(SESSION_COOKIE);
    cookieStore.delete(LEGACY_SESSION_COOKIE);

    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireGuest() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/app");
  }
}
