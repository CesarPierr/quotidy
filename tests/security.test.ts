import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMocks = vi.hoisted(() => ({ requireUser: vi.fn() }));
const dbMocks = vi.hoisted(() => ({ householdMemberFindFirst: vi.fn() }));
const loggerMocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireUser: authMocks.requireUser }));
vi.mock("@/lib/db", () => ({
  db: {
    householdMember: { findFirst: dbMocks.householdMemberFindFirst },
  },
}));
vi.mock("@/lib/logger", () => loggerMocks);

import { generateIcalToken, verifyIcalToken } from "@/lib/ical-token";
import { canManageHousehold } from "@/lib/households";
import { withHousehold } from "@/lib/api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("security · canManageHousehold", () => {
  it("admin and owner can manage", () => {
    expect(canManageHousehold("admin")).toBe(true);
    expect(canManageHousehold("owner")).toBe(true);
  });

  it("member and unknown roles cannot manage", () => {
    expect(canManageHousehold("member")).toBe(false);
    expect(canManageHousehold("guest")).toBe(false);
    expect(canManageHousehold("")).toBe(false);
    // Reject case mismatches — defense in depth.
    expect(canManageHousehold("Owner")).toBe(false);
    expect(canManageHousehold("ADMIN")).toBe(false);
  });
});

describe("security · iCal token tampering", () => {
  it("rejects a token whose payload was swapped to another household", () => {
    const real = generateIcalToken("house-A");
    const sig = real.split(".")[1]!;
    const otherEncoded = Buffer.from("house-B").toString("base64url");
    const forged = `${otherEncoded}.${sig}`;
    expect(verifyIcalToken(forged)).toBeNull();
  });

  it("rejects a token whose signature was truncated", () => {
    const real = generateIcalToken("house-A", "member-1");
    const truncated = real.slice(0, real.length - 4);
    expect(verifyIcalToken(truncated)).toBeNull();
  });

  it("rejects a member-scoped token if the member id is forged into a household-scope position", () => {
    // Build a payload that tries to inject a colon, e.g. attacker writes "victim:admin"
    // as householdId, hoping the splitter mistakes it for member access.
    const payload = "victim:admin:extra";
    const encoded = Buffer.from(payload).toString("base64url");
    const real = generateIcalToken("victim", "admin");
    const sig = real.split(".")[1]!;
    expect(verifyIcalToken(`${encoded}.${sig}`)).toBeNull();
  });

  it("rejects a token built with a known-bad signature", () => {
    expect(verifyIcalToken("YWJjZA.deadbeef")).toBeNull();
  });

  it("round-trips legitimate household-only and member-scoped tokens", () => {
    expect(verifyIcalToken(generateIcalToken("h1"))).toEqual({
      householdId: "h1",
      memberId: undefined,
    });
    expect(verifyIcalToken(generateIcalToken("h1", "m1"))).toEqual({
      householdId: "h1",
      memberId: "m1",
    });
  });
});

describe("security · withHousehold cross-household access", () => {
  function makeRequest(formEntries: Record<string, string> = {}) {
    const body = new URLSearchParams(formEntries).toString();
    return new Request("http://localhost/api/households/target/test", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html" },
      body,
    });
  }

  it("returns 403 redirect when the user has no membership in the requested household", async () => {
    authMocks.requireUser.mockResolvedValue({ id: "u-attacker" });
    dbMocks.householdMemberFindFirst.mockResolvedValue(null);

    const handler = vi.fn();
    const wrapped = withHousehold<{ id: string }>(handler);

    const res = (await wrapped(makeRequest(), { params: Promise.resolve({ id: "h-victim" }) })) as Response;

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
    // Membership lookup must scope to BOTH userId and householdId — never to userId alone.
    const where = dbMocks.householdMemberFindFirst.mock.calls[0]![0]!.where;
    expect(where).toMatchObject({ userId: "u-attacker", householdId: "h-victim" });
  });

  it("invokes the handler when the user is a member", async () => {
    authMocks.requireUser.mockResolvedValue({ id: "u-legit" });
    const membership = { id: "mem-1", role: "member", userId: "u-legit", householdId: "h-mine" };
    dbMocks.householdMemberFindFirst.mockResolvedValue(membership);

    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withHousehold<{ id: string }>(handler);

    const res = (await wrapped(makeRequest(), { params: Promise.resolve({ id: "h-mine" }) })) as Response;

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res).toBeInstanceOf(Response);
    const ctx = handler.mock.calls[0]![0]! as { membership: typeof membership; canManage: boolean };
    expect(ctx.membership).toBe(membership);
    expect(ctx.canManage).toBe(false);
  });
});

describe("security · withHousehold role escalation", () => {
  function makeRequest() {
    return new Request("http://localhost/api/households/h1/admin-only", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html" },
      body: "",
    });
  }

  it("blocks a plain member when requireManage is set", async () => {
    authMocks.requireUser.mockResolvedValue({ id: "u-1" });
    dbMocks.householdMemberFindFirst.mockResolvedValue({ id: "m1", role: "member", userId: "u-1", householdId: "h1" });

    const handler = vi.fn();
    const wrapped = withHousehold<{ id: string }>(handler, { requireManage: true });

    const res = (await wrapped(makeRequest(), { params: Promise.resolve({ id: "h1" }) })) as Response;

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
  });

  it("permits an admin when requireManage is set", async () => {
    authMocks.requireUser.mockResolvedValue({ id: "u-2" });
    dbMocks.householdMemberFindFirst.mockResolvedValue({ id: "m2", role: "admin", userId: "u-2", householdId: "h1" });

    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withHousehold<{ id: string }>(handler, { requireManage: true });

    await wrapped(makeRequest(), { params: Promise.resolve({ id: "h1" }) });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("permits an owner when requireManage is set", async () => {
    authMocks.requireUser.mockResolvedValue({ id: "u-3" });
    dbMocks.householdMemberFindFirst.mockResolvedValue({ id: "m3", role: "owner", userId: "u-3", householdId: "h1" });

    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withHousehold<{ id: string }>(handler, { requireManage: true });

    await wrapped(makeRequest(), { params: Promise.resolve({ id: "h1" }) });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects a request that omits the household id entirely", async () => {
    authMocks.requireUser.mockResolvedValue({ id: "u-1" });

    const handler = vi.fn();
    const wrapped = withHousehold<{ id?: string }>(handler);

    const res = (await wrapped(makeRequest(), { params: Promise.resolve({}) })) as Response;

    expect(handler).not.toHaveBeenCalled();
    expect(dbMocks.householdMemberFindFirst).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
  });
});
