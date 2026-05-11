import Link from "next/link";
import { Mail } from "lucide-react";

import { APP_NAME, CONTACT_EMAIL } from "@/lib/brand";

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link className="text-sm font-semibold text-coral-600" href="/">
        Retour
      </Link>
      <div className="mt-6 rounded-[2rem] border border-line bg-white/80 p-6 shadow-sm">
        <Mail className="size-8 text-coral-600" />
        <h1 className="display-title mt-4 text-4xl">Contact</h1>
        <p className="mt-4 text-sm leading-7 text-ink-700">
          Pour le support, la confidentialité, une demande de suppression ou un retour sur la bêta
          {APP_NAME}, écrivez à l&apos;adresse ci-dessous.
        </p>
        <a className="btn-primary mt-6 inline-flex px-5 py-3 text-sm font-semibold" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
      </div>
    </main>
  );
}
