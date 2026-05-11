"use client";

import { Home, User } from "lucide-react";

import { cn } from "@/lib/utils";

type MoiFoyerSwitchProps = {
  active: "moi" | "foyer";
  className?: string;
  /** Client-side view change — when provided, the switch works purely
   *  client-side without any navigation. */
  onViewChange?: (view: "moi" | "foyer") => void;
};

export function MoiFoyerSwitch({ active, className, onViewChange }: MoiFoyerSwitchProps) {
  const items = [
    { key: "moi" as const, label: "Moi", Icon: User },
    { key: "foyer" as const, label: "Foyer", Icon: Home },
  ];

  function handleSwitch(key: "moi" | "foyer") {
    if (key === active) return;
    if (onViewChange) {
      onViewChange(key);
    }
  }

  return (
    <div
      className={cn(
        "inline-grid grid-cols-2 gap-1 rounded-full border border-line bg-glass-bg p-1 shadow-sm",
        "min-h-[2.5rem]",
        className,
      )}
      role="tablist"
      aria-label="Vue personnelle ou foyer"
    >
      {items.map(({ key, label, Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            data-client-nav={onViewChange ? "true" : undefined}
            aria-selected={isActive}
            onClick={() => handleSwitch(key)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-all duration-150",
              "min-h-[2rem]",
              isActive
                ? "bg-ink-950 text-white shadow-sm scale-[1.02]"
                : "text-ink-700 hover:text-ink-950 active:scale-95",
            )}
            style={isActive ? { color: "#fff" } : undefined}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
