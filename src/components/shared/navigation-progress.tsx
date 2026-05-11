"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "loading" | "completing";

/**
 * Thin progress bar at the top of the viewport that appears during route
 * transitions. Inspired by YouTube / GitHub. Pure CSS animation, no deps.
 *
 * How it works:
 * - On link click, we start a "loading" phase with a CSS animation that
 *   slowly fills from 0→92%.
 * - Once the new page mounts (pathname change fires), we snap to 100% and
 *   fade out via a deferred callback.
 * - A 120ms delay before showing prevents flicker on instant navigations.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const prevPathname = useRef(pathname);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scheduleComplete = useCallback(() => {
    setPhase("completing");
    completeTimer.current = setTimeout(() => setPhase("idle"), 300);
  }, []);

  // When pathname changes, transition to complete if we were loading
  useEffect(() => {
    if (pathname === prevPathname.current) return;
    prevPathname.current = pathname;

    // Clear any pending show timer (navigation was fast enough)
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = undefined;
    }

    // If we were loading, schedule completion via a microtask so React
    // doesn't flag it as a synchronous setState in an effect body.
    if (phase === "loading") {
      queueMicrotask(scheduleComplete);
    }

    return () => {
      if (completeTimer.current) {
        clearTimeout(completeTimer.current);
        completeTimer.current = undefined;
      }
    };
  }, [pathname, phase, scheduleComplete]);

  // Detect navigation start by capturing clicks on internal links
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const link = (e.target as HTMLElement).closest("a[href]");
      // Also capture button-based navigation (optimistic tabs)
      const button = (e.target as HTMLElement).closest("button[type='button']");
      if (!link && !button) return;

      if (button && button.getAttribute("data-client-nav") === "true") return;

      if (link) {
        const href = link.getAttribute("href");
        if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;

        // Same page — don't show
        const url = new URL(href, window.location.origin);
        if (url.pathname === pathname) return;
      }

      // For buttons, we can't easily determine the target route, but
      // our optimistic tabs use router.push which will trigger a pathname
      // change. Only show progress for button clicks within navigable areas.
      if (button && !link) {
        const isNavButton = button.closest("[role='tablist'], nav");
        if (!isNavButton) return;
      }

      // Delay showing the bar slightly to avoid flicker on fast navigations
      if (showTimer.current) clearTimeout(showTimer.current);
      showTimer.current = setTimeout(() => {
        setPhase("loading");
      }, 120);
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [pathname]);

  if (phase === "idle") return null;

  return (
    <div
      aria-hidden="true"
      className="nav-progress-bar"
      data-phase={phase}
    />
  );
}
