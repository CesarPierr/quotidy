"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/shared/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      type="button"
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-line px-4 py-2 text-xs font-bold transition-all",
        isDark 
          ? "bg-[rgba(30,31,34,0.4)] text-ink-950 border-white/10" 
          : "bg-white dark:bg-surface text-ink-950 shadow-sm"
      )}
    >
      {isDark ? (
        <>
          <Sun className="size-3.5" />
          <span>Mode Clair</span>
        </>
      ) : (
        <>
          <Moon className="size-3.5" />
          <span>Mode Sombre</span>
        </>
      )}
    </button>
  );
}
