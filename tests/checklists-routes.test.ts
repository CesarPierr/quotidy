import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/households", () => ({
  canManageHousehold: (role: string) => role === "admin" || role === "owner",
}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    householdMember: { findFirst: vi.fn() },
    taskTemplate: { findFirst: vi.fn() },
    checklist: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    checklistItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((arg) => Promise.resolve(arg)),
  },
}));

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { POST as CREATE } from "@/app/api/households/[id]/checklists/route";
import { POST as ITEM_CREATE } from "@/app/api/households/[id]/checklists/[checklistId]/items/route";
import { POST as ITEM_ACTION } from "@/app/api/households/[id]/checklists/[checklistId]/items/[itemId]/route";

const mockUser = { id: "user-1" };
const membership = { id: "m-1", userId: "user-1", householdId: "h-1", role: "member" };

const serializableChecklist = {
  id: "c-1", name: "Trek", icon: null, color: "#D8643D", sortOrder: 0,
  taskTemplateId: null, taskTemplate: null, items: [],
};

function fetchReq(url: string, formData: FormData) {
  return new NextRequest(url, {
    method: "POST",
    body: formData,
    headers: { "x-requested-with": "fetch" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(mockUser as never);
  vi.mocked(db.householdMember.findFirst).mockResolvedValue(membership as never);
});

describe("POST /api/households/[id]/checklists", () => {
  it("creates a checklist with sortOrder = max+1", async () => {
    vi.mocked(db.checklist.findFirst).mockResolvedValue({ sortOrder: 4 } as never);
    vi.mocked(db.checklist.create).mockResolvedValue(serializableChecklist as never);

    const fd = new FormData();
    fd.set("name", "Trek");
    const res = await CREATE(fetchReq("http://localhost/api/households/h-1/checklists", fd), {
      params: Promise.resolve({ id: "h-1" }),
    });
    expect(res.status).toBe(200);
    const createArg = vi.mocked(db.checklist.create).mock.calls[0][0];
    expect(createArg.data.householdId).toBe("h-1");
    expect(createArg.data.sortOrder).toBe(5);
  });

  it("rejects a task link that does not belong to the household (400)", async () => {
    vi.mocked(db.taskTemplate.findFirst).mockResolvedValue(null);
    const fd = new FormData();
    fd.set("name", "Trek");
    fd.set("taskTemplateId", "ckxotherhousehold0000000000");
    const res = await CREATE(fetchReq("http://localhost/api/households/h-1/checklists", fd), {
      params: Promise.resolve({ id: "h-1" }),
    });
    expect(res.status).toBe(400);
    expect(vi.mocked(db.checklist.create)).not.toHaveBeenCalled();
  });
});

describe("POST /api/households/[id]/checklists/[checklistId]/items", () => {
  it("returns 404 when the checklist is not in the household (IDOR guard)", async () => {
    vi.mocked(db.checklist.findFirst).mockResolvedValue(null);
    const fd = new FormData();
    fd.set("label", "Chaussettes");
    const res = await ITEM_CREATE(fetchReq("http://localhost/api/households/h-1/checklists/c-x/items", fd), {
      params: Promise.resolve({ id: "h-1", checklistId: "c-x" }),
    });
    expect(res.status).toBe(404);
  });

  it("creates an item and returns the refreshed checklist", async () => {
    vi.mocked(db.checklist.findFirst).mockResolvedValue({ id: "c-1" } as never);
    vi.mocked(db.checklistItem.findFirst).mockResolvedValue({ sortOrder: 1 } as never);
    vi.mocked(db.checklistItem.create).mockResolvedValue({} as never);
    vi.mocked(db.checklist.findUniqueOrThrow).mockResolvedValue({
      ...serializableChecklist,
      items: [{ id: "i-1", label: "Chaussettes", isChecked: false, sortOrder: 2 }],
    } as never);

    const fd = new FormData();
    fd.set("label", "Chaussettes");
    const res = await ITEM_CREATE(fetchReq("http://localhost/api/households/h-1/checklists/c-1/items", fd), {
      params: Promise.resolve({ id: "h-1", checklistId: "c-1" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.checklist.items[0].label).toBe("Chaussettes");
    expect(vi.mocked(db.checklistItem.create).mock.calls[0][0].data.sortOrder).toBe(2);
  });
});

describe("POST /api/households/[id]/checklists/[checklistId]/items/[itemId]", () => {
  it("returns 404 when the item is not reachable from the household (IDOR guard)", async () => {
    vi.mocked(db.checklistItem.findFirst).mockResolvedValue(null);
    const fd = new FormData();
    fd.set("_action", "toggle");
    const res = await ITEM_ACTION(fetchReq("http://localhost/api/households/h-1/checklists/c-1/items/i-x", fd), {
      params: Promise.resolve({ id: "h-1", checklistId: "c-1", itemId: "i-x" }),
    });
    expect(res.status).toBe(404);
    // The lookup must be scoped through checklist + household.
    expect(vi.mocked(db.checklistItem.findFirst).mock.calls[0][0]!.where).toMatchObject({
      id: "i-x",
      checklistId: "c-1",
      checklist: { householdId: "h-1" },
    });
  });

  it("toggles an unchecked item to checked and records the member", async () => {
    vi.mocked(db.checklistItem.findFirst).mockResolvedValue({ id: "i-1", isChecked: false } as never);
    vi.mocked(db.checklistItem.update).mockResolvedValue({} as never);
    vi.mocked(db.checklist.findUniqueOrThrow).mockResolvedValue(serializableChecklist as never);

    const fd = new FormData();
    fd.set("_action", "toggle");
    const res = await ITEM_ACTION(fetchReq("http://localhost/api/households/h-1/checklists/c-1/items/i-1", fd), {
      params: Promise.resolve({ id: "h-1", checklistId: "c-1", itemId: "i-1" }),
    });
    expect(res.status).toBe(200);
    const updateArg = vi.mocked(db.checklistItem.update).mock.calls[0][0];
    expect(updateArg.data.isChecked).toBe(true);
    expect(updateArg.data.checkedByMemberId).toBe("m-1");
  });

  it("does not swap when moving the first item up (boundary)", async () => {
    vi.mocked(db.checklistItem.findFirst).mockResolvedValue({ id: "i-1", isChecked: false } as never);
    vi.mocked(db.checklistItem.findMany).mockResolvedValue([
      { id: "i-1", sortOrder: 0 },
      { id: "i-2", sortOrder: 1 },
    ] as never);
    vi.mocked(db.checklist.findUniqueOrThrow).mockResolvedValue(serializableChecklist as never);

    const fd = new FormData();
    fd.set("_action", "move");
    fd.set("direction", "up");
    const res = await ITEM_ACTION(fetchReq("http://localhost/api/households/h-1/checklists/c-1/items/i-1", fd), {
      params: Promise.resolve({ id: "h-1", checklistId: "c-1", itemId: "i-1" }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(db.$transaction)).not.toHaveBeenCalled();
  });
});
