import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  House,
  LayoutGrid,
  Shuffle,
  Star,
  Users,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { QuotidyLogo } from "@/components/shared/quotidy-logo";

const features = [
  {
    icon: CheckCircle2,
    title: "Actions en 1 geste",
    description: "Marquer fait, reporter ou réassigner depuis votre téléphone sans ouvrir dix écrans.",
    accent: "var(--leaf-600)",
    bg: "rgba(56,115,93,0.1)",
  },
  {
    icon: Shuffle,
    title: "Rotation juste et compréhensible",
    description: "Alternance stricte, round-robin ou équilibrage par charge avec des règles lisibles pour tous.",
    accent: "var(--coral-600)",
    bg: "rgba(216,100,61,0.1)",
  },
  {
    icon: CalendarDays,
    title: "Vue semaine et calendrier",
    description: "Qui fait quoi aujourd'hui, cette semaine et sur le mois — export iCal inclus.",
    accent: "var(--sky-600)",
    bg: "rgba(47,109,136,0.1)",
  },
  {
    icon: Users,
    title: "Conçu pour vivre ensemble",
    description: "Couple, colocation, famille — ajoutez des membres, gérez les absences, recalculez en 1 clic.",
    accent: "var(--leaf-600)",
    bg: "rgba(56,115,93,0.1)",
  },
  {
    icon: LayoutGrid,
    title: "Dashboard quotidien clair",
    description: "Les tâches du jour apparaissent en premier sur mobile. Plus besoin de chercher quoi faire.",
    accent: "var(--coral-600)",
    bg: "rgba(216,100,61,0.1)",
  },
  {
    icon: Clock3,
    title: "Planification automatique",
    description: "Définissez les récurrences une fois. L'app gère l'attribution et les rappels pour vous.",
    accent: "var(--sky-600)",
    bg: "rgba(47,109,136,0.1)",
  },
];

const testimonials = [
  {
    quote: "On a enfin arrêté de se disputer pour qui fait la vaisselle. Le planning tourne tout seul.",
    author: "Sophie & Martin",
    tag: "Couple",
  },
  {
    quote: "En coloc à 4, c'est la première appli qui marche vraiment. La rotation est vraiment équitable.",
    author: "Lucas",
    tag: "Colocation",
  },
  {
    quote: "J'adore pouvoir voir les tâches de toute la semaine sur le calendrier. Les enfants adorent aussi.",
    author: "Amélie",
    tag: "Famille",
  },
];

const stats = [
  { value: "< 2 min", label: "Pour créer un foyer" },
  { value: "6 modes", label: "De rotation des tâches" },
  { value: "100%", label: "Auto-hébergeable" },
  { value: "Mobile", label: "First, toujours" },
];

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/app");
  }

  return (
    <main className="min-h-screen bg-sand-50">
      {/* Nav */}
      <header className="sticky top-0 z-20 mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <div className="app-surface flex items-center justify-between rounded-[2rem] px-5 py-3.5">
          <QuotidyLogo size={28} />
          <div className="flex items-center gap-2">
            <Link
              className="hidden px-4 py-2 text-sm font-semibold text-ink-700 hover:text-ink-950 sm:inline-flex"
              href="/login"
            >
              Connexion
            </Link>
            <Link
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold"
              href="/register"
            >
              Commencer
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-12">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[rgba(56,115,93,0.12)] px-3 py-1.5 text-sm font-semibold text-leaf-600">
              <House className="size-4" />
              Couple · Famille · Colocation
            </div>
            <h1 className="display-title text-4xl leading-tight sm:text-5xl lg:text-6xl">
              Organisez vos routines et votre budget.{" "}
              <span style={{ color: "var(--coral-600)" }}>Partagez</span> les responsabilités équitablement.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-700">
              Organisez votre quotidien. N&apos;oubliez plus rien.
              Planning automatique, rotation juste et épargne partagée — conçu pour le mobile,
              auto-hébergeable, et pensé pour les groupes qui veulent une vraie organisation sans friction.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold"
                href="/register"
              >
                Créer un foyer gratuitement
                <ArrowRight className="size-4" />
              </Link>
              <Link
                className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base"
                href="/login"
              >
                Se connecter
              </Link>
            </div>
            {/* Social proof */}
            <div className="mt-6 flex items-center gap-3">
              <div className="flex -space-x-2">
                {["#C56A3A", "#2E6D88", "#3F7E66", "#6B5A92"].map((c) => (
                  <div
                    key={c}
                    className="size-8 rounded-full border-2 border-white"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="text-sm text-[var(--ink-600)]">
                <span className="font-bold text-ink-950">100+</span> foyers déjà organisés
              </p>
            </div>
          </div>

          {/* Hero visual — stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {stats.map(({ value, label }) => (
              <div key={label} className="app-surface rounded-[1.8rem] p-5 text-center">
                <p className="display-title text-3xl font-bold sm:text-4xl">{value}</p>
                <p className="mt-1 text-sm text-[var(--ink-600)]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-10 text-center">
          <p className="section-kicker">Fonctionnalités</p>
          <h2 className="display-title mt-2 text-3xl sm:text-4xl">Tout ce dont un foyer a besoin</h2>
          <p className="mt-3 text-[var(--ink-600)]">Simple à prendre en main, puissant quand on en a besoin.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description, accent, bg }) => (
            <article
              key={title}
              className="app-surface rounded-[2rem] p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div
                className="mb-4 inline-flex rounded-2xl p-3"
                style={{ backgroundColor: bg, color: accent }}
              >
                <Icon className="size-5" />
              </div>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-700">{description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-10 text-center">
          <p className="section-kicker">Témoignages</p>
          <h2 className="display-title mt-2 text-3xl sm:text-4xl">Ce qu&apos;ils en disent</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {testimonials.map(({ quote, author, tag }) => (
            <article key={author} className="app-surface rounded-[2rem] p-6">
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="size-4 fill-[var(--coral-400)] text-[var(--coral-400)]" />
                ))}
              </div>
              <p className="text-sm leading-6 text-ink-700 italic">&ldquo;{quote}&rdquo;</p>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm font-bold">{author}</p>
                <span className="rounded-full bg-[rgba(216,100,61,0.1)] px-2.5 py-0.5 text-xs font-semibold text-coral-600">
                  {tag}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div
          className="rounded-[2.5rem] p-8 text-center sm:p-12"
          style={{
            background: "linear-gradient(135deg, rgba(216,100,61,0.12) 0%, rgba(56,115,93,0.08) 100%)",
            border: "1px solid rgba(216,100,61,0.15)",
          }}
        >
          <h2 className="display-title text-3xl sm:text-4xl">
            Prêt à organiser votre quotidien ?
          </h2>
          <p className="mt-4 text-ink-700">
            Gratuit, sans engagement. Votre premier foyer est opérationnel en moins de 2 minutes.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              className="btn-primary inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold"
              href="/register"
            >
              Créer mon foyer maintenant
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-8 text-center text-sm text-ink-500">
        <p>© {new Date().getFullYear()} {APP_NAME} · Bêta ouverte · Conçu avec soin</p>
        <div className="mt-2 flex justify-center gap-4 text-xs">
          <Link href="/login" className="hover:text-ink-700">Connexion</Link>
          <Link href="/register" className="hover:text-ink-700">Inscription</Link>
          <Link href="/privacy" className="hover:text-ink-700">Confidentialité</Link>
          <Link href="/terms" className="hover:text-ink-700">CGU</Link>
          <Link href="/contact" className="hover:text-ink-700">Contact</Link>
          <Link href="/support" className="hover:text-ink-700">Soutenir</Link>
        </div>
      </footer>
    </main>
  );
}
