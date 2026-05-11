// @vitest-environment jsdom
import { screen } from "@testing-library/react";
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
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
  );
  Object.defineProperty(document, "cookie", { writable: true, value: "__csrf=test-token" });
});

describe("OnboardingWizard", () => {
  test("renders welcome screen with household name", () => {
    render(<OnboardingWizard householdId="hh_1" householdName="Chez Pierre" currentMemberName="Pierre" />);
    expect(screen.getByText(/Chez Pierre/)).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === "STRONG" && el.textContent === "Pierre")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /c'est parti/i })).toBeInTheDocument();
  });

  test("navigates from welcome to pack selection", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    expect(screen.getByText("Quel type de foyer ?")).toBeInTheDocument();
    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.getByText("Couple")).toBeInTheDocument();
    expect(screen.getByText("Coloc")).toBeInTheDocument();
    expect(screen.getByText("Famille")).toBeInTheDocument();
    expect(screen.getByText("Personnalisé")).toBeInTheDocument();
  });

  test("selecting Solo pack pre-selects 5 minimal tasks", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    await user.click(screen.getByText("Solo"));

    expect(screen.getByText("Choisissez vos tâches")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ajouter 5 tâche/i })).toBeInTheDocument();
  });

  test("selecting Couple pack pre-selects 6 tasks", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    await user.click(screen.getByText("Couple"));

    expect(screen.getByText("Choisissez vos tâches")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ajouter 6 tâche/i })).toBeInTheDocument();
  });

  test("selecting Personnalisé pack starts with 0 tasks selected", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    await user.click(screen.getByText("Personnalisé"));

    // "Ajouter" button should be disabled with 0 tasks
    const addBtn = screen.getByRole("button", { name: /ajouter 0 tâche/i });
    expect(addBtn).toBeDisabled();
  });

  test("toggling tasks updates the count", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    await user.click(screen.getByText("Personnalisé"));

    // Select 2 tasks
    await user.click(screen.getByText("Aspirateur salon"));
    await user.click(screen.getByText("Vaisselle"));

    expect(screen.getByRole("button", { name: /ajouter 2 tâche/i })).not.toBeDisabled();
  });

  test("skip tasks step goes to savings intro", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    await user.click(screen.getByText("Couple"));
    await user.click(screen.getByText("Passer"));

    expect(screen.getByText("Gérez votre budget")).toBeInTheDocument();
  });

  test("full flow reaches done step", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);

    // Welcome → Pack
    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    // Pack → Tasks
    await user.click(screen.getByText("Couple"));
    // Tasks → Savings
    await user.click(screen.getByText("Passer"));
    // Savings → Box
    await user.click(screen.getByText(/Créer ma première caisse/i));
    // Box → Calculator
    await user.click(screen.getByText("Passer"));
    // Calculator → Invite
    await user.click(screen.getByText("Passer pour l'instant"));
    // Invite → Done
    await user.click(screen.getByText(/Passer cette étape/i));

    expect(screen.getByText("Tout est prêt !")).toBeInTheDocument();
    expect(screen.getByText("Aller au tableau de bord")).toBeInTheDocument();
  });

  test("completing onboarding calls API", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard householdId="hh_42" householdName="Maison" currentMemberName="Pierre" />);

    await user.click(screen.getByRole("button", { name: /c'est parti/i }));
    await user.click(screen.getByText("Couple"));
    await user.click(screen.getByText("Passer"));
    await user.click(screen.getByText(/Créer ma première caisse/i));
    await user.click(screen.getByText("Passer"));
    await user.click(screen.getByText("Passer pour l'instant"));
    await user.click(screen.getByText(/Passer cette étape/i));

    // Now on done step
    await user.click(screen.getByText("Aller au tableau de bord"));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/households/hh_42/onboarding",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("progress bar shows correct number of steps", () => {
    render(<OnboardingWizard householdId="hh_1" householdName="Maison" currentMemberName="Pierre" />);
    // 8 steps
    expect(screen.getByText("Bienvenue")).toBeInTheDocument();
    expect(screen.getByText("Profil")).toBeInTheDocument();
    expect(screen.getAllByText("Tâches").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Épargne").length).toBeGreaterThan(0);
    expect(screen.getByText("Caisse")).toBeInTheDocument();
    expect(screen.getByText("Calcul")).toBeInTheDocument();
    expect(screen.getByText("Équipe")).toBeInTheDocument();
    expect(screen.getByText("C'est parti !")).toBeInTheDocument();
  });
});
