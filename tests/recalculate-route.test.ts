import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  householdMemberFindFirst: vi.fn(),
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
      findFirst: dbMocks.householdMemberFindFirst,
    },
  },
}));

vi.mock("@/lib/scheduling/service", () => ({
  syncHouseholdOccurrences: schedulingMocks.syncHouseholdOccurrences,
}));

import { POST as recalculatePost } from "@/app/api/households/[id]/recalculate/route";

function buildFormRequest(url: string, fields: Record<string, string>) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("recalculate route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireUser.mockResolvedValue({ id: "user-1" });
    dbMocks.householdMemberFindFirst.mockResolvedValue({
      id: "manager-1",
      householdId: "house-1",
      role: "admin",
    });
    schedulingMocks.syncHouseholdOccurrences.mockResolvedValue(undefined);
    process.env.APP_BASE_URL = "http://192.168.1.132";
  });

  it("reports skipped load into the next rotation when carry_over is selected", async () => {
    const response = await recalculatePost(
      buildFormRequest("http://localhost:3000/api/households/house-1/recalculate", {
        skipLoadPolicy: "carry_over",
      }),
      { params: Promise.resolve({ id: "house-1" }) },
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://192.168.1.132/app/taches/disponibilites?household=house-1&rebalance=done",
    );
    expect(schedulingMocks.syncHouseholdOccurrences).toHaveBeenCalledWith("house-1", {
      forceOverwriteManual: false,
      preserveRotationOnSkipOverride: false,
    });
  });

  it("resets to the normal rotation when no_carry_over is selected", async () => {
    await recalculatePost(
      buildFormRequest("http://localhost:3000/api/households/house-1/recalculate", {
        skipLoadPolicy: "no_carry_over",
        forceOverwriteManual: "on",
      }),
      { params: Promise.resolve({ id: "house-1" }) },
    );

    expect(schedulingMocks.syncHouseholdOccurrences).toHaveBeenCalledWith("house-1", {
      forceOverwriteManual: true,
      preserveRotationOnSkipOverride: true,
    });
  });
});
