"use client";

import { useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { postForm } from "@/lib/api-client";
import { taskPalette } from "@/lib/constants";
import type { SerializedNote } from "@/lib/aide-memoire";
import { cn } from "@/lib/utils";

type NoteEditorProps = {
  householdId: string;
  /** Existing note to edit, or null to create a new one. */
  note: SerializedNote | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (note: SerializedNote) => void;
};

export function NoteEditor({ householdId, note, isOpen, onClose, onSaved }: NoteEditorProps) {
  const { error: showError, success } = useToast();
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [color, setColor] = useState(note?.color ?? "#D8643D");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const trimmed = body.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    try {
      const url = note
        ? `/api/households/${householdId}/notes/${note.id}`
        : `/api/households/${householdId}/notes`;
      const data: Record<string, string> = { body: trimmed, title: title.trim(), color };
      if (note) data._action = "update";
      const response = await postForm(url, data);
      const json = (await response.json()) as { note: SerializedNote };
      onSaved(json.note);
      success("Note enregistrée.");
      onClose();
    } catch {
      showError("Impossible d'enregistrer la note.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={note ? "Modifier la note" : "Nouvelle note"}
      footer={
        <>
          <button className="btn-quiet px-4 py-2.5 text-sm font-semibold" onClick={onClose} type="button">
            Annuler
          </button>
          <button
            className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            disabled={!body.trim() || isSaving}
            onClick={handleSave}
            type="button"
          >
            {note ? "Enregistrer" : "Ajouter"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="field-label">
          <span>Titre (facultatif)</span>
          <input
            className="field"
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Courses"
            type="text"
            value={title}
          />
        </label>
        <label className="field-label">
          <span>Note</span>
          <textarea
            className="field min-h-[6rem] resize-none"
            maxLength={1000}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Acheter du café, appeler le plombier…"
            value={body}
          />
        </label>
        <div className="field-label">
          <span>Couleur</span>
          <div className="flex flex-wrap gap-2">
            {taskPalette.slice(0, 10).map((c) => (
              <button
                aria-label={`Couleur ${c}`}
                aria-pressed={color === c}
                className={cn(
                  "size-8 rounded-full transition-transform",
                  color === c ? "scale-110 ring-2 ring-offset-2 ring-ink-950/30" : "hover:scale-105",
                )}
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                type="button"
              />
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
