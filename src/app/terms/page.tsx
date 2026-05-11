import Link from "next/link";

import { APP_NAME, CONTACT_EMAIL } from "@/lib/brand";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link className="text-sm font-semibold text-coral-600" href="/">
        Retour
      </Link>
      <h1 className="display-title mt-6 text-4xl">Conditions d&apos;utilisation bêta</h1>
      <div className="mt-6 space-y-5 text-sm leading-7 text-ink-700">
        <p>
          {APP_NAME} est proposé en bêta afin de valider l&apos;utilité du produit, corriger les
          problèmes réels et construire une base utilisateur satisfaite avant toute offre premium.
        </p>
        <p>
          L&apos;application aide à organiser des tâches, absences, calendriers et enveloppes
          d&apos;épargne informatives. Elle ne constitue pas un service bancaire, comptable ou
          juridique.
        </p>
        <p>
          Vous restez responsable du contenu ajouté dans votre foyer et devez inviter uniquement
          des personnes autorisées à accéder aux informations partagées.
        </p>
        <p>
          Pendant la bêta, les fonctionnalités essentielles ne sont pas limitées par un abonnement.
          Un appel au don peut être proposé pour soutenir le développement.
        </p>
        <p>
          Pour toute question:{" "}
          <a className="font-semibold text-coral-600 underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
