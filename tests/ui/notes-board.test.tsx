// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { render } from "../test-utils";
import { NotesBoard } from "@/components/aide-memoire/notes-board";
import { postForm } from "@/lib/api-client";
import type { SerializedNote } from "@/lib/aide-memoire";

vi.mock("@/lib/api-client", () => ({ postForm: vi.fn() }));

function makeNote(overrides: Partial<SerializedNote> = {}): SerializedNote {
  return {
    id: "n-1",
    title: null,
    body: "Café",
    color: "#D8643D",
    isPinned: false,
    sortOrder: 0,
    completedAt: null,
    createdAt: "2026-06-10T10:00:00.000Z",
    createdByName: null,
    completedByName: null,
    ...overrides,
  };
}

function jsonResponse(payload: unknown) {
  return { json: async () => payload } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotesBoard", () => {
  test("renders active notes", () => {
    render(
      <NotesBoard householdId="h-1" initialActive={[makeNote()]} initialDone={[]} retentionDays={7} />,
    );
    expect(screen.getByText("Café")).toBeInTheDocument();
  });

  test("quick-add posts FormData and appends the note", async () => {
    vi.mocked(postForm).mockResolvedValue(jsonResponse({ note: makeNote({ id: "n-2", body: "Pain" }) }));
    const user = userEvent.setup();
    render(<NotesBoard householdId="h-1" initialActive={[]} initialDone={[]} retentionDays={7} />);

    await user.type(screen.getByLabelText("Nouvelle note"), "Pain");
    await user.click(screen.getByLabelText("Ajouter la note"));

    await waitFor(() => expect(screen.getByText("Pain")).toBeInTheDocument());
    expect(vi.mocked(postForm)).toHaveBeenCalledWith("/api/households/h-1/notes", { body: "Pain" });
  });

  test("marking a note done moves it to the Fait list", async () => {
    vi.mocked(postForm).mockResolvedValue(
      jsonResponse({ note: makeNote({ completedAt: "2026-06-12T08:00:00.000Z" }) }),
    );
    const user = userEvent.setup();
    render(
      <NotesBoard householdId="h-1" initialActive={[makeNote()]} initialDone={[]} retentionDays={7} />,
    );

    await user.click(screen.getByLabelText("Marquer comme fait"));

    await waitFor(() => expect(screen.getByText(/Fait \(1\)/)).toBeInTheDocument());
    expect(vi.mocked(postForm)).toHaveBeenCalledWith("/api/households/h-1/notes/n-1", {
      _action: "complete",
    });
  });

  test("compact mode shows the hub link and hides the Fait panel", () => {
    render(
      <NotesBoard
        compact
        householdId="h-1"
        initialActive={[makeNote()]}
        initialDone={[makeNote({ id: "d-1", completedAt: "2026-06-12T08:00:00.000Z" })]}
        retentionDays={7}
        seeAllHref="/app/aide-memoire?household=h-1"
      />,
    );
    expect(screen.getByText(/Ouvrir l'aide-mémoire/)).toBeInTheDocument();
    expect(screen.queryByText(/^Fait/)).not.toBeInTheDocument();
  });
});
