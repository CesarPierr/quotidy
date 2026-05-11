import Link from "next/link";
import { HeartHandshake } from "lucide-react";

import { APP_NAME, CONTACT_EMAIL, SUPPORT_URL } from "@/lib/brand";

export default function SupportProjectPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link className="text-sm font-semibold text-coral-600" href="/">
        Retour
      </Link>
      <section className="mt-6 rounded-[2rem] border border-line bg-white/80 p-6 shadow-sm">
        <HeartHandshake className="size-9 text-coral-600" />
        <h1 className="display-title mt-4 text-4xl">Soutenir le projet</h1>
        <p className="mt-4 text-sm leading-7 text-ink-700">
          {APP_NAME} reste gratuit pendant la bêta. Si l&apos;app vous aide vraiment dans le
          quotidien du foyer, vous pouvez soutenir le développement sans débloquer ni limiter
          aucune fonctionnalité.
        </p>
        {SUPPORT_URL ? (
          <a className="btn-primary mt-6 inline-flex px-5 py-3 text-sm font-semibold" href={SUPPORT_URL}>
            Faire un don
          </a>
        ) : (
          <p className="mt-6 rounded-2xl border border-line bg-glass-bg px-4 py-3 text-sm text-ink-700">
            Le lien de don n&apos;est pas encore configuré. Contact:{" "}
            <a className="font-semibold text-coral-600 underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
        )}
      </section>
    </main>
  );
}
