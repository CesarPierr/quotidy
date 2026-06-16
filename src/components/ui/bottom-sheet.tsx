"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Max height as vh percentage (default 85) */
  maxHeight?: number;
}

interface BottomSheetActionProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onClick?: () => void;
  variant?: "default" | "danger" | "success";
  disabled?: boolean;
  type?: "button" | "submit";
}

export function BottomSheetAction({
  icon: Icon,
  label,
  hint,
  onClick,
  variant = "default",
  disabled = false,
  type = "button",
}: BottomSheetActionProps) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all active:scale-[0.98]",
        variant === "danger"
          ? "text-red-700 hover:bg-red-50"
          : variant === "success"
            ? "text-leaf-600 hover:bg-[rgba(56,115,93,0.08)]"
            : "text-ink-950 hover:bg-black/[0.04]",
        disabled && "pointer-events-none opacity-40",
      )}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {Icon ? <Icon className="size-5 shrink-0 opacity-70" /> : null}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm">{label}</p>
        {hint ? <p className="text-xs text-ink-500 mt-0.5">{hint}</p> : null}
      </div>
    </button>
  );
}

export function BottomSheet({ isOpen, onClose, title, children, maxHeight = 85 }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  // Keep the dialog mounted/open while it animates out so the exit transition is visible.
  const [rendered, setRendered] = useState(isOpen);
  const [visible, setVisible] = useState(false);

  // Open/close dialog with an enter + exit transition.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRendered(true);
      if (!dialog.open) {
        dialog.showModal();
        document.body.style.overflow = "hidden";
      }
      // Flip to the visible state on the next frame so the transition runs.
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    // Closing: animate out, then unmount/close the dialog.
    setVisible(false);
    if (dialog.open) {
      const timer = setTimeout(() => {
        if (dialog.open) dialog.close();
        document.body.style.overflow = "";
        setRendered(false);
      }, 220);
      return () => clearTimeout(timer);
    }
    document.body.style.overflow = "";
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  // Handle swipe down to dismiss
  useEffect(() => {
    const content = contentRef.current;
    if (!content || !isOpen) return;

    const handleTouchStart = (e: TouchEvent) => {
      startYRef.current = e.touches[0].clientY;
      currentYRef.current = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const deltaY = e.touches[0].clientY - startYRef.current;
      currentYRef.current = deltaY;

      // Only allow downward swipe when at top of scroll
      if (deltaY > 0 && content.scrollTop <= 0) {
        content.style.transform = `translateY(${Math.min(deltaY * 0.5, 200)}px)`;
        content.style.transition = "none";
      }
    };

    const handleTouchEnd = () => {
      content.style.transition = "transform 200ms ease";
      content.style.transform = "";

      if (currentYRef.current > 100 && content.scrollTop <= 0) {
        onClose();
      }
    };

    content.addEventListener("touchstart", handleTouchStart, { passive: true });
    content.addEventListener("touchmove", handleTouchMove, { passive: true });
    content.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      content.removeEventListener("touchstart", handleTouchStart);
      content.removeEventListener("touchmove", handleTouchMove);
      content.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isOpen, onClose]);

  // Handle escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed inset-0 m-0 h-full w-full max-w-none max-h-none bg-transparent p-0 open:animate-none",
        "backdrop:bg-black/40 backdrop:backdrop-blur-sm backdrop:transition-opacity backdrop:duration-200",
        visible ? "backdrop:opacity-100" : "backdrop:opacity-0",
      )}
      onClick={handleBackdropClick}
      onClose={onClose}
    >
      <div className="flex h-full w-full items-end justify-center">
        <div
          ref={contentRef}
          className={cn(
            "w-full rounded-t-3xl bg-[var(--card)] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] overflow-hidden",
            "transition-transform duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none",
            visible ? "translate-y-0" : "translate-y-full",
          )}
          style={{
            maxHeight: `${maxHeight}vh`,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-black/15" />
          </div>

          {/* Header */}
          {title ? (
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-2">
              <h3 className="text-lg font-bold text-ink-950">{title}</h3>
              <button
                aria-label="Fermer"
                className="flex size-11 items-center justify-center rounded-full bg-black/[0.06] text-ink-700 transition-colors hover:bg-black/10 active:scale-90"
                onClick={onClose}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
          ) : null}

          {/* Content */}
          <div
            className="overflow-y-auto overscroll-contain px-4 pb-12"
            style={{ maxHeight: `calc(${maxHeight}vh - 4rem)` }}
          >
            {rendered ? children : null}
          </div>
        </div>
      </div>
    </dialog>
  );
}
