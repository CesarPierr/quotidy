"use client";

import { format, startOfToday } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, ListTodo, Plane, Wrench } from "lucide-react";
import type { CalendarOccurrence } from "@/components/calendar/calendar-month";

type CalendarMobileViewProps = {
  viewType: "tasks" | "minutes";
  setViewType: (type: "tasks" | "minutes") => void;
  minutesDays: Date[];
  daysWithOccurrences: { day: Date; occurrences: CalendarOccurrence[] }[];
  occurrences: CalendarOccurrence[];
  dayAbsences: (day: Date) => {
    id: string;
    startDate: Date;
    endDate: Date;
    notes: string | null;
    member: { id: string; displayName: string; color: string };
  }[];
  isAssigneeAbsent: (occurrence: CalendarOccurrence) => boolean;
  setSelectedDay: (day: Date) => void;
  getOccurrenceStyle: (status: string, baseColor: string) => { className: string; style: React.CSSProperties };
};

export function CalendarMobileView({
  viewType,
  setViewType,
  minutesDays,
  daysWithOccurrences,
  occurrences,
  dayAbsences,
  isAssigneeAbsent,
  setSelectedDay,
  getOccurrenceStyle,
}: CalendarMobileViewProps) {
  return (
    <div className="app-surface rounded-[1.6rem] p-3.5 md:hidden">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="section-kicker text-[0.62rem]">Agenda mobile</p>
          <h3 className="display-title mt-1 text-xl leading-tight">
            {viewType === "tasks" ? "Les 7 prochains jours" : "Charge prévue"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-ink-700">
            Une vue compacte, lisible et sans scroll horizontal.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-[1.2rem] border border-line bg-glass-bg p-1">
        <button
          aria-pressed={viewType === "tasks"}
          className={`rounded-[0.95rem] px-2 py-2 text-xs font-semibold transition-all ${
            viewType === "tasks"
              ? "bg-ink-950 text-white shadow-sm"
              : "text-ink-700"
          }`}
          onClick={() => setViewType("tasks")}
          type="button"
        >
          <span className="inline-flex items-center gap-2">
            <ListTodo className="size-4" />
            Vue tâches
          </span>
        </button>
        <button
          aria-pressed={viewType === "minutes"}
          className={`rounded-[0.95rem] px-2 py-2 text-xs font-semibold transition-all ${
            viewType === "minutes"
              ? "bg-ink-950 text-white shadow-sm"
              : "text-ink-700"
          }`}
          onClick={() => setViewType("minutes")}
          type="button"
        >
          <span className="inline-flex items-center gap-2">
            <Clock className="size-4" />
            Vue minutes
          </span>
        </button>
      </div>

      {viewType === "minutes" ? (
        <div
          aria-label="Charge prévue sur 7 jours"
          className="mt-3 rounded-[1.3rem] border border-line bg-glass-bg p-3"
          role="region"
        >
          <div className="grid h-48 grid-cols-7 items-end gap-2">
            {minutesDays.slice(0, 7).map((day) => {
              const isToday = format(day, "yyyy-MM-dd") === format(startOfToday(), "yyyy-MM-dd");
              const dayOccurrences = occurrences.filter(
                (occurrence) => format(occurrence.scheduledDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"),
              );
              const totalMinutes = dayOccurrences.reduce(
                (sum, occurrence) => sum + occurrence.taskTemplate.estimatedMinutes,
                0,
              );
              const maxVisibleMinutes = Math.max(
                45,
                ...minutesDays
                  .slice(0, 7)
                  .map((chartDay) =>
                    occurrences
                      .filter((occurrence) => format(occurrence.scheduledDate, "yyyy-MM-dd") === format(chartDay, "yyyy-MM-dd"))
                      .reduce((sum, occurrence) => sum + occurrence.taskTemplate.estimatedMinutes, 0),
                  ),
              );
              const heightPercent = Math.min(100, (totalMinutes / maxVisibleMinutes) * 100);

              return (
                <div key={day.toISOString()} className="flex h-full flex-col items-center justify-end gap-2">
                  <div className="h-5 text-center text-[0.62rem] font-bold text-ink-500">
                    {totalMinutes ? `${totalMinutes}` : ""}
                  </div>
                  <div className="flex h-28 w-full items-end justify-center rounded-full bg-[var(--ink-100)]/60 px-1 py-1">
                    <div
                      className={`w-full rounded-full transition-all duration-500 ${
                        isToday ? "bg-coral-500" : "bg-sky-500"
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-500">
                      {format(day, "EEE", { locale: fr }).slice(0, 3)}
                    </p>
                    <p className={`text-sm font-bold ${isToday ? "text-coral-600" : "text-ink-950"}`}>
                      {format(day, "d")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div aria-label="Tâches des 7 prochains jours" className="mt-3 space-y-2.5" role="region">
          {daysWithOccurrences.length ? (
            daysWithOccurrences.map(({ day, occurrences: dayOccurrences }) => {
              const activeAbsences = dayAbsences(day);
              const isToday = format(day, "yyyy-MM-dd") === format(startOfToday(), "yyyy-MM-dd");

              return (
                <article
                  key={day.toISOString()}
                  className={`rounded-[1.25rem] border p-3 ${
                    isToday
                      ? "border-[rgba(216,100,61,0.24)] bg-[rgba(216,100,61,0.08)]"
                      : "border-line bg-glass-bg"
                  }`}
                  onClick={() => setSelectedDay(day)}
                  role="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-leaf-600">
                        {format(day, "EEEE", { locale: fr })}
                      </p>
                      <h4 className="mt-1 text-lg font-semibold text-ink-950">
                        {format(day, "d MMMM", { locale: fr })}
                      </h4>
                    </div>
                    <span className="stat-pill px-2.5 py-1 text-[0.68rem] font-semibold">
                      {dayOccurrences.length} tâche{dayOccurrences.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-2">
                    {activeAbsences.map((absence) => (
                      <div
                        key={absence.id}
                        className="rounded-[1.1rem] border border-[rgba(56,115,93,0.22)] bg-[rgba(56,115,93,0.08)] px-3 py-2 text-xs text-leaf-700"
                      >
                        <p className="font-semibold inline-flex items-center gap-1.5">
                          <Plane className="size-3" aria-hidden="true" />
                          <span
                            className="size-1.5 rounded-full border border-black/10"
                            style={{ backgroundColor: absence.member.color }}
                          />
                          Absence · {absence.member.displayName}
                        </p>
                        {absence.notes ? (
                          <p className="mt-1 text-[11px] text-ink-700">{absence.notes}</p>
                        ) : null}
                      </div>
                    ))}

                    {dayOccurrences.length ? (
                      dayOccurrences.slice(0, 3).map((occurrence) => {
                        const { className, style } = getOccurrenceStyle(occurrence.status, occurrence.taskTemplate.color ?? "#D8643D");
                        const absentAssignee = isAssigneeAbsent(occurrence);
                        return (
                          <div
                            aria-label={`${occurrence.taskTemplate.title} · ${occurrence.assignedMember?.displayName ?? "À attribuer"}${absentAssignee ? " · membre absent" : ""}`}
                            key={occurrence.id}
                            className={`rounded-[1.1rem] px-3 py-2 text-sm relative group ${className} ${absentAssignee ? "ring-1 ring-leaf-500/50" : ""}`}
                            role="group"
                            style={style}
                          >
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <p className="font-semibold leading-5 truncate">{occurrence.taskTemplate.title}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                {absentAssignee && (
                                  <Plane className="size-3 text-leaf-600" aria-label="Membre absent" />
                                )}
                                {occurrence.isManuallyModified && (
                                  <Wrench className="size-3 text-coral-500" />
                                )}
                              </div>
                            </div>
                            <div className="mt-0.5 inline-flex items-center gap-2 text-[10px] opacity-80">
                              {occurrence.assignedMember ? (
                                <span
                                  className="size-1.5 rounded-full border border-black/10"
                                  style={{ backgroundColor: occurrence.assignedMember.color }}
                                />
                              ) : null}
                              <span>{occurrence.assignedMember?.displayName ?? "À attribuer"}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : !activeAbsences.length ? (
                      <p className="rounded-[1.1rem] border border-dashed border-line px-3 py-3 text-center text-xs text-ink-500">
                        Rien à signaler ce jour-là.
                      </p>
                    ) : null}
                    {dayOccurrences.length > 3 && (
                      <p className="text-center text-[10px] font-black uppercase tracking-widest text-ink-400">
                        + {dayOccurrences.length - 3} plus
                      </p>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="soft-panel p-4 text-sm leading-6 text-ink-700 w-full">
              Aucune occurrence n&apos;est encore prévue pour ce mois.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
