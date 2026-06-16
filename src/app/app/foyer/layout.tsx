import { FoyerSubnav } from "@/components/layout/foyer-subnav";
import { requireUser } from "@/lib/auth";
import { canManageHousehold, requireHouseholdContext } from "@/lib/households";

export default async function FoyerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const context = await requireHouseholdContext(user.id);
  const manageable = canManageHousehold(context.membership.role);

  return (
    <div className="space-y-4">
      <FoyerSubnav manageable={manageable} />
      {children}
    </div>
  );
}
