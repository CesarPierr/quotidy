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
- MCP server exposed via `scripts/mcp/server.ts`

## Layout

```
src/
  app/
    app/              authenticated UI (App Router segments)
      page.tsx        dashboard (today-first on mobile)
      my-tasks/
      calendar/
      history/
      settings/       sub-routes: team, access, planning, danger, households, integrations, savings, holidays, activity
    api/              JSON endpoints (households, tasks, occurrences, members, auth, ...)
    page.tsx          public landing
  components/
    tasks/            occurrence-card, task-creation-steps, filters
    savings/          box-card, transfer-sheet, calculators
    calendar/         month-view, mobile-agenda, sync-panel
    dashboard/        focus-session, stats-drawer
    settings/         integration-settings, push-toggle
    layout/           app-shell, home-header
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
npm run mcp:smoke        # MCP integration smoke test
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
- **Tailwind 4** has no `tailwind.config.js`. Custom tokens live in `src/app/globals.css` under `@theme inline`. We use `@custom-variant dark` tied to `data-theme="dark"` for dark mode. Do not use dirty `.bg-white` global overrides.
- The scheduling engine (`src/lib/scheduling/`) has subtle invariants (overrides vs templates, absences vs skips). Always reproduce a bug as a Vitest case in `tests/` before changing the engine. Tests are the spec.

## Where the work stands

- ✅ Mobile UX foundation shipped — bottom sheet, compact cards, toast system, PWA, onboarding, calendar agenda.
- ✅ Savings & Budgeting — fully functional `epargne` module with transaction history, auto-fill calculation engine, and cross-currency precision.
- ✅ Architecture — components extracted into strict domain folders (`tasks/`, `savings/`, `calendar/`, etc.). Tailwind v4 theming standardized without dirty global overrides.
- ✅ Hardening Complete — rate limiting, CSP, CSRF, structured API logging (`src/lib/api.ts`), and native dark mode fully implemented. E2E tests removed in favor of robust Vitest unit tests.
- 🟡 Engagement in progress — streak UI, comments on occurrences.
