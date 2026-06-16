import { MemberSettingsList } from "@/components/settings/member-settings-list";
import { requireUser } from "@/lib/auth";
import { canManageHousehold, requireHouseholdContext } from "@/lib/households";
import { ClientForm } from "@/components/shared/client-form";

type TeamPageProps = {
  searchParams: Promise<{ household?: string; member?: string }>;
};

export default async function TeamSettingsPage({ searchParams }: TeamPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await requireHouseholdContext(user.id, params.household);
  const manageable = canManageHousehold(context.membership.role);

  const feedbackMessage =
    params.member === "updated"
      ? { tone: "success" as const, text: "Profil du foyer mis à jour." }
      : params.member === "invalid"
        ? { tone: "error" as const, text: "Impossible d'enregistrer ce membre." }
        : null;

  return (
    <section className="app-surface rounded-[2rem] p-5 sm:p-6 space-y-5">
      <div>
        <p className="section-kicker">Équipe</p>
        <h3 className="display-title mt-2 text-3xl">{manageable ? "Membres" : "Mon profil foyer"}</h3>
      </div>

      {feedbackMessage ? (
        <div
          className="rounded-[1.4rem] border px-4 py-3 text-sm leading-6"
          style={{
            backgroundColor: feedbackMessage.tone === "success" ? "rgba(56, 115, 93, 0.12)" : "rgba(216, 100, 61, 0.12)",
            borderColor: "rgba(30, 31, 34, 0.06)",
            color: feedbackMessage.tone === "success" ? "var(--leaf-600)" : "var(--coral-600)",
          }}
        >
          {feedbackMessage.text}
        </div>
      ) : null}

      <MemberSettingsList
        canManage={manageable}
        currentUserId={user.id}
        householdId={context.household.id}
        members={context.household.members.map((member) => ({
          id: member.id,
          displayName: member.displayName,
          color: member.color,
          role: member.role,
          weeklyCapacityMinutes: member.weeklyCapacityMinutes,
          userId: member.userId,
        }))}
      />

      {manageable ? (
        <ClientForm action={`/api/households/${context.household.id}/members`} method="POST" className="soft-panel compact-form-grid p-5">
          <p className="text-sm font-semibold text-ink-950">Ajouter un membre</p>
          <label className="field-label">
            <span>Nom</span>
            <input className="field" type="text" name="displayName" placeholder="Nom affiché" required />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="field-label">
              <span>Couleur</span>
              <input className="field h-[3.2rem] px-2" type="color" name="color" defaultValue="#E86A33" />
            </label>
            <label className="field-label">
              <span>Rôle</span>
              <select className="field" name="role" defaultValue="member">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </label>
            <label className="field-label">
              <span>Capacité</span>
              <input className="field" type="number" name="weeklyCapacityMinutes" min="0" placeholder="Min / semaine" />
            </label>
          </div>
          <label className="field-label">
            <span className="inline-flex items-center gap-3 rounded-[1rem] border border-line bg-white/70 dark:bg-[#262830]/70 px-4 py-3 font-medium text-ink-950">
              <input defaultChecked name="includeInExistingTasks" type="checkbox" value="on" />
              Inclure ce membre dans les tâches futures existantes
            </span>
          </label>
          <button className="btn-primary w-full px-5 py-3 font-semibold" type="submit">
            Ajouter le membre
          </button>
        </ClientForm>
      ) : null}
    </section>
  );
}
