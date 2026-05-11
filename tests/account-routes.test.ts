import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  getCurrentSessionTokenHash: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  sessionDeleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: authMocks.requireUser,
  verifyPassword: authMocks.verifyPassword,
  hashPassword: authMocks.hashPassword,
  getCurrentSessionTokenHash: authMocks.getCurrentSessionTokenHash,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: dbMocks.userFindUnique,
      update: dbMocks.userUpdate,
    },
    session: {
      deleteMany: dbMocks.sessionDeleteMany,
    },
    $transaction: dbMocks.transaction,
  },
}));

import { POST as emailPost } from "@/app/api/account/email/route";
import { POST as passwordPost } from "@/app/api/account/password/route";
import { POST as profilePost } from "@/app/api/account/profile/route";
import { POST as revokeSessionsPost } from "@/app/api/account/sessions/revoke-others/route";

function formRequest(fields: Record<string, string>) {
  return new Request("http://localhost:3000/api/account", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("account routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_BASE_URL = "http://192.168.1.132";
    authMocks.requireUser.mockResolvedValue({ id: "user-1" });
    dbMocks.transaction.mockResolvedValue([]);
  });

  it("updates the display name", async () => {
    dbMocks.userUpdate.mockResolvedValue({ id: "user-1" });

    const response = await profilePost(formRequest({ displayName: "Pierre Nouveau" }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://192.168.1.132/app/settings/account?account=profile_saved");
    expect(dbMocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { displayName: "Pierre Nouveau" },
    });
  });

  it("requires the current password before changing email", async () => {
    dbMocks.userFindUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "old@example.com",
      passwordHash: "hash",
    });
    authMocks.verifyPassword.mockResolvedValue(false);

    const response = await emailPost(formRequest({
      email: "new@example.com",
      password: "wrong-password",
    }));

    expect(response.headers.get("location")).toBe("http://192.168.1.132/app/settings/account?account=invalid_password");
    expect(dbMocks.userUpdate).not.toHaveBeenCalled();
  });

  it("updates email and clears verification when the password is valid", async () => {
    dbMocks.userFindUnique
      .mockResolvedValueOnce({ id: "user-1", email: "old@example.com", passwordHash: "hash" })
      .mockResolvedValueOnce(null);
    authMocks.verifyPassword.mockResolvedValue(true);
    dbMocks.userUpdate.mockResolvedValue({ id: "user-1" });

    const response = await emailPost(formRequest({
      email: "New@Example.com",
      password: "current-password",
    }));

    expect(response.headers.get("location")).toBe("http://192.168.1.132/app/settings/account?account=email_saved");
    expect(dbMocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        email: "new@example.com",
        emailVerifiedAt: null,
      },
    });
  });

  it("changes password and revokes other sessions", async () => {
    authMocks.getCurrentSessionTokenHash.mockResolvedValue("current-token-hash");
    dbMocks.userFindUnique.mockResolvedValue({ id: "user-1", passwordHash: "hash" });
    authMocks.verifyPassword.mockResolvedValue(true);
    authMocks.hashPassword.mockResolvedValue("new-hash");

    const response = await passwordPost(formRequest({
      currentPassword: "old-password",
      newPassword: "new-password",
      confirmPassword: "new-password",
    }));

    expect(response.headers.get("location")).toBe("http://192.168.1.132/app/settings/account?account=password_saved");
    expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
    expect(dbMocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "new-hash" },
    });
    expect(dbMocks.sessionDeleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        tokenHash: { not: "current-token-hash" },
      },
    });
  });

  it("revokes other sessions only", async () => {
    authMocks.getCurrentSessionTokenHash.mockResolvedValue("current-token-hash");
    dbMocks.sessionDeleteMany.mockResolvedValue({ count: 2 });

    const response = await revokeSessionsPost(formRequest({}));

    expect(response.headers.get("location")).toBe(
      "http://192.168.1.132/app/settings/account?account=sessions_revoked&count=2",
    );
    expect(dbMocks.sessionDeleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        tokenHash: { not: "current-token-hash" },
      },
    });
  });
});
