import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateIcalToken, verifyIcalToken } from "@/lib/ical-token";

describe("ical token", () => {
  it("round-trips household and member scopes", () => {
    const token = generateIcalToken("house-1", "member-1");

    expect(verifyIcalToken(token)).toEqual({
      householdId: "house-1",
      memberId: "member-1",
    });
  });

  it("rejects malformed signatures without throwing", () => {
    expect(verifyIcalToken("abc.short")).toBeNull();
    expect(verifyIcalToken("no-dot-token")).toBeNull();
  });
});
