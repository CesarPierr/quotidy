"use client";

import {
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfWeek,
  addDays,
  startOfToday,
  isSameDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Wrench } from "lucide-react";

import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/ui/toast";
import { hexToRgba } from "@/lib/colors";
import { CalendarMobileView } from "@/components/calendar/calendar-mobile-view";
import { CalendarDesktopView } from "@/components/calendar/calendar-desktop-view";

export type CalendarOccurrence = {
  id: string;
  scheduledDate: Date;
  status: string;
  notes: string | null;
  actualMinutes: number | null;
  taskTemplateId?: string;
  isManuallyModified?: boolean;
  taskTemplate: { 
    id: string;
    title: string; 
    color: string; 
    estimatedMinutes: number;
    room?: string | null;
    isCollective?: boolean;
    category?: string | null;
  };
  assignedMember: { id: string; displayName: string; color: string } | null;
};

type CalendarMonthProps = {
  month: Date;
  mobileDayBase?: Date;
  occurrences: CalendarOccurrence[];
  absences: {
    id: string;
    startDate: Date;
    endDate: Date;
    notes: string | null;
    member: { id: string; displayName: string; color: string };
  }[];
  householdId?: string;
  currentMemberId?: string | null;
  members?: { id: string; displayName: string; color: string }[];
};

export function CalendarMonth({ 
  month, 
  occurrences, 
  absences, 
  mobileDayBase,
  householdId,
  currentMemberId,
  members = []
}: CalendarMonthProps) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [viewType, setViewType] = useState<"tasks" | "minutes">("tasks");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(null);

  const gridDays = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(addDays(month, 30), { weekStartsOn: 1 }),
  });

  const minutesDays = eachDayOfInterval({
    start: month,
    end: addDays(month, 14), // Show up to 15 days in the minutes bar chart
  });

  const mobileWindowStart = mobileDayBase ?? startOfToday();
  const mobileWindowDays = eachDayOfInterval({
    start: mobileWindowStart,
    end: addDays(mobileWindowStart, 6), // 7-day sliding window on mobile
  });

  const daysWithOccurrences = mobileWindowDays.map((day) => ({
    day,
    occurrences: occurrences.filter(
      (occurrence) => format(occurrence.scheduledDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"),
    ),
  }));

  const dayAbsences = (day: Date) => {
    const dayKey = format(day, "yyyy-MM-dd");
    const matches = absences.filter(
      (absence) =>
        format(absence.startDate, "yyyy-MM-dd") <= dayKey &&
        format(absence.endDate, "yyyy-MM-dd") >= dayKey,
    );
    // De-duplicate by member: a member may have several overlapping absence records
    // (e.g. two ranges that both cover this day). The calendar should show one chip per member.
    const seen = new Map<string, (typeof matches)[number]>();
    for (const absence of matches) {
      if (!seen.has(absence.member.id)) {
        seen.set(absence.member.id, absence);
      }
    }
    return [...seen.values()];
  };

  const isAssigneeAbsent = (occurrence: CalendarOccurrence) => {
    if (!occurrence.assignedMember) return false;
    return dayAbsences(occurrence.scheduledDate).some(
      (absence) => absence.member.id === occurrence.assignedMember?.id,
    );
  };

  const selectedOccurrence = occurrences.find(o => o.id === selectedOccurrenceId);
  const selectedDayOccurrences = selectedDay 
    ? occurrences.filter(o => isSameDay(o.scheduledDate, selectedDay))
    : [];

  function submitAction(url: string, body?: Record<string, string>) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("memberId", currentMemberId ?? "");
        if (body) {
          for (const [key, value] of Object.entries(body)) {
            formData.set(key, value);
          }
        }

        const csrfToken = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/)?.[1] ?? "";
        const response = await fetch(url, {
          method: "POST",
          body: formData,
          headers: {
            Accept: "application/json",
            "x-requested-with": "fetch",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        success("Action enregistrée");
        router.refresh();
        setSelectedOccurrenceId(null);
      } catch {
        showError("Impossible d'effectuer cette action.");
      }
    });
  }

  function getOccurrenceStyle(status: string, baseColor: string) {
    if (status === "completed") {
      return {
        className: "bg-stripes opacity-80",
        style: {
          backgroundColor: hexToRgba(baseColor, 0.1),
          color: "var(--ink-950)",
          border: `1px solid ${hexToRgba(baseColor, 0.3)}`,
        }
      };
    }
    if (status === "skipped") {
      return {
        className: "opacity-40",
        style: {
          backgroundColor: hexToRgba(baseColor, 0.05),
          color: "var(--ink-500)",
          border: `1px dashed ${hexToRgba(baseColor, 0.2)}`,
        }
      };
    }
    return {
      className: "shadow-sm",
      style: {
        backgroundColor: hexToRgba(baseColor, 0.15),
        color: "var(--ink-950)",
        border: `1px solid ${hexToRgba(baseColor, 0.25)}`,
      }
    };
  }

  return (
    <>
      <CalendarMobileView
        viewType={viewType}
        setViewType={setViewType}
        minutesDays={minutesDays}
        daysWithOccurrences={daysWithOccurrences}
        occurrences={occurrences}
        dayAbsences={dayAbsences}
        isAssigneeAbsent={isAssigneeAbsent}
        setSelectedDay={setSelectedDay}
        getOccurrenceStyle={getOccurrenceStyle}
      />

      <CalendarDesktopView
        viewType={viewType}
        setViewType={setViewType}
        minutesDays={minutesDays}
        gridDays={gridDays}
        month={month}
        occurrences={occurrences}
        dayAbsences={dayAbsences}
        isAssigneeAbsent={isAssigneeAbsent}
        setSelectedDay={setSelectedDay}
        setSelectedOccurrenceId={setSelectedOccurrenceId}
        getOccurrenceStyle={getOccurrenceStyle}
      />

      {/* Day Zoom BottomSheet */}
      <BottomSheet
        isOpen={Boolean(selectedDay)}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? format(selectedDay, "EEEE d MMMM", { locale: fr }) : "Détails du jour"}
      >
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-500">
            Toutes les tâches de ce jour
          </p>
          <div className="space-y-2">
            {selectedDayOccurrences.length ? (
              selectedDayOccurrences.map((o) => {
                const { className, style } = getOccurrenceStyle(o.status, o.taskTemplate.color ?? "#D8643D");
                return (
                  <button
                    key={o.id}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-all active:scale-[0.98] ${className}`}
                    style={style}
                    onClick={() => setSelectedOccurrenceId(o.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold leading-tight">{o.taskTemplate.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] opacity-80">
                        {o.taskTemplate.room && (
                          <span className="rounded-full bg-black/5 px-2 py-0.5">{o.taskTemplate.room}</span>
                        )}
                        <span>{o.assignedMember?.displayName ?? "À attribuer"}</span>
                        {o.isManuallyModified && (
                          <span className="flex items-center gap-1 text-coral-600 font-black">
                            <Wrench className="size-3" />
                            MODIFIÉE
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-black uppercase opacity-60">
                        {o.status === "completed" ? "Terminée" : o.status === "skipped" ? "Sautée" : "À faire"}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[1.3rem] border border-dashed border-line p-8 text-center">
                <p className="text-sm text-ink-500 font-medium">Aucune tâche prévue pour ce jour.</p>
              </div>
            )}
          </div>

          {selectedDay && dayAbsences(selectedDay).length > 0 && (
            <div className="space-y-2 pt-2 border-t border-line">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ink-400">Absences</p>
              {dayAbsences(selectedDay).map((absence) => (
                <div
                  key={absence.id}
                  className="rounded-2xl border px-4 py-3 text-sm"
                  style={{
                    backgroundColor: hexToRgba(absence.member.color, 0.05),
                    borderColor: hexToRgba(absence.member.color, 0.15),
                  }}
                >
                  <p className="font-bold text-ink-950">{absence.member.displayName}</p>
                  {absence.notes && <p className="mt-1 text-xs text-ink-700">{absence.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Task Detail Sheet */}
      {selectedOccurrence && (
        <TaskDetailSheet
          isOpen={Boolean(selectedOccurrenceId)}
          onClose={() => setSelectedOccurrenceId(null)}
          occurrence={selectedOccurrence}
          members={members}
          currentMemberId={currentMemberId}
          householdId={householdId}
          canEditTemplate={true} // Usually admins can edit
          taskTemplateId={selectedOccurrence.taskTemplate.id}
          archived={["completed", "skipped", "cancelled"].includes(selectedOccurrence.status)}
          canEditOccurrence={selectedOccurrence.status !== "cancelled"}
          statusLabel={selectedOccurrence.status === "completed" ? "Terminée" : "À faire"}
          isSubmitting={isPending}
          onSubmit={submitAction}
          onTemplateSaved={() => router.refresh()}
        />
      )}
    </>
  );
}
