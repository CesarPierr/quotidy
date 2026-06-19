import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, Download, KeyRound, Mail, ShieldCheck, Trash2, UserRound } from "lucide-react";

import { ClientForm } from "@/components/shared/client-form";
import { PushNotificationToggle } from "@/components/settings/push-notification-toggle";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { requireUser } from "@/lib/auth";
import { CONTACT_EMAIL } from "@/lib/brand";
import { db } from "@/lib/db";
import { getCurrentHouseholdContext } from "@/lib/households";

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
  const nextPath = `/app/compte${householdSuffix}`;
  const context = await getCurrentHouseholdContext(user.id, params.household);
  const currentMemberId = context?.currentMember?.id ?? "";

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
      <section className="app-surface rounded-[1.6rem] p-5 text-sm text-ink-700 sm:rounded-[2rem] sm:p-6">
        Compte introuvable.
      </section>
    );
  }

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="px-1">
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="section-kicker text-[0.62rem] sm:text-xs">Compte</p>
            <h2 className="display-title mt-1 text-2xl leading-tight sm:mt-2 sm:text-3xl">Mon compte utilisateur</h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-ink-700 sm:mt-3 sm:text-sm sm:leading-6">
              Gérez votre identité globale, votre email, votre mot de passe et vos droits RGPD.
            </p>
          </div>
          <span className="accent-pill shrink-0">
            {fullUser.emailVerifiedAt ? "Email vérifié" : "Email non vérifié"}
          </span>
        </div>

        {feedback ? (
          <div
            className="mt-4 rounded-[1.2rem] border px-3 py-2.5 text-sm leading-6 sm:mt-5 sm:rounded-[1.4rem] sm:px-4 sm:py-3"
            style={{
              backgroundColor: feedback.tone === "success" ? "rgba(56,115,93,0.08)" : "rgba(216,100,61,0.08)",
              borderColor: feedback.tone === "success" ? "rgba(56,115,93,0.22)" : "rgba(216,100,61,0.22)",
              color: feedback.tone === "success" ? "var(--leaf-600)" : "var(--coral-600)",
            }}
          >
            {feedback.text}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <section className="app-surface flex flex-col rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-coral-500/10 text-coral-600">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="section-kicker text-[0.62rem]">Identité</p>
              <h3 className="display-title text-lg sm:text-xl">Profil</h3>
            </div>
          </div>
          <ClientForm
            action="/api/account/profile"
            method="POST"
            className="mt-4 space-y-3"
            successMessage="Profil mis à jour."
            errorMessage="Impossible de mettre à jour le profil."
          >
            <input name="nextPath" type="hidden" value={nextPath} />
            <label className="field-label">
              <span>Nom affiché global</span>
              <input className="field" name="displayName" defaultValue={fullUser.displayName} minLength={2} maxLength={60} required />
            </label>
            <button className="btn-primary min-h-11 w-full px-4 py-2.5 text-sm font-semibold sm:w-auto" type="submit">
              Enregistrer
            </button>
          </ClientForm>
        </section>

        <section className="app-surface flex flex-col rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
              <Mail className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="section-kicker text-[0.62rem]">Connexion</p>
              <h3 className="display-title text-lg sm:text-xl">Email</h3>
            </div>
          </div>
          <p className="field-help mt-3 break-words">
            Email actuel : <strong className="font-semibold text-ink-950">{fullUser.email}</strong>
          </p>
          <ClientForm
            action="/api/account/email"
            method="POST"
            className="mt-4 space-y-3"
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
            <button className="btn-primary min-h-11 w-full px-4 py-2.5 text-sm font-semibold sm:w-auto" type="submit">
              Changer l&apos;email
            </button>
          </ClientForm>
        </section>
      </div>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <section className="app-surface flex flex-col rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-coral-500/10 text-coral-600">
              <KeyRound className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="section-kicker text-[0.62rem]">Sécurité</p>
              <h3 className="display-title text-lg sm:text-xl">Mot de passe</h3>
            </div>
          </div>
          <ClientForm
            action="/api/account/password"
            method="POST"
            className="mt-4 space-y-3"
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
            <button className="btn-primary min-h-11 w-full px-4 py-2.5 text-sm font-semibold sm:w-auto" type="submit">
              Mettre à jour
            </button>
          </ClientForm>
        </section>

        <section className="app-surface flex flex-col rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-leaf-500/10 text-leaf-600">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="section-kicker text-[0.62rem]">Appareils</p>
              <h3 className="display-title text-lg sm:text-xl">Sessions</h3>
            </div>
          </div>
          <p className="field-help mt-3">
            {fullUser.sessions.length} session{fullUser.sessions.length > 1 ? "s" : ""} active{fullUser.sessions.length > 1 ? "s" : ""}.
          </p>
          <div className="mt-4 space-y-2">
            {fullUser.sessions.slice(0, 4).map((session) => (
              <div key={session.id} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm dark:bg-surface/70">
                <p className="break-words font-semibold">
                  Créée {formatDistanceToNow(session.createdAt, { addSuffix: true, locale: fr })}
                </p>
                <p className="break-words text-xs text-ink-500">
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
            <button className="btn-secondary min-h-11 w-full px-4 py-2.5 text-sm font-semibold sm:w-auto" type="submit">
              Révoquer les autres sessions
            </button>
          </ClientForm>
        </section>
      </div>

      <section className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
            <Download className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="section-kicker text-[0.62rem]">Confidentialité</p>
            <h3 className="display-title text-lg sm:text-xl">Données &amp; RGPD</h3>
          </div>
        </div>
        <p className="field-help mt-3 max-w-2xl">
          Téléchargez vos données, consultez les demandes récentes ou supprimez définitivement votre compte.
          Pour une demande spécifique, contactez{" "}
          <a className="break-words font-semibold text-coral-600 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <a href="/api/me/export" className="btn-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold">
            <Download className="size-4 shrink-0" />
            Exporter mes données
          </a>
          <Link href="/privacy" className="btn-quiet inline-flex min-h-11 items-center justify-center px-4 py-3 text-sm font-semibold">
            Confidentialité
          </Link>
          <Link href="/terms" className="btn-quiet inline-flex min-h-11 items-center justify-center px-4 py-3 text-sm font-semibold">
            CGU
          </Link>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white/70 p-4 text-sm dark:bg-surface/70">
            <p className="font-bold">Derniers exports</p>
            <div className="mt-2 space-y-1 text-xs text-ink-600">
              {fullUser.dataExportRequests.length ? fullUser.dataExportRequests.map((request) => (
                <p key={request.id} className="break-words">{request.status} · {formatDistanceToNow(request.createdAt, { addSuffix: true, locale: fr })}</p>
              )) : <p>Aucun export récent.</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-white/70 p-4 text-sm dark:bg-surface/70">
            <p className="font-bold">Demandes de suppression</p>
            <div className="mt-2 space-y-1 text-xs text-ink-600">
              {fullUser.deletionRequests.length ? fullUser.deletionRequests.map((request) => (
                <p key={request.id} className="break-words">{request.status} · {formatDistanceToNow(request.createdAt, { addSuffix: true, locale: fr })}</p>
              )) : <p>Aucune demande récente.</p>}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm font-semibold text-red-700">Zone sensible</p>
          <p className="field-help mt-1">Cette action est définitive et supprime toutes vos données.</p>
          <Link href={`/app/foyer/zone-sensible${householdSuffix}`} className="btn-quiet mt-3 inline-flex min-h-11 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-red-700">
            <Trash2 className="size-4 shrink-0" />
            Supprimer mon compte
          </Link>
        </div>
      </section>

      <section className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-coral-500/10 text-coral-600">
            <Bell className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="section-kicker text-[0.62rem]">Préférences</p>
            <h3 className="display-title text-lg sm:text-xl">Notifications &amp; apparence</h3>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink-950">Apparence</p>
            <ThemeToggle />
          </div>
          <div className="soft-divider" />
          <PushNotificationToggle memberId={currentMemberId} />
          <div className="soft-panel p-4">
            <h4 className="text-sm font-semibold">Quand vous serez notifié(e)</h4>
            <ul className="mt-3 space-y-2 text-sm text-ink-700">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 size-1.5 rounded-full bg-coral-500 shrink-0 translate-y-1" />
                Tâches du jour non validées à 18h
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 size-1.5 rounded-full bg-coral-500 shrink-0 translate-y-1" />
                Rappel des tâches en retard chaque matin
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 size-1.5 rounded-full bg-coral-500 shrink-0 translate-y-1" />
                Nouvelle tâche assignée à votre compte
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 size-1.5 rounded-full bg-coral-500 shrink-0 translate-y-1" />
                Versement automatique ou objectif d&apos;épargne atteint
              </li>
            </ul>
          </div>
        </div>
      </section>
    </section>
  );
}
