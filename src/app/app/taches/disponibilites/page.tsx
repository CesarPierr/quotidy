import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { redirect } from "next/navigation";
import { Plane, Trash2 } from "lucide-react";

import { ClientForm } from "@/components/shared/client-form";
import { requireUser } from "@/lib/auth";
import { canManageHousehold, requireHouseholdContext } from "@/lib/households";
import { listHolidays } from "@/lib/holidays";

type DisponibilitesPageProps = {
  searchParams: Promise<{
    household?: string;
    rebalance?: string;
    absence?: string;
    shifted?: string;
    deleted?: string;
    error?: string;
  }>;
};

export default async function DisponibilitesPage({ searchParams }: DisponibilitesPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await requireHouseholdContext(user.id, params.household);
  const manageable = canManageHousehold(context.membership.role);

  if (!manageable) redirect(`/app/taches/aujourd-hui?household=${context.household.id}`);

  const today = new Date();
  const upcomingAbsences = context.household.members
    .flatMap((member) =>
      member.availabilities
        .filter((a) => a.type === "date_range_absence")
        .map((a) => ({
          id: a.id,
          startDate: a.startDate,
          endDate: a.endDate,
          notes: a.notes,
          member: { id: member.id, displayName: member.displayName, color: member.color },
        })),
    )
    .filter((a) => a.endDate >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const holidays = await listHolidays(context.household.id);

  const absenceFeedback =
    params.rebalance === "done"
      ? { tone: "success" as const, text: "Rééquilibrage terminé." }
      : params.rebalance === "done_overwrite"
        ? { tone: "success" as const, text: "Rééquilibrage terminé avec écrasement des modifications futures." }
        : params.absence === "saved"
          ? { tone: "success" as const, text: "Absence enregistrée et planning réajusté." }
          : params.absence === "removed"
            ? { tone: "success" as const, text: "Absence annulée et planning recalculé." }
            : params.absence === "invalid"
              ? { tone: "error" as const, text: "Impossible d'enregistrer cette absence." }
              : params.absence === "forbidden"
                ? { tone: "error" as const, text: "Vous ne pouvez pas modifier cette absence." }
                : null;

  const holidayFeedback =
    params.shifted !== undefined
      ? `Période enregistrée. ${params.shifted} occurrence${Number(params.shifted) > 1 ? "s" : ""} déplacée${Number(params.shifted) > 1 ? "s" : ""} après les vacances.`
      : params.deleted === "1"
        ? "Période supprimée. Les occurrences déjà déplacées restent à leur nouvelle date."
        : params.error === "invalid"
          ? "Dates invalides."
          : params.error === "order"
            ? "La date de fin doit être postérieure à la date de début."
            : null;

  return (
    <div className="space-y-4">
      {/* ── Absences ─────────────────────────────────────────────── */}
      <section className="app-surface rounded-[2rem] p-5 sm:p-6 space-y-5">
        <div>
          <p className="section-kicker">Disponibilités</p>
          <h3 className="display-title mt-2 text-3xl">Absences &amp; rééquilibrage</h3>
        </div>

        {absenceFeedback ? (
          <div
            className="rounded-[1.4rem] border px-4 py-3 text-sm leading-6"
            style={{
              backgroundColor: absenceFeedback.tone === "success" ? "rgba(56,115,93,0.12)" : "rgba(216,100,61,0.12)",
              borderColor: "rgba(30,31,34,0.06)",
              color: absenceFeedback.tone === "success" ? "var(--leaf-600)" : "var(--coral-600)",
            }}
          >
            {absenceFeedback.text}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <ClientForm action="/api/members/absence" method="POST" className="soft-panel compact-form-grid p-5">
            <p className="section-kicker">Absences</p>
            <h4 className="display-title mt-2 text-2xl">Déclarer une indisponibilité</h4>
            <input name="householdId" type="hidden" value={context.household.id} />
            <label className="field-label">
              <span>Membre</span>
              <select className="field" name="memberId" defaultValue={context.currentMember?.id ?? ""} required>
                <option value="">Choisir un membre</option>
                {context.household.members.map((member) => (
                  <option key={member.id} value={member.id}>{member.displayName}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                <span>Début</span>
                <input className="field" type="date" name="startDate" required />
              </label>
              <label className="field-label">
                <span>Fin</span>
                <input className="field" type="date" name="endDate" required />
              </label>
            </div>
            <label className="field-label">
              <span>Note</span>
              <input className="field" type="text" name="notes" placeholder="Facultative" />
            </label>
            <div className="rounded-[1.2rem] border border-[rgba(56,115,93,0.12)] bg-[rgba(56,115,93,0.08)] px-4 py-3 text-sm leading-6 text-ink-700">
              Le planning futur est recalculé automatiquement.
            </div>
            <button className="btn-primary w-full px-5 py-3 font-semibold" type="submit">
              Enregistrer l&apos;absence
            </button>
          </ClientForm>

          <ClientForm action={`/api/households/${context.household.id}/recalculate`} method="POST" className="soft-panel compact-form-grid p-5">
            <p className="section-kicker">Rééquilibrage</p>
            <h4 className="display-title mt-2 text-2xl">Recalculer les tâches futures</h4>
            <label className="field-label">
              <span>Gestion des tâches sautées</span>
              <select className="field" name="skipLoadPolicy" defaultValue="no_carry_over">
                <option value="carry_over">Reporter la charge</option>
                <option value="no_carry_over">Reprendre normalement</option>
              </select>
            </label>
            <label className="field-label">
              <span className="inline-flex items-start gap-3 rounded-[1rem] border border-line bg-white/70 dark:bg-[#262830]/70 px-4 py-3 font-medium text-ink-950">
                <input name="forceOverwriteManual" type="checkbox" className="mt-1" />
                <span>Écraser les modifications manuelles futures</span>
              </span>
            </label>
            <button className="btn-secondary w-full px-5 py-3 font-semibold" type="submit">
              Recalculer les tâches futures
            </button>
          </ClientForm>
        </div>

        <article className="soft-panel space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Absences planifiées</p>
              <h4 className="display-title mt-2 text-2xl">À venir</h4>
            </div>
            <span className="stat-pill px-3 py-1 text-sm">{upcomingAbsences.length} active{upcomingAbsences.length > 1 ? "s" : ""}</span>
          </div>
          {upcomingAbsences.length ? (
            <div className="space-y-3">
              {upcomingAbsences.map((absence) => (
                <div key={absence.id} className="rounded-[1.4rem] border border-line bg-white/70 dark:bg-[#262830]/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full" style={{ backgroundColor: absence.member.color }} />
                        <p className="font-semibold">{absence.member.displayName}</p>
                      </div>
                      <p className="mt-1 text-sm text-ink-700">
                        Du {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(absence.startDate)}
                        {" "}au {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(absence.endDate)}
                      </p>
                      {absence.notes ? <p className="mt-1 text-sm text-ink-700">{absence.notes}</p> : null}
                    </div>
                    <ClientForm action={`/api/members/absence/${absence.id}/delete`} method="POST">
                      <button className="btn-quiet px-4 py-2 text-sm font-semibold" type="submit">
                        Annuler l&apos;absence
                      </button>
                    </ClientForm>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.4rem] border border-line bg-white/70 dark:bg-[#262830]/70 p-4 text-sm text-ink-700">
              Aucune absence future enregistrée.
            </div>
          )}
        </article>
      </section>

      {/* ── Vacances du foyer ────────────────────────────────────── */}
      <section className="app-surface rounded-[2rem] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(47,109,136,0.1)] text-sky-600">
            <Plane className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="display-title text-2xl leading-tight">Vacances du foyer</h3>
            <p className="mt-1 text-sm leading-6 text-ink-700">
              Déclarez une période où tout le foyer est en pause. Les tâches prévues sur ces dates sont automatiquement décalées juste après.
            </p>
          </div>
        </div>

        {holidayFeedback ? (
          <div className="mt-4 rounded-2xl border border-[rgba(56,115,93,0.18)] bg-[rgba(56,115,93,0.06)] px-4 py-3 text-sm text-leaf-600">
            {holidayFeedback}
          </div>
        ) : null}

        <ClientForm
          action={`/api/households/${context.household.id}/holidays`}
          method="POST"
          className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
          successMessage="Période enregistrée."
          errorMessage="Impossible d'enregistrer la période."
        >
          <label className="field-label">
            <span>Du</span>
            <input className="field" name="startDate" required type="date" />
          </label>
          <label className="field-label">
            <span>Au</span>
            <input className="field" name="endDate" required type="date" />
          </label>
          <label className="field-label">
            <span>Étiquette (facultatif)</span>
            <input className="field" name="label" placeholder="Ex: vacances d'été" type="text" maxLength={60} />
          </label>
          <div className="flex items-end">
            <button className="btn-primary w-full px-4 py-3 text-sm font-semibold" type="submit">
              Déclarer
            </button>
          </div>
        </ClientForm>

        <div className="mt-6">
          <p className="section-kicker">Périodes enregistrées</p>
          <h4 className="display-title mt-1 text-xl">Historique</h4>
          {holidays.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-line p-5 text-center text-sm text-ink-500">
              Aucune période déclarée pour l&apos;instant.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {holidays.map((holiday) => {
                const isPast = holiday.endDate < today;
                return (
                  <li
                    key={holiday.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white/70 dark:bg-[#262830]/70 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-950">
                        {format(holiday.startDate, "d MMM", { locale: fr })} —{" "}
                        {format(holiday.endDate, "d MMM yyyy", { locale: fr })}
                        {holiday.label ? <span className="text-ink-500"> · {holiday.label}</span> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {isPast ? "Période passée" : "À venir / en cours"}
                      </p>
                    </div>
                    <ClientForm
                      action={`/api/households/${context.household.id}/holidays/${holiday.id}`}
                      method="POST"
                      successMessage="Période supprimée."
                      errorMessage="Impossible de supprimer."
                    >
                      <button
                        aria-label="Supprimer la période"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white/70 dark:bg-[#262830]/70 px-3 py-2 text-xs font-semibold text-red-600 transition-all hover:bg-red-50"
                        type="submit"
                      >
                        <Trash2 className="size-3.5" />
                        Supprimer
                      </button>
                    </ClientForm>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
