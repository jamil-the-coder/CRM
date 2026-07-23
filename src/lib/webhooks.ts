import crypto from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const API_VERSION = "2026-07-22";
const DELIVERY_TIMEOUT_MS = 8_000;

// 1m, 5m, 30m, 2h, 24h — matches the schedule documented in PLAN.md/EVENTS.md.
const BACKOFF_SCHEDULE_MS = [
  1 * 60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  24 * 60 * 60_000,
];
export const MAX_DELIVERY_ATTEMPTS = BACKOFF_SCHEDULE_MS.length;

export type WebhookEventType =
  | "lead.created"
  | "lead.updated"
  | "lead.status_changed"
  | "opportunity.created"
  | "opportunity.stage_changed"
  | "opportunity.closed_won"
  | "opportunity.closed_lost"
  | "call.booked"
  | "form.submitted"
  | "account.created"
  | "account.updated";

export function signPayload(secret: string, rawBody: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

/**
 * Records the event as a delivery for every active webhook endpoint on the
 * tenant, then makes a best-effort immediate delivery attempt for each. Any
 * that fail are left `pending` with a backoff-scheduled `nextAttemptAt` for
 * processDueDeliveries() to retry later — emitEvent itself never throws for
 * a delivery failure, since a webhook subscriber being down must never break
 * the request that triggered the event.
 */
export async function emitEvent(
  tenantId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
) {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { tenantId, isActive: true },
  });
  if (endpoints.length === 0) return;

  const eventId = crypto.randomUUID();
  const envelope = {
    event_id: eventId,
    event_type: eventType,
    api_version: API_VERSION,
    occurred_at: new Date().toISOString(),
    tenant_id: tenantId,
    data,
  };

  for (const endpoint of endpoints) {
    const delivery = await db.webhookDelivery.create({
      data: {
        tenantId,
        webhookEndpointId: endpoint.id,
        eventId,
        eventType,
        payload: envelope as unknown as Prisma.InputJsonValue,
        nextAttemptAt: new Date(),
      },
    });
    await attemptDelivery(delivery.id).catch(() => {
      // attemptDelivery already records the failure on the row; nothing further to do here.
    });
  }
}

/** Performs one delivery attempt for a WebhookDelivery row and updates its status/backoff. */
export async function attemptDelivery(deliveryId: string): Promise<void> {
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (!delivery || delivery.status !== "pending") return;

  const rawBody = JSON.stringify(delivery.payload);
  const signature = signPayload(delivery.endpoint.secret, rawBody);
  const attemptNumber = delivery.attempts + 1;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(delivery.endpoint.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-CRM-Signature": `sha256=${signature}`,
          "X-CRM-Event-Id": delivery.eventId,
        },
        body: rawBody,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "success",
          attempts: attemptNumber,
          lastAttemptAt: new Date(),
          lastResponseStatus: response.status,
          lastError: null,
        },
      });
      return;
    }

    await recordFailedAttempt(
      delivery.id,
      attemptNumber,
      `HTTP ${response.status}`,
      response.status,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown delivery error";
    await recordFailedAttempt(delivery.id, attemptNumber, message, null);
  }
}

async function recordFailedAttempt(
  deliveryId: string,
  attemptNumber: number,
  errorMessage: string,
  responseStatus: number | null,
) {
  const isFinalAttempt = attemptNumber >= MAX_DELIVERY_ATTEMPTS;
  const backoffMs =
    BACKOFF_SCHEDULE_MS[
      Math.min(attemptNumber - 1, BACKOFF_SCHEDULE_MS.length - 1)
    ];

  await db.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: isFinalAttempt ? "failed" : "pending",
      attempts: attemptNumber,
      lastAttemptAt: new Date(),
      lastError: errorMessage,
      lastResponseStatus: responseStatus,
      nextAttemptAt: new Date(Date.now() + backoffMs),
    },
  });
}

/** Finds every delivery whose backoff window has elapsed and retries it. Intended to be invoked periodically (see /api/webhooks/process-due). */
export async function processDueDeliveries(): Promise<{ processed: number }> {
  const due = await db.webhookDelivery.findMany({
    where: { status: "pending", nextAttemptAt: { lte: new Date() } },
    select: { id: true },
    take: 100,
  });

  for (const { id } of due) {
    await attemptDelivery(id).catch(() => {});
  }

  return { processed: due.length };
}
