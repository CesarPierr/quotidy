import Link from "next/link";
import { Activity, Settings, Users } from "lucide-react";

import { ClientForm } from "@/components/shared/client-form";
import { FeatureToggle } from "@/components/settings/feature-toggle";
import { HouseholdMonitoring } from "@/components/settings/household-monitoring";
import { requireUser } from "@/lib/auth";
import { getHouseholdMonitoringSnapshot } from "@/lib/household-monitoring";
import { canManageHousehold, requireHouseholdContext } from "@/lib/households";
import { cn } from "@/lib/utils";

type View = "apercu" | "preferences" | "gestion";

type HouseholdsPageProps = {
  searchParams: Promise<{ household?: string; leave?: string; pref?: string; view?: string }>;
};

function resolveView(raw: string | undefined): View {
  if (raw === "preferences" || raw === "gestion") return raw;
  return "apercu";
}

export default async function HouseholdsSettingsPage({ searchParams }: HouseholdsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await requireHouseholdContext(user.id, params.household);
  const manageable = canManageHousehold(context.membership.role);
  const view = resolveView(params.view);
  const monitoring = manageable && view === "apercu"
    ? await getHouseholdMonitoringSnapshot(context.household.id)
    : null;

  const householdMemberships = user.memberships;
  const otherMemberships = householdMemberships.filter(
    (m) => m.householdId !== context.household.id,
  );

  const feedbackMessage =
    params.leave === "last_account"
      ? { tone: "error" as const, text: "Votre compte est le dernier relié au foyer." }
      : params.leave === "last_manager"
        ? { tone: "error" as const, text: "Un owner ou admin doit rester rattaché au foyer." }
        : null;

  // Build segmented nav links that preserve the current household selection.
  const baseHref = `/app/settings/households?household=${context.household.id}`;
  const segments: Array<{ id: View; label: string; icon: typeof Activity; visible: boolean }> = [
    { id: "apercu", label: "Aperçu", icon: Activity, visible: manageable },
    { id: "preferences", label: "Préférences", icon: Settings, visible: manageable },
    { id: "gestion", label: "Gestion", icon: Users, visible: true },
  ];
  const visibleSegments = segments.filter((s) => s.visible);

  return (
    <div className="space-y-4">
      {/* Header — foyer actif, compact, avec sélecteur si plusieurs foyers */}
      <header className="app-surface flex flex-col gap-3 rounded-[1.6rem] p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-[2rem] sm:p-5">
        <div className="min-w-0">
          <p className="section-kicker">Foyer actif</p>
          <h2 className="display-title mt-1 truncate text-2xl leading-tight sm:text-3xl">
            {context.household.name}
          </h2>
          <p className="mt-1 text-xs text-ink-500 sm:text-sm">
            {context.household.members.length} membre{context.household.members.length > 1 ? "s" : ""}
            {" · "}
            rôle <span className="capitalize">{context.membership.role}</span>
          </p>
        </div>

        {otherMemberships.length > 0 ? (
          <details className="relative shrink-0">
            <summary className="btn-secondary cursor-pointer list-none px-4 py-2 text-sm font-semibold">
              Changer de foyer
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-64 space-y-1 rounded-[1rem] border border-line bg-white p-2 shadow-lg dark:bg-[#262830]">
              {otherMemberships.map((m) => (
                <Link
                  key={m.id}
                  href={`/app/settings/households?household=${m.householdId}&view=${view}`}
                  className="block rounded-lg px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="block font-semibold text-ink-950">{m.household.name}</span>
                  <span className="block text-xs text-ink-500">Rôle {m.role}</span>
                </Link>
              ))}
            </div>
          </details>
        ) : null}
      </header>

      {/* Segmented nav between the page's three concerns */}
      {visibleSegments.length > 1 ? (
        <nav
          aria-label="Sections du foyer"
          className="flex items-center gap-1 rounded-[1.1rem] bg-black/[0.04] p-1 sm:rounded-[1.2rem]"
        >
          {visibleSegments.map((seg) => {
            const Icon = seg.icon;
            const active = seg.id === view;
            return (
              <Link
                key={seg.id}
                href={`${baseHref}&view=${seg.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-colors duration-150 sm:text-sm",
                  active
                    ? "bg-white text-ink-950 shadow-sm dark:bg-[#262830]"
                    : "text-ink-500 hover:text-ink-700",
                )}
              >
                <Icon className={cn("size-4", active ? "text-coral-500" : "")} />
                {seg.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {feedbackMessage ? (
        <div
          className="rounded-[1.4rem] border px-4 py-3 text-sm leading-6"
          style={{
            backgroundColor: "rgba(216,100,61,0.12)",
            borderColor: "rgba(30,31,34,0.06)",
            color: "var(--coral-600)",
          }}
        >
          {feedbackMessage.text}
        </div>
      ) : null}

      {/* APERÇU — métriques du foyer (admin/owner uniquement) */}
      {view === "apercu" && manageable && monitoring ? (
        <HouseholdMonitoring snapshot={monitoring} />
      ) : null}
      {view === "apercu" && !manageable ? (
        <section className="app-surface rounded-[1.6rem] p-6 text-sm text-ink-700 sm:rounded-[2rem]">
          L&apos;aperçu détaillé est réservé aux admins du foyer.
        </section>
      ) : null}

      {/* PRÉFÉRENCES — toggles modules */}
      {view === "preferences" && manageable ? (
        <section className="app-surface space-y-3 rounded-[1.6rem] p-5 sm:rounded-[2rem] sm:p-6">
          <div>
            <p className="section-kicker">Modules</p>
            <h3 className="display-title mt-1 text-xl">Activer ce qui sert vraiment</h3>
            <p className="mt-1 text-xs text-ink-500">
              Désactiver un module masque son onglet sans supprimer les données.
            </p>
          </div>
          <FeatureToggle
            endpoint={`/api/households/${context.household.id}/preferences`}
            fieldName="savingsEnabled"
            defaultEnabled={context.household.savingsEnabled}
            label="Module Épargne"
            description="Caisses, calculateurs et transferts. L'onglet Épargne disparaît si désactivé."
            enabledToast="Module Épargne activé."
            disabledToast="Module Épargne désactivé."
          />
        </section>
      ) : null}

      {/* GESTION — créer / rejoindre / quitter / liste */}
      {view === "gestion" ? (
        <div className="space-y-4">
          <section className="app-surface rounded-[1.6rem] p-5 sm:rounded-[2rem] sm:p-6">
            <p className="section-kicker">Mes foyers</p>
            <div className="mt-3 space-y-2">
              {householdMemberships.map((membership) => {
                const active = membership.householdId === context.household.id;
                return (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between gap-3 rounded-[1rem] border border-line bg-white/70 px-4 py-3 dark:bg-[#262830]/70"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-950">{membership.household.name}</p>
                      <p className="text-xs text-ink-500">Rôle {membership.role}</p>
                    </div>
                    {active ? (
                      <span className="stat-pill px-3 py-1 text-xs">Actuel</span>
                    ) : (
                      <Link
                        className="btn-secondary px-3 py-1.5 text-xs font-semibold"
                        href={`/app?household=${membership.householdId}`}
                      >
                        Ouvrir
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <ClientForm
              action="/api/households"
              method="POST"
              className="app-surface compact-form-grid rounded-[1.6rem] p-5 sm:rounded-[2rem]"
            >
              <p className="section-kicker">Créer</p>
              <h4 className="display-title mt-1 text-lg">Un nouveau foyer</h4>
              <label className="field-label">
                <span>Nom</span>
                <input className="field" type="text" name="name" placeholder="Ex: Maison principale" required />
              </label>
              <label className="field-label">
                <span>Fuseau horaire</span>
                <input className="field" type="text" name="timezone" defaultValue={context.household.timezone} required />
              </label>
              <button className="btn-primary px-5 py-3 font-semibold" type="submit">
                Créer
              </button>
            </ClientForm>

            <div className="space-y-3">
              <ClientForm
                action="/api/invitations/redeem"
                method="POST"
                className="app-surface compact-form-grid rounded-[1.6rem] p-5 sm:rounded-[2rem]"
              >
                <p className="section-kicker">Rejoindre</p>
                <h4 className="display-title mt-1 text-lg">Avec un code d&apos;invitation</h4>
                <label className="field-label">
                  <span>Code</span>
                  <input className="field" type="text" name="code" placeholder="Code reçu" required />
                </label>
                <button className="btn-secondary px-5 py-3 font-semibold" type="submit">
                  Rejoindre
                </button>
              </ClientForm>

              <ClientForm
                action={`/api/households/${context.household.id}/leave`}
                method="POST"
                className="app-surface rounded-[1.6rem] p-5 sm:rounded-[2rem]"
              >
                <p className="section-kicker">Quitter</p>
                <h4 className="display-title mt-1 text-lg">Ce foyer</h4>
                <p className="mt-1 text-xs text-ink-500">
                  Vous resterez membre des autres foyers, le cas échéant.
                </p>
                <button className="btn-quiet mt-3 w-full px-5 py-3 text-sm font-semibold text-red-600" type="submit">
                  Quitter {context.household.name}
                </button>
              </ClientForm>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
