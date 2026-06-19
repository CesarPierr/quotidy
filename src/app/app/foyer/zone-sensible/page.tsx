import { requireUser } from "@/lib/auth";
import { requireHouseholdContext } from "@/lib/households";
import { ClientForm } from "@/components/shared/client-form";

type DangerPageProps = {
  searchParams: Promise<{ household?: string; delete?: string; delete_account?: string }>;
};

export default async function DangerSettingsPage({ searchParams }: DangerPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await requireHouseholdContext(user.id, params.household);
  const isOwner = context.membership.role === "owner";

  const householdMessage =
    params.delete === "confirm_required"
      ? "Veuillez confirmer la suppression du foyer."
      : params.delete === "forbidden"
        ? "Seul un owner peut supprimer le foyer."
        : params.delete === "not_found"
          ? "Foyer introuvable ou accès refusé."
          : null;

  const accountMessage =
    params.delete_account === "missing_password"
      ? "Veuillez saisir votre mot de passe pour confirmer."
      : params.delete_account === "invalid_password"
        ? "Mot de passe invalide."
        : params.delete_account === "needs_transfer"
          ? "Vous êtes propriétaire de foyers contenant d'autres membres actifs. Transférez la propriété ou retirez ces membres avant de supprimer votre compte."
          : null;

  return (
    <section className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5 space-y-3 sm:space-y-4">
      <div>
        <p className="section-kicker text-red-700">Zone sensible</p>
        <h3 className="display-title mt-1 text-2xl text-red-900 sm:text-3xl">Actions irréversibles</h3>
      </div>

      {/* Personal data — RGPD */}
      <div className="rounded-xl border border-line bg-glass-bg p-3 space-y-3">
        <div>
          <h4 className="font-bold text-ink-950">Mes données personnelles</h4>
          <p className="mt-1 text-sm text-ink-700">
            Téléchargez l&apos;ensemble des données que Quotidy détient sur votre compte (RGPD article 20).
          </p>
        </div>
        <a
          href="/api/me/export"
          className="btn-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
        >
          Télécharger mes données (.json)
        </a>
      </div>

      {/* Household deletion (owner only) */}
      {isOwner ? (
        <div className="rounded-xl border border-red-200/70 bg-red-50/75 p-3 space-y-3">
          <div>
            <h4 className="font-bold text-red-900">Supprimer le foyer « {context.household.name} »</h4>
            <p className="mt-1 text-sm text-red-700">
              Cette action est définitive. Toutes les tâches, occurrences et données associées seront supprimées.
            </p>
          </div>
          {householdMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-700">
              {householdMessage}
            </div>
          ) : null}
          <ClientForm action={`/api/households/${context.household.id}/delete`} method="POST" className="space-y-3">
            <label className="field-label">
              <span className="inline-flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 font-medium text-red-900">
                <input name="confirmDelete" type="checkbox" className="mt-1" />
                <span>Je confirme la suppression définitive de ce foyer.</span>
              </span>
            </label>
            <button
              className="btn-primary min-h-11 w-full border-none bg-red-700 px-4 py-2.5 font-semibold hover:bg-red-800 sm:w-auto"
              type="submit"
            >
              Supprimer le foyer
            </button>
          </ClientForm>
        </div>
      ) : null}

      {/* Account deletion — RGPD article 17 */}
      <div className="rounded-xl border border-red-300/70 bg-red-50/60 p-3 space-y-3">
        <div>
          <h4 className="font-bold text-red-900">Supprimer définitivement mon compte</h4>
          <p className="mt-1 text-sm text-red-700">
            Suppression complète de votre compte (RGPD article 17). Vos foyers personnels (sans autre membre)
            sont supprimés. Pour les foyers partagés, votre nom est anonymisé sans toucher aux données du foyer.
          </p>
        </div>
        {accountMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-700">
            {accountMessage}
          </div>
        ) : null}
        <ClientForm action="/api/me/delete" method="POST" className="space-y-3">
          <label className="field-label">
            <span className="text-[10px] uppercase tracking-wider font-bold text-red-700">
              Confirmer avec votre mot de passe
            </span>
            <input
              autoComplete="current-password"
              className="field"
              name="password"
              placeholder="Votre mot de passe"
              required
              type="password"
            />
          </label>
          <button
            className="btn-primary min-h-11 w-full border-none bg-red-800 px-4 py-2.5 font-semibold hover:bg-red-900 sm:w-auto"
            type="submit"
          >
            Supprimer mon compte définitivement
          </button>
        </ClientForm>
      </div>
    </section>
  );
}
