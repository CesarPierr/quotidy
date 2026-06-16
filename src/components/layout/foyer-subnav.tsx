"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AlertTriangle, History, KeyRound, LayoutGrid, Users, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon };

export function FoyerSubnav({ manageable }: { manageable: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const household = useSearchParams().get("household");
  const suffix = household ? `?household=${household}` : "";

  const items: Item[] = [
    { href: "/app/foyer", label: "Membres", icon: Users },
    ...(manageable ? [{ href: "/app/foyer/invitations", label: "Invitations", icon: KeyRound }] : []),
    { href: "/app/foyer/foyers", label: "Foyers", icon: LayoutGrid },
    { href: "/app/foyer/activite", label: "Activité", icon: History },
    { href: "/app/foyer/zone-sensible", label: "Zone sensible", icon: AlertTriangle },
  ];

  useEffect(() => {
    for (const it of items) router.prefetch(`${it.href}${suffix}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manageable, suffix, router]);

  return (
    <nav aria-label="Sections du foyer" className="section-nav mb-4">
      {items.map((it) => {
        const Icon = it.icon;
        // The "Membres" tab is the index — match it exactly so sub-routes don't light it up.
        const active = it.href === "/app/foyer"
          ? pathname === "/app/foyer"
          : pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={`${it.href}${suffix}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-150",
              active
                ? "border-coral-500 bg-white text-coral-600 shadow-[0_8px_20px_rgba(216,100,61,0.08)] dark:bg-[#262830]"
                : "border-line bg-white/80 text-ink-700 hover:border-ink-300 hover:bg-white active:scale-95 dark:bg-[#262830]/80 dark:hover:bg-[#262830]",
            )}
          >
            <Icon className="size-4 opacity-60" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
