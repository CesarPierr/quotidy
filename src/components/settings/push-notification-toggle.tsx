"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

import { useToast } from "@/components/ui/toast";

type Props = { memberId: string };

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

export function PushNotificationToggle({ memberId }: Props) {
  const { success, error: showError } = useToast();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window === "undefined") return "default";
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
    return Notification.permission;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (permission === "unsupported") return;
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub)),
    );
  }, [permission]);

  async function subscribe() {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const permResult = await Notification.requestPermission();
      setPermission(permResult);
      if (permResult !== "granted") {
        showError("Notifications refusées par le navigateur.");
        return;
      }

      const keyRes = await fetch("/api/push/vapid-public-key");
      if (!keyRes.ok) { showError("Notifications non configurées."); return; }
      const { key } = await keyRes.json() as { key: string };

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const csrfToken = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/)?.[1] ?? "";
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!))), auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")!))) }, memberId }),
      });

      setSubscribed(true);
      success("Notifications activées !");
    } catch (err) {
      showError("Impossible d'activer les notifications.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      setSubscribed(false);
      success("Notifications désactivées.");
    } catch {
      showError("Erreur lors de la désactivation.");
    } finally {
      setIsLoading(false);
    }
  }

  if (permission === "unsupported") {
    return (
      <p className="text-sm text-ink-500">
        Votre navigateur ne supporte pas les notifications push.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white/70 dark:bg-surface/70 px-4 py-3">
      <div className="flex items-center gap-3">
        {subscribed ? (
          <Bell className="size-5 text-leaf-600" />
        ) : (
          <BellOff className="size-5 text-ink-500" />
        )}
        <div>
          <p className="text-sm font-semibold">Notifications push</p>
          <p className="text-xs text-ink-500">
            {subscribed ? "Activées sur cet appareil" : "Désactivées"}
          </p>
        </div>
      </div>
      <button
        className={subscribed ? "btn-secondary px-3 py-1.5 text-xs" : "btn-primary px-3 py-1.5 text-xs"}
        disabled={isLoading || permission === "denied"}
        onClick={subscribed ? unsubscribe : subscribe}
        type="button"
      >
        {isLoading ? "…" : subscribed ? "Désactiver" : "Activer"}
      </button>
    </div>
  );
}
