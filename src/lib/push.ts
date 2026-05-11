import "server-only";

import webpush from "web-push";

import { db } from "@/lib/db";
import { logError, logInfo } from "@/lib/logger";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? "mailto:admin@hearthly.app";

  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(email, publicKey, privateKey);
  return true;
}

async function sendToSubscriptions(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload,
  event: string,
) {
  if (!subscriptions.length) return { sent: 0, failed: 0, total: 0 };
  if (!configureWebPush()) {
    logInfo("push.skipped", { event, reason: "vapid_missing", total: subscriptions.length });
    return { sent: 0, failed: 0, total: subscriptions.length };
  }

  let sent = 0;
  let failed = 0;
  const body = JSON.stringify({ url: "/app", ...payload });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => undefined);
        }
        failed++;
        logError("push.send", err, { event, endpoint: sub.endpoint });
      }
    }),
  );

  logInfo("push.sent", { event, sent, failed, total: subscriptions.length });
  return { sent, failed, total: subscriptions.length };
}

export async function sendPushToHousehold(householdId: string, payload: PushPayload, event: string) {
  const subscriptions = await db.pushSubscription.findMany({
    where: { member: { householdId } },
    select: { endpoint: true, p256dh: true, auth: true },
  });

  return sendToSubscriptions(subscriptions, payload, event);
}

export async function sendPushToAll(payload: PushPayload, event = "broadcast") {
  const subscriptions = await db.pushSubscription.findMany({
    select: { endpoint: true, p256dh: true, auth: true },
  });

  return sendToSubscriptions(subscriptions, payload, event);
}
