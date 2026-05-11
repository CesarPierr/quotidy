import Link from "next/link";

import { APP_NAME, CONTACT_EMAIL } from "@/lib/brand";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link className="text-sm font-semibold text-coral-600" href="/">
        Retour
      </Link>
      <h1 className="display-title mt-6 text-4xl">Confidentialité</h1>
      <p className="mt-4 text-sm leading-7 text-ink-700">
        {APP_NAME} traite uniquement les données nécessaires à l&apos;organisation du foyer:
        compte, membres, tâches, commentaires, épargne partagée, invitations, préférences,
        signalements et événements d&apos;usage strictement utiles à l&apos;amélioration du produit.
      </p>

      <section className="mt-8 space-y-5 text-sm leading-7 text-ink-700">
        <div>
          <h2 className="text-lg font-bold text-ink-950">Finalités</h2>
          <p>
            Fournir le service, sécuriser les accès, synchroniser les données du foyer,
            gérer le support, mesurer l&apos;activation de la bêta et préparer les futures offres
            sans activer de limitation payante pendant la bêta.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink-950">Conservation</h2>
          <p>
            Les données du foyer restent conservées tant que le foyer existe. Les sessions
            expirent automatiquement. Les logs techniques et événements UX sont conservés le
            temps nécessaire au diagnostic, à la sécurité et à l&apos;amélioration du service.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink-950">Vos droits</h2>
          <p>
            Depuis la zone sensible des réglages, vous pouvez exporter vos données ou demander
            la suppression de votre compte. Vous pouvez aussi écrire à{" "}
            <a className="font-semibold text-coral-600 underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink-950">Sous-traitants</h2>
          <p>
            Selon la configuration de déploiement: hébergement, base PostgreSQL, email SMTP,
            monitoring, dépôt GitHub pour les signalements et paiement/don si activé. La liste
            opérationnelle doit être tenue à jour avant ouverture publique large.
          </p>
        </div>
      </section>
    </main>
  );
}
