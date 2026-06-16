import { TachesSubnav } from "@/components/layout/taches-subnav";
import { requireUser } from "@/lib/auth";
import { canManageHousehold, requireHouseholdContext } from "@/lib/households";

export default async function TachesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const context = await requireHouseholdContext(user.id);
  const manageable = canManageHousehold(context.membership.role);

  return (
    <div className="space-y-4">
      <TachesSubnav manageable={manageable} />
      {children}
    </div>
  );
}
