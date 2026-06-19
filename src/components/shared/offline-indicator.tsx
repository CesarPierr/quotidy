"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";

import { flushOutbox, pendingCount } from "@/lib/offline-outbox";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

/**
 * A thin status banner: shown when offline, or while queued offline changes are
 * being synced back. Also drives the outbox flush on reconnect. Rendered once,
 * at the top of the app shell.
 */
export function OfflineIndicator() {
  const online = useOnline();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const n = await pendingCount();
      if (active) setPending(n);
    };
    const sync = async () => {
      await flushOutbox();
      await refresh();
    };
    refresh();
    const interval = window.setInterval(refresh, 4000);
    window.addEventListener("online", sync);
    if (typeof navigator !== "undefined" && navigator.onLine) sync();
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", sync);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div
      className={cn(
        "mb-3 flex items-center gap-2.5 rounded-2xl border px-3 py-2 text-sm font-medium",
        online ? "border-leaf-600/20 bg-leaf-600/[0.06] text-leaf-700" : "border-coral-500/20 bg-coral-500/[0.06] text-coral-700",
      )}
      role="status"
      aria-live="polite"
    >
      {online ? <RefreshCw className="size-4 shrink-0 animate-spin" /> : <CloudOff className="size-4 shrink-0" />}
      <span className="min-w-0">
        {online
          ? `Synchronisation de ${pending} modification${pending > 1 ? "s" : ""}…`
          : pending > 0
            ? `Hors-ligne · ${pending} en attente de synchronisation`
            : "Hors-ligne — vos saisies seront synchronisées au retour du réseau"}
      </span>
    </div>
  );
}
