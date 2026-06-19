"use client";

import { postForm } from "@/lib/api-client";

/**
 * Tiny IndexedDB outbox for mutations made while offline. The app enqueues a
 * FormData-style POST; on reconnect they are replayed in order. Server handlers
 * for queued actions must be idempotent (e.g. expense.create upserts by a
 * client-provided id), so a double-send is harmless.
 */
export type OutboxEntry = {
  id: string;
  url: string;
  fields: Record<string, string>;
  label: string;
  createdAt: number;
};

const DB_NAME = "quotidy-offline";
const STORE = "outbox";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        // Close the connection once the transaction settles so it never lingers
        // (lingering handles block deleteDatabase and leak across the app's life).
        tx.oncomplete = () => db.close();
        tx.onabort = () => db.close();
      }),
  );
}

export async function enqueue(entry: OutboxEntry): Promise<void> {
  await run("readwrite", (s) => s.put(entry));
}

export async function allEntries(): Promise<OutboxEntry[]> {
  const items = await run<OutboxEntry[]>("readonly", (s) => s.getAll() as IDBRequest<OutboxEntry[]>);
  return [...items].sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeEntry(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}

export async function pendingCount(): Promise<number> {
  try {
    return await run<number>("readonly", (s) => s.count());
  } catch {
    return 0;
  }
}

/**
 * Replay queued mutations oldest-first. Stops at the first failure (still
 * offline / server error) and keeps the rest for the next attempt. Returns how
 * many were flushed.
 */
export async function flushOutbox(): Promise<number> {
  let entries: OutboxEntry[];
  try {
    entries = await allEntries();
  } catch {
    return 0;
  }
  let flushed = 0;
  for (const entry of entries) {
    try {
      await postForm(entry.url, entry.fields);
      await removeEntry(entry.id);
      flushed += 1;
    } catch {
      break;
    }
  }
  return flushed;
}
