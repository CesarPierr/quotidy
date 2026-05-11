import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  householdInviteFindUnique: vi.fn(),
  householdInviteCreate: vi.fn(),
  householdInviteUpdate: vi.fn(),
  householdMemberFindFirst: vi.fn(),
  householdMemberFindMany: vi.fn(),
  householdMemberCreate: vi.fn(),
  householdMemberUpdate: vi.fn(),
  householdDelete: vi.fn(),
  transaction: vi.fn(),
}));

const schedulingMocks = vi.hoisted(() => ({
  syncHouseholdOccurrences: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    householdInvite: {
      findUnique: dbMocks.householdInviteFindUnique,
      create: dbMocks.householdInviteCreate,
      update: dbMocks.householdInviteUpdate,
    },
    householdMember: {
      findFirst: dbMocks.householdMemberFindFirst,
      findMany: dbMocks.householdMemberFindMany,
      create: dbMocks.householdMemberCreate,
      update: dbMocks.householdMemberUpdate,
    },
    household: {
      delete: dbMocks.householdDelete,
    },
    $transaction: dbMocks.transaction,
  },
}));

vi.mock("@/lib/scheduling/service", () => ({
  syncHouseholdOccurrences: schedulingMocks.syncHouseholdOccurrences,
}));

vi.mock("server-only", () => ({}));

import {
  acceptHouseholdInvite,
  deleteHousehold,
  getInviteState,
  leaveHousehold,
  pickNextMemberColor,
} from "@/lib/household-management";

describe("household management", () => {
  const futureInviteExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("picks the first unused palette color", () => {
    expect(pickNextMemberColor(["#C56A3A", "#B65766"])).toBe("#2E6D88");
  });

  it("accepts an active invite and creates a linked member", async () => {
    dbMocks.householdInviteFindUnique.mockResolvedValue({
      id: "invite-1",
      householdId: "house-1",
      role: "member",
      token: "token-1",
      code: "ABC12345",
      acceptedAt: null,
      revokedAt: null,
      expiresAt: futureInviteExpiry(),
      household: { id: "house-1", name: "Maison" },
      createdByMember: { id: "creator-1", displayName: "Pierre" },
    });
    dbMocks.householdMemberFindFirst.mockResolvedValueOnce(null);
    dbMocks.transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
    );

    const result = await acceptHouseholdInvite({
      inviteToken: "token-1",
      user: {
        id: "user-2",
        displayName: "Camille",
      },
    });

    expect(result.status).toBe("joined");
    expect(txMock.householdMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          householdId: "house-1",
          userId: "user-2",
          displayName: "Camille",
        }),
      }),
    );
    expect(txMock.householdInvite.update).toHaveBeenCalled();
    expect(schedulingMocks.syncHouseholdOccurrences).toHaveBeenCalledWith("house-1");
  });

  it("returns already_member when the user already belongs to the household", async () => {
    dbMocks.householdInviteFindUnique.mockResolvedValue({
      id: "invite-1",
      householdId: "house-1",
      role: "member",
      token: "token-1",
      code: "ABC12345",
      acceptedAt: null,
      revokedAt: null,
      expiresAt: futureInviteExpiry(),
      household: { id: "house-1", name: "Maison" },
      createdByMember: null,
    });
    dbMocks.householdMemberFindFirst.mockResolvedValue({
      id: "member-1",
      householdId: "house-1",
      userId: "user-2",
    });

    const result = await acceptHouseholdInvite({
      inviteToken: "token-1",
      user: {
        id: "user-2",
        displayName: "Camille",
      },
    });

    expect(result.status).toBe("already_member");
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });

  it("blocks leaving when the current account is the last manager", async () => {
    dbMocks.householdMemberFindFirst.mockResolvedValue({
      id: "member-1",
      householdId: "house-1",
      role: "owner",
      household: {
        members: [
          { id: "member-1", userId: "user-1", role: "owner" },
          { id: "member-2", userId: "user-2", role: "member" },
        ],
      },
    });

    const result = await leaveHousehold({
      householdId: "house-1",
      userId: "user-1",
    });

    expect(result.status).toBe("last_manager");
    expect(dbMocks.householdMemberUpdate).not.toHaveBeenCalled();
  });

  it("unlinks the account and resyncs the household on leave", async () => {
    dbMocks.householdMemberFindFirst
      .mockResolvedValueOnce({
        id: "member-1",
        householdId: "house-1",
        role: "member",
        household: {
          members: [
            { id: "member-1", userId: "user-1", role: "member" },
            { id: "member-2", userId: "user-2", role: "owner" },
          ],
        },
      })
      .mockResolvedValueOnce({
        householdId: "house-2",
      });

    const result = await leaveHousehold({
      householdId: "house-1",
      userId: "user-1",
    });

    expect(result.status).toBe("left");
    expect(dbMocks.householdMemberUpdate).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: {
        userId: null,
        isActive: false,
      },
    });
    expect(schedulingMocks.syncHouseholdOccurrences).toHaveBeenCalledWith("house-1");
    expect(result.nextHouseholdId).toBe("house-2");
  });

  it("classifies invite state correctly", () => {
    expect(getInviteState(null)).toBe("missing");
    expect(
      getInviteState({
        acceptedAt: null,
        revokedAt: null,
        expiresAt: futureInviteExpiry(),
      }),
    ).toBe("active");
    expect(
      getInviteState({
        acceptedAt: new Date(),
        revokedAt: null,
        expiresAt: new Date("2026-05-01T00:00:00Z"),
      }),
    ).toBe("used");
  });

  it("deletes household when requester is owner", async () => {
    dbMocks.householdMemberFindFirst
      .mockResolvedValueOnce({
        id: "member-owner",
        role: "owner",
      })
      .mockResolvedValueOnce({
        householdId: "house-2",
      });

    const result = await deleteHousehold({
      householdId: "house-1",
      userId: "user-1",
    });

    expect(dbMocks.householdDelete).toHaveBeenCalledWith({
      where: {
        id: "house-1",
      },
    });
    expect(result).toEqual({
      status: "deleted",
      nextHouseholdId: "house-2",
    });
  });
});

const txMock = {
  householdMember: {
    findMany: vi.fn().mockResolvedValue([{ color: "#E86A33" }]),
    create: vi.fn().mockResolvedValue({ id: "member-2", householdId: "house-1", userId: "user-2" }),
  },
  householdInvite: {
    update: vi.fn().mockResolvedValue({ id: "invite-1" }),
  },
};
