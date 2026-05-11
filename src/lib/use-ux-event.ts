"use client";

import { useEffect, useRef } from "react";

/**
 * Fire a UX telemetry event once after mount. Best-effort: uses sendBeacon
 * when available, falls back to fetch keepalive. Errors are swallowed.
 */
export function useUxEvent(event: string, props?: Record<string, unknown>) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const payload = JSON.stringify({
      event,
      props: {
        ...(props ?? {}),
        path: typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined,
      },
    });
    try {
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/metrics", blob);
        return;
      }
    } catch {
      // fall through
    }
    fetch("/api/metrics", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
