// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { render } from "../test-utils";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

// Mock useRouter for the final refresh
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
  );
  Object.defineProperty(document, "cookie", { writable: true, value: "__csrf=test-token" });
  window.localStorage.clear();
});

const fetchCalls = () => (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;

describe("OnboardingWizard (3-step)", () => {
  test("renders welcome with household + member name and both CTAs", () => {
    render(<OnboardingWizard householdId="hh_1" householdName="Chez Pierre" currentMemberName="Pierre" />);
    expect(screen.getByText(/Chez Pierre/)).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === "STRONG" && el.textContent === "Pierre")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /c'est parti/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /explorer directement/i })).toBeInTheDocument();
  });

  test("welcome → profile shows the four personas", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    expect(screen.getByText("Quel type de foyer ?")).toBeInTheDocument();
    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.getByText("Couple")).toBeInTheDocument();
    expect(screen.getByText("Coloc")).toBeInTheDocument();
    expect(screen.getByText("Famille")).toBeInTheDocument();
  });

  test("Solo persona pre-selects 5 tasks (surfaced on the ready step)", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    await user.click(screen.getByText("Solo"));
    await user.click(screen.getByRole("button", { name: /continuer/i }));

    expect(screen.getByText(/5 tâches prêtes/i)).toBeInTheDocument();
  });

  test("Couple persona pre-selects 6 tasks", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    await user.click(screen.getByText("Couple"));
    await user.click(screen.getByRole("button", { name: /continuer/i }));

    expect(screen.getByText(/6 tâches prêtes/i)).toBeInTheDocument();
  });

  test("toggling a task updates the ready-step count", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    await user.click(screen.getByText("Solo")); // 5 selected; "Aspirateur salon" not among them
    await user.click(screen.getByRole("button", { name: /Aspirateur salon/i })); // -> 6
    await user.click(screen.getByRole("button", { name: /continuer/i }));

    expect(screen.getByText(/6 tâches prêtes/i)).toBeInTheDocument();
  });

  test("'Explorer directement' completes without creating any task", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_9" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /explorer directement/i }));

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/households/hh_9/onboarding",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(fetchCalls().map((c) => c[0])).not.toContain("/api/tasks");
  });

  test("full flow creates the selected tasks, then completes", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_42" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    await user.click(screen.getByText("Couple"));
    await user.click(screen.getByRole("button", { name: /continuer/i }));
    await user.click(screen.getByRole("button", { name: /créer et démarrer/i }));

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/households/hh_42/onboarding",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const taskCalls = fetchCalls().filter((c) => c[0] === "/api/tasks");
    expect(taskCalls.length).toBe(6);
  });

  test("no legacy 8-step labels remain", () => {
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);
    expect(screen.queryByText("Caisse")).not.toBeInTheDocument();
    expect(screen.queryByText("Calcul")).not.toBeInTheDocument();
    expect(screen.queryByText("Équipe")).not.toBeInTheDocument();
  });
});
