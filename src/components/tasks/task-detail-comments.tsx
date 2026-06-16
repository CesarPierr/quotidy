"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Send } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type Comment = { id: string; body: string; authorName: string; createdAt: string };

type TaskDetailCommentsProps = {
  occurrenceId: string;
  currentMemberId?: string | null;
  active: boolean;
};

export function TaskDetailComments({ occurrenceId, currentMemberId, active }: TaskDetailCommentsProps) {
  const { error: showError } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const commentsFetched = useRef(false);

  useEffect(() => {
    if (!active || commentsFetched.current) return;
    commentsFetched.current = true;
    fetch(`/api/occurrences/${occurrenceId}/comments`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setComments(data);
      })
      .catch(() => undefined);
  }, [active, occurrenceId]);

  async function postComment() {
    if (!commentBody.trim() || isPostingComment) return;
    setIsPostingComment(true);
    try {
      const csrfToken = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/)?.[1] ?? "";
      const formData = new FormData();
      formData.set("body", commentBody.trim());
      if (currentMemberId) formData.set("memberId", currentMemberId);
      const res = await fetch(`/api/occurrences/${occurrenceId}/comments`, {
        method: "POST",
        body: formData,
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      });
      if (!res.ok) throw new Error();
      const newComment = (await res.json()) as Comment;
      setComments((prev) => [...prev, newComment]);
      setCommentBody("");
    } catch {
      showError("Impossible d'envoyer le commentaire.");
    } finally {
      setIsPostingComment(false);
    }
  }

  if (!active) return null;

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-center text-sm text-ink-500">Aucun commentaire pour l&apos;instant.</p>
      ) : (
        <ul aria-live="polite" className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl border border-line bg-white/70 dark:bg-surface/70 px-3 py-2.5">
              <p className="text-xs font-semibold text-ink-700">{c.authorName}</p>
              <p className="mt-0.5 text-sm">{c.body}</p>
              <p className="mt-1 text-[0.6rem] text-ink-400">
                {format(new Date(c.createdAt), "d MMM HH:mm", { locale: fr })}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 pt-1">
        <input
          aria-label="Nouveau commentaire"
          className="field flex-1 text-sm"
          onChange={(e) => setCommentBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              postComment();
            }
          }}
          placeholder="Ajouter un commentaire…"
          type="text"
          value={commentBody}
        />
        <button
          aria-label="Envoyer le commentaire"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-coral-500 text-white disabled:opacity-40"
          disabled={!commentBody.trim() || isPostingComment}
          onClick={postComment}
          type="button"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}
