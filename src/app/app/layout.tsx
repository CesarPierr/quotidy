import { AppShell } from "@/components/layout/app-shell";
import { NavigationProgress } from "@/components/shared/navigation-progress";
import { ServiceWorkerRegister } from "@/components/shared/service-worker-register";
import { ToastProvider } from "@/components/ui/toast";
import { requireUser } from "@/lib/auth";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default async function AuthenticatedLayout({ children }: AppLayoutProps) {
  const user = await requireUser();

  // Slim summary the AppShell needs to gate per-household features (e.g. hide
  // the Épargne tab when the active household has it disabled). The active
  // household is selected client-side from the URL, so we ship the whole list.
  const households = user.memberships.map((m) => ({
    id: m.householdId,
    name: m.household.name,
    savingsEnabled: m.household.savingsEnabled,
  }));

  return (
    <ToastProvider>
      <NavigationProgress />
      <ServiceWorkerRegister />
      <AppShell households={households}>{children}</AppShell>
    </ToastProvider>
  );
}
