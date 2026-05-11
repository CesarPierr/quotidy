import "server-only";

import { reportError, reportWarning } from "@/lib/observability";

export function logInfo(event: string, data?: object): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", event, ...data }));
}

export function logWarn(event: string, data?: object): void {
  console.warn(JSON.stringify({ ts: new Date().toISOString(), level: "warn", event, ...data }));
  reportWarning(event, data);
}

export function logError(event: string, error: unknown, data?: object): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(
    JSON.stringify({ ts: new Date().toISOString(), level: "error", event, message, stack, ...data }),
  );
  reportError(event, error, data);
}
