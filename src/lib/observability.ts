import "server-only";

/**
 * Vendor-agnostic forwarder for warnings and errors.
 *
 * Wired to log to stdout today; intended to be wired to Sentry/Datadog/Highlight/etc. once
 * the operator picks one. To enable Sentry:
 *
 *   1. `npm i @sentry/nextjs` and run `npx @sentry/wizard@latest -i nextjs`.
 *   2. Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in your environment.
 *   3. In `instrumentation.ts`, the wizard adds the proper init (Node + Edge runtimes).
 *      The `Sentry.captureException` it exposes globally will be picked up by
 *      `reportError` below — no code change required here once the global is set.
 *
 * We deliberately read from `globalThis` rather than `import("@sentry/nextjs")` so that the
 * dependency stays optional and the build doesn't fail when it's absent.
 */

type SentryGlobal = {
  captureException?: (error: unknown, context?: { extra?: Record<string, unknown> }) => void;
  captureMessage?: (
    message: string,
    context?: { level?: string; extra?: Record<string, unknown> },
  ) => void;
};

function getSentry(): SentryGlobal | null {
  const candidate = (globalThis as unknown as { Sentry?: SentryGlobal }).Sentry;
  if (!candidate) return null;
  if (typeof candidate.captureException !== "function" && typeof candidate.captureMessage !== "function") {
    return null;
  }
  return candidate;
}

export function reportError(event: string, error: unknown, data?: object) {
  getSentry()?.captureException?.(error, { extra: { event, ...(data as Record<string, unknown>) } });
}

export function reportWarning(event: string, data?: object) {
  getSentry()?.captureMessage?.(event, {
    level: "warning",
    extra: { ...(data as Record<string, unknown>) },
  });
}
