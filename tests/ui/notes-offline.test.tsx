// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { render } from "../test-utils";
import { NotesBoard } from "@/components/aide-memoire/notes-board";
import { enqueue } from "@/lib/offline-outbox";
import { postForm } from "@/lib/api-client";
import type { SerializedNote } from "@/lib/aide-memoire";

// next/navigation is mocked globally in test-utils, but keep an explicit scoped
// mock so the router methods exist for any child that reads them.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
// Keep the real buildEntry/newOutboxId (notes-board uses them); mock only enqueue.
vi.mock("@/lib/offline-outbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/offline-outbox")>()),
  enqueue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api-client", () => ({ postForm: vi.fn() }));

function makeActiveNote(): SerializedNote {
  return {
    id: "n1",
    title: null,
    body: "Acheter du pain",
    color: "#D8643D",
    isPinned: false,
    sortOrder: 0,
    completedAt: null,
    createdAt: new Date().toISOString(),
    createdByName: null,
    completedByName: null,
  };
}

function renderBoard() {
  return render(
    <NotesBoard
      householdId="h1"
      initialActive={[makeActiveNote()]}
      initialDone={[]}
      retentionDays={7}
    />,
  );
}

/** Put navigator into the offline state and broadcast it (NotesBoard reads
 *  both the useOnline hook value and navigator.onLine directly). */
function goOffline() {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  act(() => {
    window.dispatchEvent(new Event("offline"));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

afterEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

describe("NotesBoard offline", () => {
  test("quick-add offline — queued + optimistic, no postForm", async () => {
    const user = userEvent.setup();
    renderBoard();
    goOffline();

    await user.type(screen.getByLabelText("Nouvelle note"), "Sortir les poubelles");
    await user.click(screen.getByRole("button", { name: "Ajouter la note" }));

    // Queued to the outbox, NOT sent over the network.
    expect(vi.mocked(enqueue)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(postForm)).not.toHaveBeenCalled();

    // The typed note shows optimistically in the active list.
    const activeList = screen.getByRole("list", { name: "Notes à traiter" });
    await waitFor(() =>
      expect(within(activeList).getByText("Sortir les poubelles")).toBeInTheDocument(),
    );
  });

  test("complete offline — queued with _action 'complete', note leaves active list", async () => {
    const user = userEvent.setup();
    renderBoard();
    goOffline();

    // The seed note starts under "Notes à traiter".
    const activeList = screen.getByRole("list", { name: "Notes à traiter" });
    expect(within(activeList).getByText("Acheter du pain")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Marquer comme fait" }));

    expect(vi.mocked(enqueue)).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(enqueue).mock.calls[0][0];
    expect(entry.fields._action).toBe("complete");
    expect(vi.mocked(postForm)).not.toHaveBeenCalled();

    // The note has moved to the "Fait" panel and out of the active list.
    await waitFor(() => expect(screen.getByRole("button", { name: /Fait \(1\)/ })).toBeInTheDocument());
    expect(screen.queryByRole("list", { name: "Notes à traiter" })).not.toBeInTheDocument();
  });

  test("delete offline — blocked with error toast, no postForm", async () => {
    const user = userEvent.setup();
    renderBoard();
    goOffline();

    // Open the per-note options sheet, then tap its "Supprimer" action.
    await user.click(screen.getByRole("button", { name: "Options de la note" }));
    await user.click(await screen.findByRole("button", { name: "Supprimer" }));

    // Confirm in the delete dialog. Scope to the dialog whose heading is the
    // delete confirmation so we don't pick up the (animating-out) sheet action.
    const dialog = (await screen.findByRole("heading", { name: "Supprimer cette note ?" })).closest(
      "dialog",
    ) as HTMLElement;
    await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));

    // Offline delete is not allowed: it surfaces the error toast and never hits the network.
    await waitFor(() =>
      expect(screen.getByText("Action indisponible hors-ligne.")).toBeInTheDocument(),
    );
    expect(vi.mocked(postForm)).not.toHaveBeenCalled();
  });
});
