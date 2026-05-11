"use client";

import { AlertCircle, ChevronDown, Rocket, Search, SlidersHorizontal } from "lucide-react";
import { TaskCreationWizard } from "@/components/tasks/task-creation-wizard";
import { cn } from "@/lib/utils";

type TaskWorkspaceFiltersProps = {
  search: string;
  setSearch: (value: string) => void;
  roomFilter: string;
  setRoomFilter: (value: string) => void;
  assigneeFilter: string;
  setAssigneeFilter: (value: string) => void;
  overdueOnly: boolean;
  setOverdueOnly: (value: boolean | ((prev: boolean) => boolean)) => void;
  filterType: "active" | "history";
  setFilterType: (value: "active" | "history") => void;
  scope: "mine" | "household";
  rooms: string[];
  members: { id: string; displayName: string }[];
  currentMemberId?: string | null;
  activeRunningSession: boolean;
  setShowOptimizedPicker: (value: boolean) => void;
  householdId: string;
  filteredCount: number;
};

export function TaskWorkspaceFilters({
  search,
  setSearch,
  roomFilter,
  setRoomFilter,
  assigneeFilter,
  setAssigneeFilter,
  overdueOnly,
  setOverdueOnly,
  filterType,
  setFilterType,
  scope,
  rooms,
  members,
  currentMemberId,
  activeRunningSession,
  setShowOptimizedPicker,
  householdId,
  filteredCount,
}: TaskWorkspaceFiltersProps) {
  const hasAdvancedFilters = roomFilter !== "all" || (scope === "household" && assigneeFilter !== "all") || search.length > 0 || overdueOnly;

  return (
    <>
      <section className="app-surface rounded-[1.35rem] p-3 sm:rounded-[1.6rem] sm:p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(13rem,auto)_1fr_auto] xl:items-center">
          <div className="flex min-w-0 items-center gap-2.5">
            <h3 className="display-title min-w-0 truncate text-2xl leading-tight sm:text-[1.65rem]">
              {search ? "Tâches correspondantes" : "Tâches à venir"}
            </h3>
            <div aria-live="polite" className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-glass-bg px-2.5 py-1 text-[11px] font-bold text-ink-500">
              <span className="size-1.5 rounded-full bg-coral-500" />
              {filteredCount}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center xl:justify-end">
            <button
              onClick={() => setFilterType(filterType === "active" ? "history" : "active")}
              className="btn-quiet flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[0.72rem] font-bold sm:justify-start sm:gap-2 sm:px-3 sm:text-xs"
              type="button"
            >
              <div className={cn("size-2 rounded-full", filterType === "active" ? "bg-leaf-500" : "bg-[var(--ink-300)]")} />
              <span className="truncate">{filterType === "active" ? "Historique" : "À faire"}</span>
            </button>

            <button
              className={cn(
                "flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[0.72rem] font-bold transition-all sm:justify-start sm:gap-2 sm:px-3 sm:text-xs",
                overdueOnly
                  ? "border-[var(--status-overdue-border)] bg-[var(--status-overdue-surface)] text-[var(--status-overdue-accent)] shadow-sm"
                  : "btn-quiet text-ink-500"
              )}
              onClick={() => {
                setOverdueOnly((prev) => !prev);
              }}
              type="button"
            >
              <AlertCircle className="size-3.5" />
              Retards
            </button>
            
            {!activeRunningSession && (
              <>
                <button
                  className="btn-primary col-span-2 inline-flex min-h-9 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold sm:col-span-1 sm:px-4"
                  onClick={() => setShowOptimizedPicker(true)}
                  type="button"
                >
                  <Rocket className="size-4" />
                  Optimiser
                </button>
                <TaskCreationWizard 
                  compact 
                  householdId={householdId} 
                  members={members} 
                />
              </>
            )}
          </div>
        </div>

        <details className="group mt-3 border-t border-line pt-3" open={hasAdvancedFilters || undefined}>
          <summary className="flex cursor-pointer items-center justify-between gap-3 list-none text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-500">
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              {hasAdvancedFilters ? "Filtres actifs" : "Recherche et filtres"}
            </span>
            <span className="inline-flex size-7 items-center justify-center rounded-full border border-line bg-white/70 text-ink-500 transition-transform group-open:rotate-180 dark:bg-[#262830]/70">
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </span>
          </summary>

          <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(18rem,1fr)_minmax(10rem,14rem)_minmax(10rem,14rem)_auto] lg:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
              <input
                className="field h-10 w-full pl-9 pr-3 text-sm sm:h-11"
                onChange={(event) => {
                  setSearch(event.currentTarget.value);
                }}
                placeholder="Rechercher une tâche, pièce..."
                type="search"
                value={search}
              />
            </label>

            <select
              className="field h-10 min-w-0 px-3 text-sm font-semibold sm:h-11 sm:min-w-[150px]"
              onChange={(event) => {
                setRoomFilter(event.currentTarget.value);
              }}
              value={roomFilter}
            >
              <option value="all">Toutes les pièces</option>
              {rooms.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>

            {scope === "household" && members.length > 1 ? (
              <select
                className="field h-10 min-w-0 px-3 text-sm font-semibold sm:h-11 sm:min-w-[150px]"
                onChange={(event) => {
                  setAssigneeFilter(event.currentTarget.value);
                }}
                value={assigneeFilter}
              >
                <option value="all">Tout le monde</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            ) : null}

            {hasAdvancedFilters ? (
              <button
                onClick={() => {
                  setRoomFilter("all");
                  setAssigneeFilter("all");
                  setSearch("");
                  setOverdueOnly(false);
                }}
                className="justify-self-start text-[0.65rem] font-bold uppercase tracking-wider text-coral-600 hover:underline sm:justify-self-end"
                type="button"
              >
                Réinitialiser
              </button>
            ) : null}
          </div>
        </details>
      </section>
    </>
  );
}
