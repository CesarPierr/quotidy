import React from "react";
import { addDays, format, startOfToday } from "date-fns";
import { fr } from "date-fns/locale";

import { CalendarMonth } from "@/components/calendar/calendar-month";
import { requireUser } from "@/lib/auth";

import { requireHouseholdContext } from "@/lib/households";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import Link from "next/link";
import { CalendarSidebar } from "@/components/calendar/calendar-sidebar";
import { cn } from "@/lib/utils";

type CalendarPageProps = {
  searchParams: Promise<{
    household?: string;
    monthOffset?: string;
    dayOffset?: string;
    member?: string;
    modified?: string;
  }>;
};

function parseOffset(value: string | undefined, options: { min: number; max: number }) {
  const parsed = Number.parseInt(value ?? "0", 10);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(options.max, Math.max(options.min, parsed));
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const monthOffset = parseOffset(params.monthOffset, { min: -24, max: 24 });
  const dayOffset = parseOffset(params.dayOffset, { min: -30, max: 30 });
  const memberFilter = params.member ?? null;
  const isModifiedFilter = params.modified === "1";
  const today = startOfToday();
  const currentMonth = addDays(today, monthOffset * 30);
  const currentDayBase = addDays(today, dayOffset);
  
  const context = await requireHouseholdContext(user.id, params.household, {
    monthDate: currentMonth,
    monthSpan: 1,
  });

  const startDate = currentMonth < today ? today : currentMonth;
  const endDate = addDays(startDate, 30);

  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const householdFeedUrl = `${baseUrl}/api/calendar/feed.ics?household=${context.household.id}`;
  const personalFeedUrl = context.currentMember
    ? `${baseUrl}/api/calendar/member/${context.currentMember.id}/feed.ics?household=${context.household.id}`
    : null;

  const members = context.household.members.map((m) => ({ id: m.id, displayName: m.displayName, color: m.color }));
  const activeMember = memberFilter ? members.find((m) => m.id === memberFilter) ?? null : null;

  const filteredOccurrences = (activeMember
    ? context.monthOccurrences.filter((o) => o.assignedMemberId === activeMember.id)
    : context.monthOccurrences).filter((o) => !isModifiedFilter || o.isManuallyModified);

  const absences = context.household.members.flatMap((member) =>
    member.availabilities
      .filter((availability) => availability.type === "date_range_absence")
      .map((availability) => ({
        id: availability.id,
        startDate: availability.startDate,
        endDate: availability.endDate,
        notes: availability.notes,
        member: {
          id: member.id,
          displayName: member.displayName,
          color: member.color,
        },
      })),
  );


  const baseHref = (extra?: string) =>
    `/app/taches/calendar?household=${context.household.id}${memberFilter ? `&member=${memberFilter}` : ""}${isModifiedFilter ? "&modified=1" : ""}${extra ?? ""}`;

  const prevMonthHref = baseHref(`&monthOffset=${monthOffset - 1}&dayOffset=0`);
  const nextMonthHref = baseHref(`&monthOffset=${monthOffset + 1}&dayOffset=0`);
  const todayHref = `/app/taches/calendar?household=${context.household.id}&monthOffset=0&dayOffset=0`;

  const prevDaysHref = baseHref(`&monthOffset=${monthOffset}&dayOffset=${dayOffset - 4}`);
  const nextDaysHref = baseHref(`&monthOffset=${monthOffset}&dayOffset=${dayOffset + 4}`);

  return (
    <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1fr_380px]">
      <section className="space-y-4 sm:space-y-6">
        <div className="px-1">
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="section-kicker text-[0.62rem] sm:text-xs">Planifier</p>
              <h2 className="display-title mt-1 truncate text-2xl leading-tight sm:mt-2 sm:text-4xl">
                {format(startDate, "d MMM", { locale: fr })} — {format(endDate, "d MMM yyyy", { locale: fr })}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-3 sm:gap-3">
                <p className="text-xs leading-5 text-ink-700 sm:text-sm sm:leading-6">
                  Prochains jours et organisation.
                </p>
                <Link
                  href={`/app/taches/calendar?household=${context.household.id}&monthOffset=${monthOffset}&dayOffset=${dayOffset}${memberFilter ? `&member=${memberFilter}` : ""}${!isModifiedFilter ? "&modified=1" : ""}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
                    isModifiedFilter 
                      ? "bg-coral-500 text-white shadow-md shadow-coral-100" 
                      : "bg-[var(--ink-100)] text-[var(--ink-600)] hover:bg-[var(--ink-200)]"
                  )}
                >
                  <Wrench className={cn("size-3", isModifiedFilter ? "animate-pulse" : "")} />
                  <span>{isModifiedFilter ? "Exceptions actives" : "Voir exceptions"}</span>
                </Link>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href={prevMonthHref}
                  className="btn-secondary flex size-11 items-center justify-center rounded-full p-0"
                  title="Mois précédent"
                >
                  <ChevronLeft className="size-5" />
                </Link>
                <Link href={todayHref} className="btn-secondary px-4 py-2 text-sm font-bold">
                  Auj.
                </Link>
                <Link
                  href={nextMonthHref}
                  className="btn-secondary flex size-11 items-center justify-center rounded-full p-0"
                  title="Mois suivant"
                >
                  <ChevronRight className="size-5" />
                </Link>
              </div>

              <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:hidden">
                <Link
                  href={prevDaysHref}
                  className="btn-secondary flex min-h-10 items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold"
                >
                  <ChevronLeft className="size-4" />
                  Préc.
                </Link>
                <Link href={todayHref} className="btn-secondary flex min-h-10 items-center px-3 py-2 text-xs font-bold">
                  Auj.
                </Link>
                <Link
                  href={nextDaysHref}
                  className="btn-secondary flex min-h-10 items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold"
                >
                  Suivant
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4 hidden flex-wrap items-center gap-2 sm:flex">
            <span className="accent-pill">
              <span className="accent-pill-dot" style={{ backgroundColor: "var(--coral-500)" }} />
              Tâche du planning
            </span>
            <span className="accent-pill">
              <span className="accent-pill-dot" style={{ backgroundColor: "var(--sky-500)" }} />
              Jour affiché
            </span>
            <span className="accent-pill">
              <span className="accent-pill-dot" style={{ backgroundColor: "var(--leaf-500)" }} />
              Absence
            </span>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar sm:mt-4 sm:flex-wrap sm:overflow-visible" role="group" aria-label="Filtrer">
            <Link
              href={`/app/taches/calendar?household=${context.household.id}&monthOffset=${monthOffset}&dayOffset=${dayOffset}${isModifiedFilter ? "&modified=1" : ""}`}
              className={`accent-pill shrink-0 transition-all ${!activeMember ? "ring-2 ring-[var(--sky-500)] ring-offset-1 font-semibold" : "opacity-60 hover:opacity-100"}`}
              aria-current={!activeMember ? "true" : undefined}
            >
              Tous les membres
            </Link>
            {members.map((m) => (
              <Link
                key={m.id}
                href={`/app/taches/calendar?household=${context.household.id}&monthOffset=${monthOffset}&dayOffset=${dayOffset}&member=${m.id}${isModifiedFilter ? "&modified=1" : ""}`}
                className={`accent-pill shrink-0 transition-all ${activeMember?.id === m.id ? "ring-2 ring-offset-1 font-semibold" : "opacity-60 hover:opacity-100"}`}
                style={activeMember?.id === m.id ? ({ "--tw-ring-color": m.color } as React.CSSProperties) : undefined}
                aria-current={activeMember?.id === m.id ? "true" : undefined}
              >
                <span className="accent-pill-dot" style={{ backgroundColor: m.color }} />
                {m.displayName}
              </Link>
            ))}
          </div>
        </div>

        <div className="deferred-section animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CalendarMonth
            month={currentMonth}
            occurrences={filteredOccurrences}
            absences={absences}
            mobileDayBase={currentDayBase}
            householdId={context.household.id}
            currentMemberId={context.currentMember?.id}
            members={members}
          />
        </div>
      </section>

      <CalendarSidebar
        householdFeedUrl={householdFeedUrl}
        personalFeedUrl={personalFeedUrl}
        householdId={context.household.id}
      />
    </div>
  );
}
