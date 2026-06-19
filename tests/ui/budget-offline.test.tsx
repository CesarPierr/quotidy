// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { render } from "../test-utils";
import { BudgetClient } from "@/components/budget/budget-client";
import { enqueue } from "@/lib/offline-outbox";
import { postForm } from "@/lib/api-client";
import type { BudgetOverview } from "@/lib/budget";

// next/navigation is mocked globally in test-utils, but BudgetClient calls
// useRouter().push directly — keep an explicit, scoped mock so push exists.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
// Keep the real buildEntry/newOutboxId (budget-client uses them); mock only enqueue.
vi.mock("@/lib/offline-outbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/offline-outbox")>()),
  enqueue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api-client", () => ({ postForm: vi.fn() }));

function makeOverview(): BudgetOverview {
  return {
    month: "2026-06",
    week: { index: 1, label: "1 – 7 juin" },
    totals: {
      income: 0,
      charges: 0,
      monthExpenses: 0,
      reste: 0,
      plannedReste: 0,
      awaitingRefund: 0,
      freeMoney: 0,
    },
    income: [],
    charges: [],
    pockets: [
      {
        id: "p-1",
        name: "Alimentation",
        icon: null,
        color: "#D8643D",
        period: "monthly",
        quota: 300,
        sortOrder: 0,
        spent: 0,
        remaining: 300,
        ratio: 0,
        over: false,
      },
    ],
    expenses: [],
    refunds: [],
    analysis: { total: 0, byType: [], byWeek: [] },
  };
}

/** Put navigator into the offline state and broadcast it (BudgetClient reads
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

describe("BudgetClient offline", () => {
  test("config add buttons are disabled while offline", async () => {
    render(<BudgetClient householdId="h-1" initialOverview={makeOverview()} savingsBoxes={[]} />);
    goOffline();

    // Revenus + Charges "Ajouter — <title>" buttons.
    await waitFor(() => expect(screen.getByLabelText("Ajouter — Revenus")).toBeDisabled());
    expect(screen.getByLabelText("Ajouter — Charges fixes")).toBeDisabled();

    // Pocket "Nouveau" button.
    expect(screen.getByRole("button", { name: /Nouveau/ })).toBeDisabled();
  });

  test("adding a dépense works offline — queued + optimistic, no postForm", async () => {
    const user = userEvent.setup();
    render(<BudgetClient householdId="h-1" initialOverview={makeOverview()} savingsBoxes={[]} />);
    goOffline();

    // Wait until the offline state has propagated to the config buttons.
    await waitFor(() => expect(screen.getByLabelText("Ajouter — Revenus")).toBeDisabled());

    // Open the "Ajouter une dépense" sheet (still allowed offline).
    await user.click(screen.getByRole("button", { name: /Ajouter une dépense/ }));
    const sheet = await screen.findByRole("heading", { name: "Nouvelle dépense" });
    const dialog = sheet.closest("dialog") as HTMLElement;

    // Fill the Montant field and submit.
    const amount = within(dialog).getByPlaceholderText("0,00");
    await user.type(amount, "42");
    await user.click(within(dialog).getByRole("button", { name: "Ajouter la dépense" }));

    // Queued to the outbox, NOT sent over the network.
    expect(vi.mocked(enqueue)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(postForm)).not.toHaveBeenCalled();

    // The amount appears optimistically (it now shows in the Dépenses stat /
    // reste / argent libre — so there are several matches, hence getAllByText).
    await waitFor(() => expect(screen.getAllByText(/42,00/).length).toBeGreaterThan(0));
  });
});
