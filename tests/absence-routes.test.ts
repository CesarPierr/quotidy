import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  householdMemberFindUnique: vi.fn(),
  householdMemberFindFirst: vi.fn(),
  memberAvailabilityCreate: vi.fn(),
  memberAvailabilityFindUnique: vi.fn(),
  memberAvailabilityDelete: vi.fn(),
}));

const schedulingMocks = vi.hoisted(() => ({
  syncHouseholdOccurrences: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: authMocks.requireUser,
}));

vi.mock("@/lib/db", () => ({
  db: {
    householdMember: {
      findUnique: dbMocks.householdMemberFindUnique,
      findFirst: dbMocks.householdMemberFindFirst,
    },
    memberAvailability: {
      create: dbMocks.memberAvailabilityCreate,
      findUnique: dbMocks.memberAvailabilityFindUnique,
      delete: dbMocks.memberAvailabilityDelete,
    },
  },
}));

vi.mock("@/lib/scheduling/service", () => ({
  syncHouseholdOccurrences: schedulingMocks.syncHouseholdOccurrences,
}));

import { POST as createAbsencePost } from "@/app/api/members/absence/route";
import { POST as deleteAbsencePost } from "@/app/api/members/absence/[absenceId]/delete/route";

function buildFormRequest(url: string, fields: Record<string, string>) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("absence routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireUser.mockResolvedValue({ id: "user-1" });
    schedulingMocks.syncHouseholdOccurrences.mockResolvedValue(undefined);
    process.env.APP_BASE_URL = "http://192.168.1.132";
  });

  it("creates an absence, recalculates future tasks, and redirects to planning", async () => {
    dbMocks.householdMemberFindUnique.mockResolvedValue({
      id: "member-1",
      householdId: "house-1",
    });
    dbMocks.householdMemberFindFirst.mockResolvedValue({
      id: "manager-1",
      householdId: "house-1",
      role: "admin",
      userId: "user-1",
    });
    dbMocks.memberAvailabilityCreate.mockResolvedValue({ id: "absence-1" });

    const response = await createAbsencePost(
      buildFormRequest("http://localhost:3000/api/members/absence", {
        householdId: "house-1",
        memberId: "cmember0000000000000000001",
        startDate: "2026-04-25",
        endDate: "2026-04-27",
        notes: "Vacances",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://192.168.1.132/app/taches/disponibilites?household=house-1&absence=saved",
    );
    expect(dbMocks.memberAvailabilityCreate).toHaveBeenCalled();
    expect(schedulingMocks.syncHouseholdOccurrences).toHaveBeenCalledWith("house-1", {
      forceOverwriteManual: true,
    });
  });

  it("keeps the planning panel context when absence validation fails", async () => {
    const response = await createAbsencePost(
      buildFormRequest("http://localhost:3000/api/members/absence", {
        householdId: "house-1",
        memberId: "not-a-cuid",
        startDate: "2026-04-27",
        endDate: "2026-04-25",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://192.168.1.132/app/taches/disponibilites?household=house-1&absence=invalid",
    );
    expect(dbMocks.memberAvailabilityCreate).not.toHaveBeenCalled();
  });

  it("deletes an absence and recalculates future tasks", async () => {
    dbMocks.memberAvailabilityFindUnique.mockResolvedValue({
      id: "absence-1",
      type: "date_range_absence",
      member: {
        householdId: "house-1",
      },
    });
    dbMocks.householdMemberFindFirst.mockResolvedValue({
      id: "manager-1",
      householdId: "house-1",
      role: "owner",
      userId: "user-1",
    });
    dbMocks.memberAvailabilityDelete.mockResolvedValue({ id: "absence-1" });

    const response = await deleteAbsencePost(
      new Request("http://localhost:3000/api/members/absence/absence-1/delete", { method: "POST" }),
      { params: Promise.resolve({ absenceId: "absence-1" }) },
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://192.168.1.132/app/taches/disponibilites?household=house-1&absence=removed",
    );
    expect(dbMocks.memberAvailabilityDelete).toHaveBeenCalledWith({
      where: { id: "absence-1" },
    });
    expect(schedulingMocks.syncHouseholdOccurrences).toHaveBeenCalledWith("house-1", {
      forceOverwriteManual: true,
    });
  });
});
