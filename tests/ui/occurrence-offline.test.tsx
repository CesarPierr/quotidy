// @vitest-environment jsdom
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { render } from "../test-utils";
import { OccurrenceCard } from "@/components/tasks/occurrence-card";
import { enqueue } from "@/lib/offline-outbox";

// OccurrenceCard calls useRouter().refresh on the online path — keep an explicit,
// scoped mock so the router methods exist as spies.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
// Keep the real buildEntry/newOutboxId (the card uses buildEntry); mock only enqueue.
vi.mock("@/lib/offline-outbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/offline-outbox")>()),
  enqueue: vi.fn().mockResolvedValue(undefined),
}));

function makeOccurrence() {
  return {
    occurrence: {
      id: "occ1",
      scheduledDate: new Date(),
      status: "planned",
      notes: null,
      actualMinutes: null,
      taskTemplate: {
        title: "Sortir la poubelle",
        category: null,
        estimatedMinutes: 10,
        color: "#D8643D",
      },
      assignedMember: null,
    },
    members: [] as { id: string; displayName: string }[],
    currentMemberId: "m1",
  };
}

const COMPLETE_LABEL = 'Marquer "Sortir la poubelle" comme terminée';

/** Put navigator into the offline state and broadcast it (the card reads both
 *  the useOnline hook value and navigator.onLine directly). */
function goOffline() {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  act(() => {
    window.dispatchEvent(new Event("offline"));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

describe("OccurrenceCard offline", () => {
  test("completing offline queues the action, never hits the network, and persists the completed state", async () => {
    const user = userEvent.setup();
    render(<OccurrenceCard {...makeOccurrence()} />);
    goOffline();

    await user.click(screen.getByRole("button", { name: COMPLETE_LABEL }));

    // Queued exactly once to the /complete URL — not sent over the network.
    expect(vi.mocked(enqueue)).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(enqueue).mock.calls[0][0];
    expect(entry.url.endsWith("/complete")).toBe(true);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    // The completed state persists (offlineStatus="completed" → getStatusMeta label "Terminée").
    await waitFor(() => expect(screen.getAllByText("Terminée").length).toBeGreaterThan(0));
    // Archived card now offers "Remettre à faire" rather than "Terminer".
    expect(screen.getAllByRole("button", { name: /Remettre à faire/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: COMPLETE_LABEL })).not.toBeInTheDocument();
  });

  test("completing online posts to the /complete endpoint and does not queue", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);

    render(<OccurrenceCard {...makeOccurrence()} />);
    // navigator.onLine stays true; no offline event dispatched.

    await user.click(screen.getByRole("button", { name: COMPLETE_LABEL }));

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl.endsWith("/complete")).toBe(true);
    expect(vi.mocked(enqueue)).not.toHaveBeenCalled();
  });
});
