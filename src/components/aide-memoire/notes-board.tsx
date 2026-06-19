"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";

import { NoteEditor } from "@/components/aide-memoire/note-editor";
import { BottomSheet, BottomSheetAction } from "@/components/ui/bottom-sheet";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { postForm } from "@/lib/api-client";
import { buildEntry, enqueue, newOutboxId } from "@/lib/offline-outbox";
import { useOnline } from "@/lib/use-online";
import { taskPalette } from "@/lib/constants";
import type { SerializedNote } from "@/lib/aide-memoire";
import { hexToRgba } from "@/lib/colors";
import { cn } from "@/lib/utils";

type NotesBoardProps = {
  householdId: string;
  initialActive: SerializedNote[];
  initialDone: SerializedNote[];
  retentionDays: number;
  /** Compact = dashboard card: caps the active list and hides the "Fait" panel. */
  compact?: boolean;
  /** Where the "Tout voir" link points (compact mode only). */
  seeAllHref?: string;
};

const COMPACT_LIMIT = 4;
const QUICK_COLORS = taskPalette.slice(0, 6);

function sortActive(notes: SerializedNote[]): SerializedNote[] {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt); // FIFO
  });
}

// Module-level so the impure new Date() isn't flagged as called during render.
function buildOptimisticNote(id: string, body: string, color: string): SerializedNote {
  return {
    id,
    title: null,
    body,
    color,
    isPinned: false,
    sortOrder: 0,
    completedAt: null,
    createdAt: new Date().toISOString(),
    createdByName: null,
    completedByName: null,
  };
}

function withCompletedNow(note: SerializedNote): SerializedNote {
  return { ...note, completedAt: new Date().toISOString() };
}

export function NotesBoard({
  householdId,
  initialActive,
  initialDone,
  retentionDays,
  compact = false,
  seeAllHref,
}: NotesBoardProps) {
  const { error: showError, success } = useToast();
  const online = useOnline();
  const [active, setActive] = useState<SerializedNote[]>(() => sortActive(initialActive));
  const [done, setDone] = useState<SerializedNote[]>(initialDone);
  const [draft, setDraft] = useState("");
  const [quickColor, setQuickColor] = useState<string>(QUICK_COLORS[0] ?? "#D8643D");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [menuNote, setMenuNote] = useState<SerializedNote | null>(null);
  const [editingNote, setEditingNote] = useState<SerializedNote | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SerializedNote | null>(null);
  const [showDone, setShowDone] = useState(false);

  const visibleActive = compact ? active.slice(0, COMPACT_LIMIT) : active;

  const notesUrl = `/api/households/${householdId}/notes`;

  // Offline capture: queue the create with a client id (idempotent upsert on
  // replay) and show the note immediately.
  function queueNewNote(trimmed: string, color: string) {
    const id = newOutboxId("note");
    void enqueue(buildEntry({ id, url: notesUrl, fields: { id, body: trimmed, color }, label: "Note" })).catch(() => undefined);
    setActive((prev) => sortActive([...prev, buildOptimisticNote(id, trimmed, color)]));
    setDraft("");
    success("Note enregistrée hors-ligne · synchro au retour du réseau.");
  }

  // Offline toggle: queue complete/uncomplete (keyed per note+action so a
  // re-tap overwrites) and move the note between the active/done lists.
  function queueToggle(note: SerializedNote, action: "complete" | "uncomplete") {
    const url = `${notesUrl}/${note.id}`;
    void enqueue(
      buildEntry({ id: `note-${action}-${note.id}`, url, fields: { _action: action }, label: action === "complete" ? "Note faite" : "Note à refaire" }),
    ).catch(() => undefined);
    if (action === "complete") {
      setActive((prev) => prev.filter((n) => n.id !== note.id));
      setDone((prev) => [withCompletedNow(note), ...prev]);
    } else {
      setDone((prev) => prev.filter((n) => n.id !== note.id));
      setActive((prev) => sortActive([...prev, { ...note, completedAt: null }]));
    }
    success("Enregistré hors-ligne · synchro au retour du réseau.");
  }

  async function handleQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isAdding) return;
    if (!online || !navigator.onLine) {
      queueNewNote(trimmed, quickColor);
      return;
    }
    setIsAdding(true);
    try {
      const response = await postForm(notesUrl, { body: trimmed, color: quickColor });
      const json = (await response.json()) as { note: SerializedNote };
      setActive((prev) => sortActive([...prev, json.note]));
      setDraft("");
    } catch {
      if (!navigator.onLine) queueNewNote(trimmed, quickColor);
      else showError("Impossible d'ajouter la note.");
    } finally {
      setIsAdding(false);
    }
  }

  async function noteAction(note: SerializedNote, action: string, extra?: Record<string, string>) {
    if (!online || !navigator.onLine) {
      if (action === "complete" || action === "uncomplete") queueToggle(note, action);
      else showError("Action indisponible hors-ligne.");
      return;
    }
    setBusyId(note.id);
    try {
      const response = await postForm(`/api/households/${householdId}/notes/${note.id}`, {
        _action: action,
        ...extra,
      });

      if (action === "delete") {
        setActive((prev) => prev.filter((n) => n.id !== note.id));
        setDone((prev) => prev.filter((n) => n.id !== note.id));
        success("Note supprimée.");
        return;
      }

      const json = (await response.json()) as { note: SerializedNote };
      const updated = json.note;
      if (action === "complete") {
        setActive((prev) => prev.filter((n) => n.id !== note.id));
        setDone((prev) => [updated, ...prev]);
        success("Note classée dans « Fait ».");
      } else if (action === "uncomplete") {
        setDone((prev) => prev.filter((n) => n.id !== note.id));
        setActive((prev) => sortActive([...prev, updated]));
      } else {
        // pin / update
        setActive((prev) => sortActive(prev.map((n) => (n.id === note.id ? updated : n))));
      }
    } catch {
      if (!navigator.onLine && (action === "complete" || action === "uncomplete")) queueToggle(note, action);
      else showError("Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  function onSaved(saved: SerializedNote) {
    setActive((prev) =>
      prev.some((n) => n.id === saved.id)
        ? sortActive(prev.map((n) => (n.id === saved.id ? saved : n)))
        : sortActive([...prev, saved]),
    );
  }

  return (
    <div className="space-y-3">
      {/* Quick capture */}
      <form className="space-y-2.5" onSubmit={handleQuickAdd}>
        <div className="flex items-center gap-2">
          <label className="flex-1">
            <span className="sr-only">Nouvelle note du foyer</span>
            <input
              aria-label="Nouvelle note"
              className="field h-11 w-full"
              disabled={isAdding}
              maxLength={1000}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Noter un truc à ne pas oublier…"
              type="text"
              value={draft}
            />
          </label>
          <button
            aria-label="Ajouter la note"
            className="btn-primary inline-flex size-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
            disabled={!draft.trim() || isAdding}
            type="submit"
          >
            <Plus className="size-5" />
          </button>
        </div>
        {!compact ? (
          <div className="flex items-center gap-2 px-0.5">
            <span className="text-[0.7rem] font-medium text-ink-400">Couleur</span>
            <div className="flex items-center gap-1.5">
              {QUICK_COLORS.map((c) => (
                <button
                  aria-label={`Couleur ${c}`}
                  aria-pressed={quickColor === c}
                  className={cn(
                    "size-5 rounded-full transition-transform",
                    quickColor === c
                      ? "scale-110 ring-2 ring-ink-950/25 ring-offset-1"
                      : "opacity-60 hover:scale-110 hover:opacity-100",
                  )}
                  key={c}
                  onClick={() => setQuickColor(c)}
                  style={{ backgroundColor: c }}
                  type="button"
                />
              ))}
            </div>
          </div>
        ) : null}
      </form>

      {/* Active notes */}
      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-7 text-center">
          <NotebookPen className="size-6 text-ink-300" />
          <p className="text-sm text-ink-500">Rien à retenir pour le moment. Notez vos rappels du foyer ici.</p>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Notes à traiter" aria-live="polite">
          {visibleActive.map((note) => (
            <li
              className={cn(
                "soft-panel flex items-start gap-2.5 p-2.5",
                note.isPinned && "ring-1 ring-coral-500/25",
              )}
              key={note.id}
              style={{ background: hexToRgba(note.color, 0.1) }}
            >
              <button
                aria-label="Marquer comme fait"
                className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-black/[0.05] hover:text-leaf-600 disabled:opacity-50"
                disabled={busyId === note.id}
                onClick={() => noteAction(note, "complete")}
                type="button"
              >
                <Circle className="size-5" />
              </button>
              <div className="min-w-0 flex-1 py-1">
                {note.title ? <p className="text-sm font-bold text-ink-950">{note.title}</p> : null}
                <p className="whitespace-pre-wrap break-words text-sm text-ink-800">{note.body}</p>
                {note.isPinned ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wide text-coral-600">
                    <Pin className="size-3" /> Épinglé
                  </span>
                ) : null}
                {!compact && (note.createdByName || note.createdAt) ? (
                  <p className="mt-1 text-[0.68rem] text-ink-400">
                    {note.createdByName ? `${note.createdByName} · ` : ""}
                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: fr })}
                  </p>
                ) : null}
              </div>
              <button
                aria-label="Options de la note"
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-black/[0.05]"
                onClick={() => setMenuNote(note)}
                type="button"
              >
                <MoreHorizontal className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Compact: link to the full hub */}
      {compact && seeAllHref ? (
        <Link
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-line py-2.5 text-sm font-semibold text-sky-600 transition-colors hover:bg-white/60"
          href={seeAllHref}
        >
          Ouvrir l&apos;aide-mémoire
          {active.length > COMPACT_LIMIT ? ` (${active.length - COMPACT_LIMIT} de plus)` : ""}
          <ArrowRight className="size-4" />
        </Link>
      ) : null}

      {/* Done list (full mode only) */}
      {!compact && done.length > 0 ? (
        <div className="pt-1">
          <button
            aria-expanded={showDone}
            className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-black/[0.03]"
            onClick={() => setShowDone((v) => !v)}
            type="button"
          >
            <span className="flex items-center gap-2">
              <Check className="size-4 text-leaf-600" />
              Fait ({done.length})
            </span>
            <ChevronDown className={cn("size-4 transition-transform", showDone && "rotate-180")} />
          </button>
          {showDone ? (
            <div className="mt-1 space-y-2">
              <p className="px-2 text-xs text-ink-500">
                Les notes faites sont supprimées automatiquement après {retentionDays}&nbsp;jour
                {retentionDays > 1 ? "s" : ""}.
              </p>
              <ul className="space-y-2" aria-label="Notes faites" aria-live="polite">
                {done.map((note) => (
                  <li
                    className="flex items-start gap-2.5 rounded-2xl border border-line bg-white/50 p-2.5 dark:bg-white/[0.03]"
                    key={note.id}
                  >
                    <button
                      aria-label="Remettre à faire"
                      className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-leaf-600 transition-colors hover:bg-black/[0.05] disabled:opacity-50"
                      disabled={busyId === note.id}
                      onClick={() => noteAction(note, "uncomplete")}
                      type="button"
                    >
                      <CheckCircle2 className="size-5" />
                    </button>
                    <div className="min-w-0 flex-1 py-1">
                      {note.title ? (
                        <p className="text-sm font-semibold text-ink-500 line-through">{note.title}</p>
                      ) : null}
                      <p className="whitespace-pre-wrap break-words text-sm text-ink-500 line-through">
                        {note.body}
                      </p>
                    </div>
                    <button
                      aria-label="Annuler (remettre à faire)"
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-black/[0.05] hover:text-ink-700 disabled:opacity-50"
                      disabled={busyId === note.id}
                      onClick={() => noteAction(note, "uncomplete")}
                      type="button"
                    >
                      <Undo2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Per-note action sheet */}
      <BottomSheet isOpen={menuNote !== null} onClose={() => setMenuNote(null)} title="Note">
        {menuNote ? (
          <div className="space-y-1">
            <BottomSheetAction
              icon={menuNote.isPinned ? PinOff : Pin}
              label={menuNote.isPinned ? "Désépingler" : "Épingler"}
              onClick={() => {
                const target = menuNote;
                setMenuNote(null);
                noteAction(target, "pin");
              }}
            />
            <BottomSheetAction
              icon={Pencil}
              label="Modifier"
              onClick={() => {
                setEditingNote(menuNote);
                setEditorOpen(true);
                setMenuNote(null);
              }}
            />
            <BottomSheetAction
              icon={Trash2}
              label="Supprimer"
              variant="danger"
              onClick={() => {
                setConfirmDelete(menuNote);
                setMenuNote(null);
              }}
            />
          </div>
        ) : null}
      </BottomSheet>

      {/* Edit dialog */}
      {editorOpen ? (
        <NoteEditor
          householdId={householdId}
          isOpen={editorOpen}
          note={editingNote}
          onClose={() => {
            setEditorOpen(false);
            setEditingNote(null);
          }}
          onSaved={onSaved}
        />
      ) : null}

      {/* Delete confirmation */}
      <Dialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Supprimer cette note ?"
        type="danger"
        footer={
          <>
            <button className="btn-quiet px-4 py-2.5 text-sm font-semibold" onClick={() => setConfirmDelete(null)} type="button">
              Annuler
            </button>
            <button
              className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              onClick={() => {
                const target = confirmDelete;
                setConfirmDelete(null);
                if (target) noteAction(target, "delete");
              }}
              type="button"
            >
              Supprimer
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-700">Cette note sera définitivement supprimée.</p>
      </Dialog>
    </div>
  );
}
