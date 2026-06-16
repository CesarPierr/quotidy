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
    household: { findFirst: vi.fn(), update: vi.fn() },
    householdMember: { findFirst: vi.fn() },
    householdNote: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/households/[id]/notes/route";
import { POST as NOTE_POST } from "@/app/api/households/[id]/notes/[noteId]/route";

const mockUser = { id: "user-1" };
const membership = { id: "m-1", userId: "user-1", householdId: "h-1", role: "member" };

function fetchReq(url: string, formData?: FormData) {
  return new NextRequest(url, {
    method: "POST",
    body: formData ?? new FormData(),
    headers: { "x-requested-with": "fetch" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(mockUser as never);
  vi.mocked(db.householdMember.findFirst).mockResolvedValue(membership as never);
  vi.mocked(db.householdNote.deleteMany).mockResolvedValue({ count: 0 } as never);
});

describe("GET /api/households/[id]/notes", () => {
  it("returns 403 when the user is not a member", async () => {
    vi.mocked(db.household.findFirst).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/households/h-1/notes");
    const res = await GET(req, { params: Promise.resolve({ id: "h-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns active, done and retentionDays", async () => {
    vi.mocked(db.household.findFirst).mockResolvedValue({ noteRetentionDays: 7 } as never);
    vi.mocked(db.householdNote.findMany).mockResolvedValue([
      {
        id: "n-1", title: null, body: "Café", color: "#D8643D", isPinned: false, sortOrder: 0,
        completedAt: null, createdAt: new Date(), createdByMember: null, completedByMember: null,
      },
      {
        id: "n-2", title: null, body: "Plombier", color: "#D8643D", isPinned: false, sortOrder: 0,
        completedAt: new Date(), createdAt: new Date(), createdByMember: null, completedByMember: { displayName: "Léa" },
      },
    ] as never);

    const req = new NextRequest("http://localhost/api/households/h-1/notes");
    const res = await GET(req, { params: Promise.resolve({ id: "h-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.retentionDays).toBe(7);
    expect(data.active).toHaveLength(1);
    expect(data.done).toHaveLength(1);
    expect(data.active[0].body).toBe("Café");
  });
});

describe("POST /api/households/[id]/notes", () => {
  it("returns 400 when body is empty", async () => {
    const res = await POST(fetchReq("http://localhost/api/households/h-1/notes"), {
      params: Promise.resolve({ id: "h-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates a note scoped to the household and current member", async () => {
    vi.mocked(db.householdNote.create).mockResolvedValue({
      id: "n-9", title: null, body: "Acheter du pain", color: "#D8643D", isPinned: false,
      sortOrder: 0, completedAt: null, createdAt: new Date(), createdByMember: { displayName: "Pierre" }, completedByMember: null,
    } as never);

    const fd = new FormData();
    fd.set("body", "Acheter du pain");
    const res = await POST(fetchReq("http://localhost/api/households/h-1/notes", fd), {
      params: Promise.resolve({ id: "h-1" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.note.body).toBe("Acheter du pain");
    const createArg = vi.mocked(db.householdNote.create).mock.calls[0][0];
    expect(createArg.data.householdId).toBe("h-1");
    expect(createArg.data.createdByMemberId).toBe("m-1");
  });

  it("updates the retention window via _action=retention", async () => {
    vi.mocked(db.household.update).mockResolvedValue({} as never);
    const fd = new FormData();
    fd.set("_action", "retention");
    fd.set("noteRetentionDays", "14");
    const res = await POST(fetchReq("http://localhost/api/households/h-1/notes", fd), {
      params: Promise.resolve({ id: "h-1" }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(db.household.update).mock.calls[0][0].data.noteRetentionDays).toBe(14);
  });
});

describe("POST /api/households/[id]/notes/[noteId]", () => {
  it("returns 404 when the note belongs to another household (IDOR guard)", async () => {
    vi.mocked(db.householdNote.findFirst).mockResolvedValue(null);
    const fd = new FormData();
    fd.set("_action", "complete");
    const res = await NOTE_POST(fetchReq("http://localhost/api/households/h-1/notes/n-x", fd), {
      params: Promise.resolve({ id: "h-1", noteId: "n-x" }),
    });
    expect(res.status).toBe(404);
    // findFirst must be scoped by householdId
    expect(vi.mocked(db.householdNote.findFirst).mock.calls[0][0]!.where).toMatchObject({
      id: "n-x",
      householdId: "h-1",
    });
  });

  it("completes a note: sets completedAt + completedByMemberId", async () => {
    vi.mocked(db.householdNote.findFirst).mockResolvedValue({ id: "n-1", householdId: "h-1", isPinned: true } as never);
    vi.mocked(db.householdNote.update).mockResolvedValue({
      id: "n-1", title: null, body: "Café", color: "#D8643D", isPinned: false, sortOrder: 0,
      completedAt: new Date(), createdAt: new Date(), createdByMember: null, completedByMember: { displayName: "Pierre" },
    } as never);

    const fd = new FormData();
    fd.set("_action", "complete");
    const res = await NOTE_POST(fetchReq("http://localhost/api/households/h-1/notes/n-1", fd), {
      params: Promise.resolve({ id: "h-1", noteId: "n-1" }),
    });
    expect(res.status).toBe(200);
    const updateArg = vi.mocked(db.householdNote.update).mock.calls[0][0];
    expect(updateArg.data.completedByMemberId).toBe("m-1");
    expect(updateArg.data.completedAt).toBeInstanceOf(Date);
  });
});
