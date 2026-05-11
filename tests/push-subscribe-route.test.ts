import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  householdMemberFindFirst: vi.fn(),
  pushSubscriptionUpsert: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: authMocks.requireUser,
}));

vi.mock("@/lib/db", () => ({
  db: {
    householdMember: {
      findFirst: dbMocks.householdMemberFindFirst,
    },
    pushSubscription: {
      upsert: dbMocks.pushSubscriptionUpsert,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { POST } from "@/app/api/push/subscribe/route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/push/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireUser.mockResolvedValue({ id: "user-1" });
  });

  it("rejects a client-supplied memberId that does not belong to the current user", async () => {
    dbMocks.householdMemberFindFirst.mockResolvedValue(null);

    const response = await POST(
      request({
        endpoint: "https://push.example/sub",
        keys: { p256dh: "p256", auth: "auth" },
        memberId: "member-from-another-user",
      }),
    );

    expect(response.status).toBe(404);
    expect(dbMocks.householdMemberFindFirst).toHaveBeenCalledWith({
      where: { id: "member-from-another-user", userId: "user-1" },
    });
    expect(dbMocks.pushSubscriptionUpsert).not.toHaveBeenCalled();
  });

  it("upserts the subscription for the resolved member", async () => {
    dbMocks.householdMemberFindFirst.mockResolvedValue({ id: "member-1" });
    dbMocks.pushSubscriptionUpsert.mockResolvedValue({ id: "sub-1" });

    const response = await POST(
      request({
        endpoint: "https://push.example/sub",
        keys: { p256dh: "p256", auth: "auth" },
      }),
    );

    expect(response.status).toBe(200);
    expect(dbMocks.householdMemberFindFirst).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(dbMocks.pushSubscriptionUpsert).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example/sub" },
      create: { memberId: "member-1", endpoint: "https://push.example/sub", p256dh: "p256", auth: "auth" },
      update: { p256dh: "p256", auth: "auth" },
    });
  });
});
