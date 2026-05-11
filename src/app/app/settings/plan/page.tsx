import Link from "next/link";
import { CheckCircle2, HeartHandshake, LockKeyhole, Sparkles } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getHouseholdBillingSnapshot } from "@/lib/billing";
import { SUPPORT_URL } from "@/lib/brand";
import { requireHouseholdContext } from "@/lib/households";

type PlanPageProps = {
  searchParams: Promise<{ household?: string }>;
};

const featureLabels: Record<string, string> = {
  households: "Foyers",
  members: "Membres du foyer",
  full_history: "Historique complet",
  advanced_exports: "Exports avancés",
  advanced_notifications: "Notifications avancées",
  integrations: "Intégrations",
  advanced_stats: "Statistiques avancées",
};

export default async function PlanSettingsPage({ searchParams }: PlanPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await requireHouseholdContext(user.id, params.household);
  const billing = await getHouseholdBillingSnapshot(context.household.id);

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="app-surface rounded-[1.7rem] p-5 sm:rounded-[2rem] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <p className="section-kicker">Bêta publique</p>
              <h2 className="display-title mt-2 text-2xl leading-tight sm:text-3xl">Gratuit, sans limite cachée</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700">
                Le foyer reste entièrement ouvert pendant la bêta. Le futur premium est préparé
                côté technique, mais rien ne force un upgrade maintenant.
              </p>
            </div>
            <span className="accent-pill w-fit shrink-0 bg-white shadow-sm dark:bg-[#262830]">
              <span className="accent-pill-dot" style={{ backgroundColor: billing.billingEnabled ? "var(--coral-500)" : "var(--leaf-500)" }} />
              {billing.billingEnabled ? "Billing actif" : "Bêta gratuite"}
            </span>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white/70 p-3 dark:bg-[#262830]/70">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-500">Foyer</p>
              <p className="mt-1 truncate text-sm font-semibold">{context.household.name}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white/70 p-3 dark:bg-[#262830]/70">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-500">Soutien</p>
              <p className="mt-1 text-sm font-semibold">{(billing.supporterTotalCents / 100).toFixed(2)} EUR</p>
            </div>
            <div className="rounded-2xl border border-line bg-white/70 p-3 dark:bg-[#262830]/70">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-500">Premium</p>
              <p className="mt-1 text-sm font-semibold">Préparé, inactif</p>
            </div>
          </div>
        </section>

        <section className="app-surface rounded-[1.7rem] p-5 sm:rounded-[2rem] sm:p-6">
          <HeartHandshake className="size-7 text-coral-600" />
          <h3 className="display-title mt-3 text-2xl">Soutenir le projet</h3>
          <p className="mt-2 text-sm leading-6 text-ink-700">
            Un don est optionnel. Il aide à financer l&apos;hébergement, le support et les prochaines
            itérations, sans réserver les fonctions importantes aux contributeurs.
          </p>
          {SUPPORT_URL ? (
            <a className="btn-primary mt-4 inline-flex px-5 py-3 text-sm font-semibold" href={SUPPORT_URL}>
              Faire un don
            </a>
          ) : (
            <Link className="btn-primary mt-4 inline-flex px-5 py-3 text-sm font-semibold" href="/support">
              Voir comment soutenir
            </Link>
          )}
        </section>
      </div>

      <section className="app-surface rounded-[1.7rem] p-5 sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">Inclus pendant la bêta</p>
            <h3 className="display-title mt-2 text-2xl">Tout ce qui sert le quotidien</h3>
          </div>
          <span className="accent-pill w-fit bg-white shadow-sm dark:bg-[#262830]">
            <Sparkles className="size-3.5 text-coral-600" />
            Fonctions ouvertes
          </span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(billing.betaFeatures).map((feature) => (
            <div key={feature} className="flex items-center gap-3 rounded-2xl border border-line bg-white/70 p-3 dark:bg-[#262830]/70">
              <CheckCircle2 className="size-5 shrink-0 text-leaf-600" />
              <span className="text-sm font-semibold">{featureLabels[feature] ?? feature}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.7rem] border border-line bg-white/55 p-5 text-sm leading-6 text-ink-700 dark:bg-[#262830]/55 sm:rounded-[2rem] sm:p-6">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-ink-500" />
          <div>
            <p className="font-semibold text-ink-950">Le freemium viendra plus tard.</p>
            <p className="mt-1">
              Les limites futures seront décidées avec les vrais usages de la bêta. Pour l&apos;instant,
              cette page sert surtout à rendre la stratégie transparente.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
