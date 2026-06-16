"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { ACCENT_HEX, visibleSections } from "@/lib/app-sections";
import { hexToRgba } from "@/lib/colors";

type SectionLauncherProps = {
  householdId: string;
  householdName: string;
  firstName: string;
  savingsEnabled: boolean;
  /** Optional live badges keyed by section href. */
  counts?: Record<string, string | undefined>;
};

export function SectionLauncher({
  householdId,
  householdName,
  firstName,
  savingsEnabled,
  counts = {},
}: SectionLauncherProps) {
  const sections = visibleSections(savingsEnabled);
  const suffix = `?household=${householdId}`;

  return (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="px-1">
        <p className="section-kicker">{householdName}</p>
        <h2 className="display-title mt-1 text-3xl leading-tight sm:text-4xl">
          Bonjour {firstName}
        </h2>
        <p className="mt-1 text-sm font-medium text-ink-500">Où veux-tu aller ?</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sections.map((section) => {
          const hex = ACCENT_HEX[section.accent];
          const Icon = section.icon;
          const badge = counts[section.href];
          return (
            <Link
              key={section.href}
              href={`${section.href}${suffix}`}
              className="soft-panel interactive-surface group flex min-h-[7.5rem] flex-col justify-between p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
              style={{ background: hexToRgba(hex, 0.08) }}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="flex size-11 items-center justify-center rounded-2xl"
                  style={{ background: hexToRgba(hex, 0.16), color: hex }}
                >
                  <Icon className="size-5" />
                </span>
                {badge ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold"
                    style={{ background: hexToRgba(hex, 0.16), color: hex }}
                  >
                    {badge}
                  </span>
                ) : (
                  <ChevronRight className="size-4 text-ink-400 transition-transform group-hover:translate-x-0.5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-ink-950">{section.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-ink-500">{section.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
