import Link from "next/link";
import { ChevronRight, History, Mail, Users, Warehouse, ShieldAlert, type LucideIcon } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { canManageHousehold, requireHouseholdContext } from "@/lib/households";
import { hexToRgba } from "@/lib/colors";

type FoyerHubProps = {
  searchParams: Promise<{ household?: string }>;
};

type FoyerCard = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  hex: string;
};

export default async function FoyerHubPage({ searchParams }: FoyerHubProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await requireHouseholdContext(user.id, params.household);
  const manageable = canManageHousehold(context.membership.role);

  const suffix = `?household=${context.household.id}`;

  const cards: FoyerCard[] = [
    {
      href: "/app/foyer/membres",
      label: "Membres",
      description: "Profils, couleurs & capacités",
      icon: Users,
      hex: "#d8643d",
    },
    ...(manageable
      ? [
          {
            href: "/app/foyer/invitations",
            label: "Invitations",
            description: "Codes & liens d'accès",
            icon: Mail,
            hex: "#2f6d88",
          },
        ]
      : []),
    {
      href: "/app/foyer/foyers",
      label: "Foyers",
      description: "Changer ou rejoindre un foyer",
      icon: Warehouse,
      hex: "#38735d",
    },
    {
      href: "/app/foyer/activite",
      label: "Activité",
      description: "Historique des actions",
      icon: History,
      hex: "#545c68",
    },
    {
      href: "/app/foyer/zone-sensible",
      label: "Zone sensible",
      description: "Quitter, transférer & supprimer",
      icon: ShieldAlert,
      hex: "#b3492c",
    },
  ];

  return (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="px-1">
        <p className="section-kicker">Foyer</p>
        <h2 className="display-title mt-1 text-3xl leading-tight sm:text-4xl">
          {context.household.name}
        </h2>
        <p className="mt-1 text-sm font-medium text-ink-500">Membres, accès & paramètres du foyer.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={`${card.href}${suffix}`}
              className="soft-panel interactive-surface group flex min-h-[7.5rem] flex-col justify-between p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
              style={{ background: hexToRgba(card.hex, 0.08) }}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="flex size-11 items-center justify-center rounded-2xl"
                  style={{ background: hexToRgba(card.hex, 0.16), color: card.hex }}
                >
                  <Icon className="size-5" />
                </span>
                <ChevronRight className="size-4 text-ink-400 transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-ink-950">{card.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-ink-500">{card.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
