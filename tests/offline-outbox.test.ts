// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  allEntries,
  enqueue,
  flushOutbox,
  pendingCount,
  removeEntry,
  type OutboxEntry,
} from "@/lib/offline-outbox";
import { postForm } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({ postForm: vi.fn() }));

const url = "/api/households/h-1/budget";

function makeEntry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    id: "e-1",
    url,
    fields: { _action: "expense.create", amount: "12", id: "e-1" },
    label: "Dépense",
    createdAt: 1000,
    ...overrides,
  };
}

/** Delete the real IndexedDB database so each test starts empty. */
function resetDb(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase("quotidy-offline");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDb();
});

afterEach(async () => {
  await resetDb();
});

describe("offline-outbox", () => {
  test("enqueue then allEntries returns the entry", async () => {
    const entry = makeEntry();
    await enqueue(entry);

    const all = await allEntries();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(entry);
  });

  test("multiple entries come back oldest-first by createdAt", async () => {
    await enqueue(makeEntry({ id: "b", createdAt: 3000 }));
    await enqueue(makeEntry({ id: "a", createdAt: 1000 }));
    await enqueue(makeEntry({ id: "c", createdAt: 2000 }));

    const all = await allEntries();
    expect(all.map((e) => e.id)).toEqual(["a", "c", "b"]);
  });

  test("removeEntry removes a single entry", async () => {
    await enqueue(makeEntry({ id: "a", createdAt: 1000 }));
    await enqueue(makeEntry({ id: "b", createdAt: 2000 }));

    await removeEntry("a");

    const all = await allEntries();
    expect(all.map((e) => e.id)).toEqual(["b"]);
  });

  test("pendingCount reflects the store size", async () => {
    expect(await pendingCount()).toBe(0);
    await enqueue(makeEntry({ id: "a", createdAt: 1000 }));
    expect(await pendingCount()).toBe(1);
    await enqueue(makeEntry({ id: "b", createdAt: 2000 }));
    expect(await pendingCount()).toBe(2);
    await removeEntry("a");
    expect(await pendingCount()).toBe(1);
  });

  test("flushOutbox posts each entry in order, removes on success, returns flushed count", async () => {
    vi.mocked(postForm).mockResolvedValue({} as Response);
    await enqueue(makeEntry({ id: "a", createdAt: 1000, fields: { amount: "1", id: "a" } }));
    await enqueue(makeEntry({ id: "b", createdAt: 2000, fields: { amount: "2", id: "b" } }));
    await enqueue(makeEntry({ id: "c", createdAt: 3000, fields: { amount: "3", id: "c" } }));

    const flushed = await flushOutbox();

    expect(flushed).toBe(3);
    expect(vi.mocked(postForm)).toHaveBeenCalledTimes(3);
    // Oldest-first replay order.
    expect(vi.mocked(postForm).mock.calls.map((c) => (c[1] as { id: string }).id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(await pendingCount()).toBe(0);
  });

  test("flushOutbox stops at the first failure and keeps that entry plus the rest", async () => {
    vi.mocked(postForm)
      .mockResolvedValueOnce({} as Response) // a succeeds
      .mockRejectedValueOnce(new Error("network")) // b fails -> stop
      .mockResolvedValue({} as Response);
    await enqueue(makeEntry({ id: "a", createdAt: 1000, fields: { id: "a" } }));
    await enqueue(makeEntry({ id: "b", createdAt: 2000, fields: { id: "b" } }));
    await enqueue(makeEntry({ id: "c", createdAt: 3000, fields: { id: "c" } }));

    const flushed = await flushOutbox();

    expect(flushed).toBe(1);
    // Only a + b were attempted before the stop; c was never posted.
    expect(vi.mocked(postForm)).toHaveBeenCalledTimes(2);
    // a removed; b (failed) and c (untouched) remain queued.
    expect(await pendingCount()).toBe(2);
    const remaining = await allEntries();
    expect(remaining.map((e) => e.id)).toEqual(["b", "c"]);
  });

  test("enqueue with an existing id overwrites (idempotent)", async () => {
    await enqueue(makeEntry({ id: "dup", createdAt: 1000, fields: { amount: "1", id: "dup" } }));
    await enqueue(makeEntry({ id: "dup", createdAt: 1000, fields: { amount: "99", id: "dup" } }));

    expect(await pendingCount()).toBe(1);
    const all = await allEntries();
    expect(all).toHaveLength(1);
    expect(all[0].fields.amount).toBe("99");
  });
});
