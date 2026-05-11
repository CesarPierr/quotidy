"use client";

import { format, startOfToday, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, ListTodo, Plane, Wrench } from "lucide-react";
import type { CalendarOccurrence } from "@/components/calendar/calendar-month";

type CalendarDesktopViewProps = {
  viewType: "tasks" | "minutes";
  setViewType: (type: "tasks" | "minutes") => void;
  minutesDays: Date[];
  gridDays: Date[];
  month: Date;
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
  setSelectedOccurrenceId: (id: string) => void;
  getOccurrenceStyle: (status: string, baseColor: string) => { className: string; style: React.CSSProperties };
};

export function CalendarDesktopView({
  viewType,
  setViewType,
  minutesDays,
  gridDays,
  month,
  occurrences,
  dayAbsences,
  isAssigneeAbsent,
  setSelectedDay,
  setSelectedOccurrenceId,
  getOccurrenceStyle,
}: CalendarDesktopViewProps) {
  return (
    <div className="app-surface hidden overflow-hidden rounded-[2rem] md:block relative">
      <div className="absolute top-4 right-6 z-10">
        <button
          onClick={() => setViewType(viewType === "tasks" ? "minutes" : "tasks")}
          className="flex items-center gap-2 rounded-full border border-line bg-glass-bg backdrop-blur-md px-4 py-2 text-xs font-bold text-ink-700 hover:bg-sand-100 transition-all shadow-md active:scale-95"
        >
          {viewType === "tasks" ? (
            <>
              <Clock className="size-3.5" />
              Vue minutes
            </>
          ) : (
            <>
              <ListTodo className="size-3.5" />
              Vue tâches
            </>
          )}
        </button>
      </div>

      {viewType === "minutes" ? (
        <div className="flex h-[30rem] items-end gap-1.5 px-8 pb-12 pt-24 overflow-x-hidden bg-gradient-to-b from-[var(--card)] to-transparent">
          {minutesDays.map((day, idx) => {
            const isToday = format(day, "yyyy-MM-dd") === format(startOfToday(), "yyyy-MM-dd");
            const isPast = day < startOfToday() && !isToday;
            const dayOccurrences = occurrences.filter(
              (o) => format(o.scheduledDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
            );
            const totalMinutes = dayOccurrences.reduce((sum, o) => sum + o.taskTemplate.estimatedMinutes, 0);
            const maxVisibleMinutes = Math.max(
              60,
              ...minutesDays.map(d => occurrences.filter(o => format(o.scheduledDate, "yyyy-MM-dd") === format(d, "yyyy-MM-dd")).reduce((sum, o) => sum + o.taskTemplate.estimatedMinutes, 0))
            );
            const heightPercent = Math.min(100, (totalMinutes / maxVisibleMinutes) * 100);

            return (
              <div 
                key={day.toISOString()} 
                className={`flex flex-col items-center flex-1 transition-all duration-500 
                  ${isPast ? "opacity-30 grayscale" : "opacity-100"}
                  ${idx >= 7 ? "hidden lg:flex" : "flex"}
                  ${idx >= 12 ? "hidden xl:flex" : ""}
                `}
              >
                <div className="mb-4 h-6 flex items-center justify-center">
                  {totalMinutes > 0 && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isToday ? "bg-[var(--coral-100)] text-[var(--coral-700)]" : "bg-[var(--sky-100)] text-[var(--sky-700)]"}`}>
                      {totalMinutes}
                    </span>
                  )}
                </div>
                <div className="w-full max-w-[14px] bg-[var(--ink-100)]/50 rounded-full relative flex items-end justify-center group" style={{ height: "200px" }}>
                  {totalMinutes > 0 && (
                    <div 
                      className={`w-full rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-1000 ease-out ${isToday ? "bg-[var(--coral-50)]/30" : "bg-sky-500"}`}
                      style={{ height: `${heightPercent}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>
                <div className="mt-6 flex flex-col items-center gap-1.5">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isToday ? "text-coral-600" : "text-ink-400"}`}>
                    {format(day, "EEE", { locale: fr }).substring(0, 3)}
                  </span>
                  <span className={`flex size-7 items-center justify-center rounded-full text-xs font-black transition-all ${isToday ? "bg-coral-500 text-[var(--sand-50)] shadow-lg shadow-coral-200" : "text-[var(--ink-800)]"}`}>
                    {format(day, "d")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 border-b border-line bg-glass-bg pt-12">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((dName) => (
              <div key={dName} className="px-3 py-4 text-center text-[10px] font-black uppercase tracking-[0.25em] text-ink-400">
                {dName}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {gridDays.map((day) => {
              const dayOccurrences = occurrences.filter(
                (o) => format(o.scheduledDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
              );
              const activeAbsences = dayAbsences(day);
              const isToday = format(day, "yyyy-MM-dd") === format(startOfToday(), "yyyy-MM-dd");
              const isVisible = day >= month && day <= addDays(month, 30);

              return (
                <div
                  key={day.toISOString()}
                  className={`calendar-cell min-h-[110px] border-b border-r border-line px-2 py-3 align-top last:border-r-0 transition-all hover:bg-black/[0.02] cursor-pointer group/cell ${isToday ? "bg-[var(--coral-50)]/40" : ""} ${!isVisible ? "bg-[var(--ink-50)]/20" : ""}`}
                  onClick={() => setSelectedDay(day)}
                >
                  <div className={isVisible ? "" : "opacity-30"}>
                    <div className="mb-3 flex items-center justify-between px-1">
                      <p className={`text-sm font-black transition-transform group-hover/cell:scale-110 ${isToday ? "text-coral-600" : "text-ink-950"}`}>
                        {format(day, "d")}
                      </p>
                    </div>
                    <div className="space-y-1">
                      {activeAbsences.map((absence) => (
                        <div
                          key={absence.id}
                          className="rounded-lg px-2 py-1 text-[9px] font-bold shadow-sm border border-[rgba(56,115,93,0.22)] bg-[rgba(56,115,93,0.1)] text-leaf-700"
                        >
                          <div className="flex items-center gap-1.5">
                            <Plane className="size-2.5 shrink-0" aria-hidden="true" />
                            <span
                              className="size-1.5 rounded-full shadow-inner shrink-0"
                              style={{ backgroundColor: absence.member.color }}
                            />
                            <p className="truncate">Abs. {absence.member.displayName.split(" ")[0]}</p>
                          </div>
                        </div>
                      ))}
                      {dayOccurrences.slice(0, 4).map((o) => {
                        const { className, style } = getOccurrenceStyle(o.status, o.taskTemplate.color ?? "#D8643D");
                        const absentAssignee = isAssigneeAbsent(o);
                        return (
                          <div
                            aria-label={`${o.taskTemplate.title} · ${o.assignedMember?.displayName ?? "À attribuer"}${absentAssignee ? " · membre absent" : ""}`}
                            key={o.id}
                            className={`rounded-lg px-2 py-1 text-[9px] font-bold transition-all hover:brightness-95 flex items-center justify-between gap-1 ${className} ${absentAssignee ? "ring-1 ring-leaf-500/50" : ""}`}
                            role="group"
                            style={style}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOccurrenceId(o.id);
                            }}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="size-1.5 rounded-full shadow-inner shrink-0" style={{ backgroundColor: o.taskTemplate.color ?? "#D8643D" }} />
                              <p className="truncate">{o.taskTemplate.title}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {absentAssignee && (
                                <Plane className="size-2 text-leaf-600" aria-label="Membre absent" />
                              )}
                              {o.isManuallyModified && (
                                <Wrench className="size-2 text-coral-600" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {dayOccurrences.length > 4 && (
                        <p className="px-2 pt-0.5 text-[8px] font-black uppercase tracking-tighter text-ink-400">
                          + {dayOccurrences.length - 4} autres
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
