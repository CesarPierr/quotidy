import { CopyValueButton } from "@/components/shared/copy-value-button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageHousehold, requireHouseholdContext } from "@/lib/households";
import { redirect } from "next/navigation";
import { ClientForm } from "@/components/shared/client-form";

type AccessPageProps = {
  searchParams: Promise<{ household?: string; invite?: string }>;
};

export default async function AccessSettingsPage({ searchParams }: AccessPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await requireHouseholdContext(user.id, params.household);
  const manageable = canManageHousehold(context.membership.role);

  if (!manageable) {
    redirect(`/app/foyer?household=${context.household.id}`);
  }

  const activeInvites = await db.householdInvite.findMany({
    where: {
      householdId: context.household.id,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  const feedbackMessage =
    params.invite === "created"
      ? { tone: "success" as const, text: "Invitation créée." }
      : params.invite === "invalid"
        ? { tone: "error" as const, text: "Impossible de créer cette invitation." }
        : null;

  return (
    <section className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5 space-y-3 sm:space-y-4">
      <div>
        <p className="section-kicker">Accès</p>
        <h3 className="display-title mt-1 text-2xl sm:text-3xl">Partager l&apos;accès</h3>
      </div>

      {feedbackMessage ? (
        <div
          className="rounded-xl border px-4 py-3 text-sm leading-6"
          style={{
            backgroundColor: feedbackMessage.tone === "success" ? "rgba(56, 115, 93, 0.12)" : "rgba(216, 100, 61, 0.12)",
            borderColor: "rgba(30, 31, 34, 0.06)",
            color: feedbackMessage.tone === "success" ? "var(--leaf-600)" : "var(--coral-600)",
          }}
        >
          {feedbackMessage.text}
        </div>
      ) : null}

      <ClientForm action={`/api/households/${context.household.id}/invites`} method="POST" className="soft-panel space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            <span>Rôle</span>
            <select className="field" name="role" defaultValue="member">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <label className="field-label">
            <span>Expiration (jours)</span>
            <input className="field" type="number" min="1" max="30" name="expiresInDays" defaultValue="7" />
          </label>
        </div>
        <button className="btn-primary min-h-11 w-full px-4 py-2.5 font-semibold sm:w-auto" type="submit">
          Créer une invitation
        </button>
      </ClientForm>

      <div className="space-y-3">
        {activeInvites.length ? (
          activeInvites.map((invite) => {
            const joinLink = `${appBaseUrl}/join/${invite.token}`;

            return (
              <div key={invite.id} className="space-y-3 rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Code {invite.code}</p>
                    <p className="text-xs text-ink-700">
                      Rôle {invite.role} · expire le{" "}
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(invite.expiresAt)}
                    </p>
                  </div>
                  <span className="stat-pill px-3 py-1 text-xs">Active</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <CopyValueButton label="Copier le lien" value={joinLink} />
                  <CopyValueButton label="Copier le code" value={invite.code} />
                </div>
                <a className="text-sm font-semibold text-coral-600" href={joinLink}>
                  Ouvrir le lien d&apos;invitation
                </a>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-line p-3 text-sm text-ink-700">Aucune invitation active.</div>
        )}
      </div>
    </section>
  );
}
