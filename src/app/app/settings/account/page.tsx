import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, KeyRound, Mail, ShieldCheck, Trash2, UserRound } from "lucide-react";

import { ClientForm } from "@/components/shared/client-form";
import { requireUser } from "@/lib/auth";
import { CONTACT_EMAIL } from "@/lib/brand";
import { db } from "@/lib/db";

type AccountPageProps = {
  searchParams: Promise<{ account?: string; count?: string; household?: string }>;
};

function messageFor(code?: string | null, count?: string) {
  switch (code) {
    case "profile_saved":
      return { tone: "success" as const, text: "Profil mis à jour." };
    case "email_saved":
      return { tone: "success" as const, text: "Email mis à jour. Une vérification email pourra être demandée avant certaines actions." };
    case "email_unchanged":
      return { tone: "success" as const, text: "Email inchangé." };
    case "password_saved":
      return { tone: "success" as const, text: "Mot de passe mis à jour. Les autres sessions ont été révoquées." };
    case "sessions_revoked":
      return { tone: "success" as const, text: `${count ?? "0"} session${count === "1" ? "" : "s"} révoquée${count === "1" ? "" : "s"}.` };
    case "invalid_profile":
      return { tone: "error" as const, text: "Nom invalide." };
    case "invalid_email":
      return { tone: "error" as const, text: "Email invalide." };
    case "email_taken":
      return { tone: "error" as const, text: "Cet email est déjà utilisé." };
    case "invalid_password":
      return { tone: "error" as const, text: "Mot de passe actuel invalide." };
    case "invalid_password_form":
      return { tone: "error" as const, text: "Le nouveau mot de passe est invalide ou ne correspond pas à la confirmation." };
    case "session_missing":
      return { tone: "error" as const, text: "Session courante introuvable." };
    default:
      return null;
  }
}

export default async function AccountSettingsPage({ searchParams }: AccountPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const feedback = messageFor(params.account, params.count);
  const householdSuffix = params.household ? `?household=${params.household}` : "";
  const nextPath = `/app/settings/account${householdSuffix}`;

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    include: {
      sessions: {
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, expiresAt: true },
      },
      dataExportRequests: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
      deletionRequests: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (!fullUser) {
    return (
      <section className="app-surface rounded-[2rem] p-6 text-sm text-ink-700">
        Compte introuvable.
      </section>
    );
  }

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="px-1">
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div>
            <p className="section-kicker text-[0.62rem] sm:text-xs">Compte</p>
            <h2 className="display-title mt-1 text-2xl leading-tight sm:mt-2 sm:text-3xl">Mon compte utilisateur</h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-ink-700 sm:mt-3 sm:text-sm sm:leading-6">
              Gérez votre identité globale, votre email, votre mot de passe et vos droits RGPD.
            </p>
          </div>
          <span className="accent-pill">
            {fullUser.emailVerifiedAt ? "Email vérifié" : "Email non vérifié"}
          </span>
        </div>

        {feedback ? (
          <div
            className="mt-4 rounded-[1.2rem] border px-3 py-2.5 text-sm leading-6 sm:mt-5 sm:rounded-[1.4rem] sm:px-4 sm:py-3"
            style={{
              backgroundColor: feedback.tone === "success" ? "rgba(56,115,93,0.12)" : "rgba(216,100,61,0.12)",
              borderColor: "rgba(30,31,34,0.06)",
              color: feedback.tone === "success" ? "var(--leaf-600)" : "var(--coral-600)",
            }}
          >
            {feedback.text}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="app-surface rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-6">
          <UserRound className="size-6 text-coral-600 sm:size-7" />
          <h3 className="display-title mt-2 text-xl sm:mt-3 sm:text-2xl">Profil</h3>
          <ClientForm
            action="/api/account/profile"
            method="POST"
            className="mt-4 space-y-4"
            successMessage="Profil mis à jour."
            errorMessage="Impossible de mettre à jour le profil."
          >
            <input name="nextPath" type="hidden" value={nextPath} />
            <label className="field-label">
              <span>Nom affiché global</span>
              <input className="field" name="displayName" defaultValue={fullUser.displayName} minLength={2} maxLength={60} required />
            </label>
            <button className="btn-primary w-full px-5 py-3 text-sm font-semibold sm:w-auto" type="submit">
              Enregistrer
            </button>
          </ClientForm>
        </section>

        <section className="app-surface rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-6">
          <Mail className="size-6 text-sky-600 sm:size-7" />
          <h3 className="display-title mt-2 text-xl sm:mt-3 sm:text-2xl">Email</h3>
          <p className="mt-2 break-words text-sm text-ink-700">Email actuel: <strong>{fullUser.email}</strong></p>
          <ClientForm
            action="/api/account/email"
            method="POST"
            className="mt-4 space-y-4"
            successMessage="Email mis à jour."
            errorMessage="Impossible de mettre à jour l'email."
          >
            <input name="nextPath" type="hidden" value={nextPath} />
            <label className="field-label">
              <span>Nouvel email</span>
              <input className="field" name="email" type="email" defaultValue={fullUser.email} required />
            </label>
            <label className="field-label">
              <span>Mot de passe actuel</span>
              <input className="field" name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className="btn-primary w-full px-5 py-3 text-sm font-semibold sm:w-auto" type="submit">
              Changer l&apos;email
            </button>
          </ClientForm>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="app-surface rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-6">
          <KeyRound className="size-6 text-coral-600 sm:size-7" />
          <h3 className="display-title mt-2 text-xl sm:mt-3 sm:text-2xl">Mot de passe</h3>
          <ClientForm
            action="/api/account/password"
            method="POST"
            className="mt-4 space-y-4"
            successMessage="Mot de passe mis à jour."
            errorMessage="Impossible de mettre à jour le mot de passe."
          >
            <input name="nextPath" type="hidden" value={nextPath} />
            <label className="field-label">
              <span>Mot de passe actuel</span>
              <input className="field" name="currentPassword" type="password" autoComplete="current-password" minLength={8} required />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                <span>Nouveau mot de passe</span>
                <input className="field" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
              </label>
              <label className="field-label">
                <span>Confirmation</span>
                <input className="field" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
              </label>
            </div>
            <button className="btn-primary w-full px-5 py-3 text-sm font-semibold sm:w-auto" type="submit">
              Mettre à jour
            </button>
          </ClientForm>
        </section>

        <section className="app-surface rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-6">
          <ShieldCheck className="size-6 text-leaf-600 sm:size-7" />
          <h3 className="display-title mt-2 text-xl sm:mt-3 sm:text-2xl">Sessions</h3>
          <p className="mt-2 text-sm text-ink-700">
            {fullUser.sessions.length} session{fullUser.sessions.length > 1 ? "s" : ""} active{fullUser.sessions.length > 1 ? "s" : ""}.
          </p>
          <div className="mt-4 space-y-2">
            {fullUser.sessions.slice(0, 4).map((session) => (
              <div key={session.id} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm dark:bg-[#262830]/70">
                <p className="font-semibold">
                  Créée {formatDistanceToNow(session.createdAt, { addSuffix: true, locale: fr })}
                </p>
                <p className="text-xs text-ink-500">
                  Expire {formatDistanceToNow(session.expiresAt, { addSuffix: true, locale: fr })}
                </p>
              </div>
            ))}
          </div>
          <ClientForm
            action="/api/account/sessions/revoke-others"
            method="POST"
            className="mt-4"
            successMessage="Autres sessions révoquées."
            errorMessage="Impossible de révoquer les sessions."
          >
            <input name="nextPath" type="hidden" value={nextPath} />
            <button className="btn-secondary w-full px-5 py-3 text-sm font-semibold sm:w-auto" type="submit">
              Révoquer les autres sessions
            </button>
          </ClientForm>
        </section>
      </div>

      <section className="app-surface rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-6">
        <Download className="size-6 text-sky-600 sm:size-7" />
        <h3 className="display-title mt-2 text-xl sm:mt-3 sm:text-2xl">Données & RGPD</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-700">
          Téléchargez vos données, consultez les demandes récentes ou supprimez définitivement votre compte.
          Pour une demande spécifique, contactez{" "}
          <a className="font-semibold text-coral-600 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <a href="/api/me/export" className="btn-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold">
            <Download className="size-4" />
            Exporter mes données
          </a>
          <Link href={`/app/settings/danger${householdSuffix}`} className="btn-quiet inline-flex min-h-11 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-red-700">
            <Trash2 className="size-4" />
            Supprimer mon compte
          </Link>
          <Link href="/privacy" className="btn-quiet inline-flex min-h-11 items-center justify-center px-4 py-3 text-sm font-semibold">
            Confidentialité
          </Link>
          <Link href="/terms" className="btn-quiet inline-flex min-h-11 items-center justify-center px-4 py-3 text-sm font-semibold">
            CGU
          </Link>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white/70 p-4 text-sm dark:bg-[#262830]/70">
            <p className="font-bold">Derniers exports</p>
            <div className="mt-2 space-y-1 text-xs text-ink-600">
              {fullUser.dataExportRequests.length ? fullUser.dataExportRequests.map((request) => (
                <p key={request.id}>{request.status} · {formatDistanceToNow(request.createdAt, { addSuffix: true, locale: fr })}</p>
              )) : <p>Aucun export récent.</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-white/70 p-4 text-sm dark:bg-[#262830]/70">
            <p className="font-bold">Demandes de suppression</p>
            <div className="mt-2 space-y-1 text-xs text-ink-600">
              {fullUser.deletionRequests.length ? fullUser.deletionRequests.map((request) => (
                <p key={request.id}>{request.status} · {formatDistanceToNow(request.createdAt, { addSuffix: true, locale: fr })}</p>
              )) : <p>Aucune demande récente.</p>}
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
