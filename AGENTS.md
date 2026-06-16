# AGENTS.md — quotidy

Brief for AI coding agents working on this repo. Read this before exploring.

## What this app is

A household chore-coordination and shared savings web app for couples / colocs / families. Generates recurring task occurrences, attributes them fairly between members, manages shared budget boxes, and exposes a mobile-first dashboard. Production target: 100 first users.

## Stack

- Next.js 16 (App Router), React 19, TypeScript strict
- Prisma 6 + PostgreSQL
- Tailwind 4 (no `tailwind.config.js` — config inline in `globals.css`)
- Vitest 4 (unit)
- PWA: manifest + service worker in `public/`
- Auth: cookie sessions in `src/lib/auth.ts`
- Five top-level "spaces" driven by `src/lib/app-sections.ts` (Tâches, Aide-mémoire, Épargne, Foyer, Compte)

## Layout

```
src/
  app/
    app/              authenticated UI — one folder per space
      page.tsx        home launcher (grid of the 5 spaces) + onboarding gate
      taches/         aujourd-hui, calendar, routines, disponibilites
      aide-memoire/   foyer notes + reusable checklists
      epargne/        savings boxes + calculators
      foyer/          matrix hub: membres, invitations, foyers, activite, zone-sensible
      compte/         profile, security, RGPD, notifications
      admin/          aggregated PII-free metrics
      settings/       legacy redirect stubs only (old links)
    api/              JSON / FormData endpoints (households, tasks, occurrences, members, auth, metrics, ...)
    page.tsx          public landing
  components/
    tasks/            occurrence-card, task-creation-steps, filters
    savings/          box-card, transfer-sheet, calculators
    calendar/         month-view, mobile-agenda, sync-panel
    dashboard/        section-launcher, focus-session, stats
    foyer/            membres + matrix sub-sections
    onboarding/       3-step starter + feature tour
    settings/         push-toggle, feature toggles
    layout/           app-shell (desktop sidebar + mobile Retour/Accueil)
    shared/           theme-toggle, pwa-banner
    ui/               primitives: dialog, bottom-sheet, toast
  lib/
    scheduling/       recurrence + attribution engine (heavily tested — touch with care)
    analytics.ts      streaks, scores, completion rates
    use-form-action.ts unified form submission hook
    validation.ts     Zod schemas (server-side)
    auth.ts, db.ts, time.ts, date-input.ts
  middleware.ts       rate limiting (auth 10/min, occurrences 30/min, invites 5/min, fallback 120/min)
prisma/schema.prisma  source of truth for the data model
tests/                Vitest unit tests (one per lib module)
public/               static assets, manifest.json, sw.js
```

## Commands

```bash
npm run dev              # next dev (port 3000)
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm test                 # vitest run --coverage
npm run db:migrate       # after any schema.prisma change
npm run db:generate      # regenerate prisma client
```

**Pre-commit gate** (run all three): `npm run lint && npm run typecheck && npm test`

## Conventions — follow these

1. **Forms** must use `useFormAction` ([src/lib/use-form-action.ts](src/lib/use-form-action.ts)). Do not reintroduce `<form action="/api/...">` with native POST — they bypass toast feedback and full-page reload.
2. **User actions** must surface a `useToast()` (success or error). No silent success.
3. **Mobile first**: design and verify at 375×812 viewport. On mobile, secondary actions go in `<BottomSheet>`, not `<Dialog>`.
4. **OccurrenceCard** has a `compact` prop — use it on mobile lists (already wired in dashboard).
5. **Dates**: use helpers in `src/lib/date-input.ts` and `src/lib/time.ts`. Never `new Date(x).toISOString().split("T")[0]` — that drifts a day across timezones. The bug came back twice; don't be the third.
6. **Validation**: define Zod schemas in `src/lib/validation.ts` and reuse in routes. Don't redefine inline.
7. **No file > 500 lines** without a clear reason. Use domain-driven subcomponents instead of monolithic files.
8. **Imports**: use `@/` alias (configured in `tsconfig.json`).
9. **Server-only modules**: import `server-only` at top of any `src/lib/*.ts` that touches the DB or secrets.

## Pitfalls

- **CSP** in [next.config.ts](next.config.ts) is strict. Any new external origin (CDN, font, image, push provider) must be added or the page silently breaks.
- **Rate limiter** ([src/middleware.ts](src/middleware.ts)) hits hard on auth/invites in tests. Set `RATE_LIMIT_DISABLED=1` in `.env.local` if it bothers you.
- **Service worker** ([public/sw.js](public/sw.js)) caches aggressively. Bump `CACHE_VERSION` whenever you change cached assets, or browsers serve stale UI.
- **Prisma migrations**: always `npm run db:migrate` locally — `db:push` skips migration history and breaks deploy.
- **Tailwind 4** has no `tailwind.config.js`. Custom tokens live in `src/app/globals.css` under `@theme inline`. We use `@custom-variant dark` tied to `data-theme="dark"` for dark mode. Dark card/panel surfaces use the `surface` token (`dark:bg-surface`, opacity variants OK) — never the `#262830` literal. Do not use dirty `.bg-white` global overrides.
- The scheduling engine (`src/lib/scheduling/`) has subtle invariants (overrides vs templates, absences vs skips). Always reproduce a bug as a Vitest case in `tests/` before changing the engine. Tests are the spec.

## Where the work stands

- ✅ **5-space IA** — Tâches / Aide-mémoire / Épargne / Foyer / Compte, one source of truth in `src/lib/app-sections.ts`. Mobile nav = Retour + Accueil; Foyer is a card matrix.
- ✅ **Savings & budgeting** — `epargne` module with transaction history, auto-fill calculation engine, cross-currency precision; smoother mobile sheets/animations.
- ✅ **Aide-mémoire** — foyer notes (FIFO + auto-purge) and reusable checklists.
- ✅ **Onboarding** — 3-step, skippable, resumable, zero mid-flow DB writes.
- ✅ **Hardening** — rate limiting, CSP, CSRF, structured logging, hardened Docker (read-only / cap-drop / non-root), right-most XFF, PII-free telemetry. E2E removed in favor of Vitest units.
- ✅ **Admin** — aggregated PII-free metrics + feedback triage (`src/lib/admin-stats.ts`).
- 🟡 **Next** — externalize the in-memory rate limiter before multi-instance; richer equity stats.

See [CHANGELOG.md](CHANGELOG.md) for the full history.
