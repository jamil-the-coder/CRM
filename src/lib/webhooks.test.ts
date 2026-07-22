import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createTestTenant } from "@/lib/test-support";
import {
  attemptDelivery,
  emitEvent,
  processDueDeliveries,
  signPayload,
} from "@/lib/webhooks";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

function startCapturingServer(status = 200) {
  const received: { body: string; headers: http.IncomingHttpHeaders }[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ body, headers: req.headers });
      res.writeHead(status);
      res.end();
    });
  });
  return new Promise<{
    url: string;
    received: typeof received;
    close: () => Promise<void>;
  }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        received,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

describe("emitEvent / attemptDelivery", () => {
  it("delivers a correctly signed payload to an active endpoint and marks it successful", async () => {
    const tenant = await createTestTenant("webhookSuccess");
    createdTenantIds.push(tenant.tenantId);
    const server = await startCapturingServer(200);

    const endpoint = await db.webhookEndpoint.create({
      data: {
        tenantId: tenant.tenantId,
        url: server.url,
        secret: "test-secret",
      },
    });

    await emitEvent(tenant.tenantId, "lead.created", {
      lead: { id: "lead_123" },
    });

    expect(server.received).toHaveLength(1);
    const [{ body, headers }] = server.received;
    const expectedSignature = signPayload("test-secret", body);
    expect(headers["x-crm-signature"]).toBe(`sha256=${expectedSignature}`);
    expect(headers["x-crm-event-id"]).toBeTruthy();

    const parsedBody = JSON.parse(body);
    expect(parsedBody.event_type).toBe("lead.created");
    expect(parsedBody.tenant_id).toBe(tenant.tenantId);
    expect(parsedBody.data.lead.id).toBe("lead_123");

    const delivery = await db.webhookDelivery.findFirst({
      where: { webhookEndpointId: endpoint.id },
    });
    expect(delivery?.status).toBe("success");
    expect(delivery?.attempts).toBe(1);

    await server.close();
  });

  it("does nothing (no delivery rows) when the tenant has no active endpoints", async () => {
    const tenant = await createTestTenant("webhookNoEndpoints");
    createdTenantIds.push(tenant.tenantId);

    await emitEvent(tenant.tenantId, "lead.created", { lead: { id: "x" } });

    const count = await db.webhookDelivery.count({
      where: { tenantId: tenant.tenantId },
    });
    expect(count).toBe(0);
  });

  it("schedules a backoff retry (without throwing) when the endpoint is unreachable", async () => {
    const tenant = await createTestTenant("webhookRetry");
    createdTenantIds.push(tenant.tenantId);

    // Nothing is listening on this port — a real, deterministic connection failure.
    const endpoint = await db.webhookEndpoint.create({
      data: {
        tenantId: tenant.tenantId,
        url: "http://127.0.0.1:65001",
        secret: "s",
      },
    });

    await emitEvent(tenant.tenantId, "lead.created", { lead: { id: "x" } });

    const delivery = await db.webhookDelivery.findFirst({
      where: { webhookEndpointId: endpoint.id },
    });
    expect(delivery?.status).toBe("pending");
    expect(delivery?.attempts).toBe(1);
    expect(delivery?.lastError).toBeTruthy();
    expect(delivery!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("marks a delivery failed after exhausting all retry attempts", async () => {
    const tenant = await createTestTenant("webhookExhausted");
    createdTenantIds.push(tenant.tenantId);
    const endpoint = await db.webhookEndpoint.create({
      data: {
        tenantId: tenant.tenantId,
        url: "http://127.0.0.1:65002",
        secret: "s",
      },
    });
    const delivery = await db.webhookDelivery.create({
      data: {
        tenantId: tenant.tenantId,
        webhookEndpointId: endpoint.id,
        eventId: crypto.randomUUID(),
        eventType: "lead.created",
        payload: { event_type: "lead.created" },
        nextAttemptAt: new Date(),
      },
    });

    for (let i = 0; i < 5; i++) {
      await attemptDelivery(delivery.id);
      // Force the next attempt to be due immediately instead of waiting for real backoff.
      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: { nextAttemptAt: new Date() },
      });
    }

    const final = await db.webhookDelivery.findUnique({
      where: { id: delivery.id },
    });
    expect(final?.status).toBe("failed");
    expect(final?.attempts).toBe(5);
  });

  it("processDueDeliveries retries a pending delivery once its backoff window has passed", async () => {
    const tenant = await createTestTenant("webhookProcessDue");
    createdTenantIds.push(tenant.tenantId);
    const server = await startCapturingServer(200);
    const endpoint = await db.webhookEndpoint.create({
      data: { tenantId: tenant.tenantId, url: server.url, secret: "s" },
    });
    const delivery = await db.webhookDelivery.create({
      data: {
        tenantId: tenant.tenantId,
        webhookEndpointId: endpoint.id,
        eventId: crypto.randomUUID(),
        eventType: "lead.created",
        payload: { event_type: "lead.created" },
        status: "pending",
        nextAttemptAt: new Date(Date.now() - 1000), // already due
      },
    });

    const result = await processDueDeliveries();
    expect(result.processed).toBeGreaterThanOrEqual(1);

    const updated = await db.webhookDelivery.findUnique({
      where: { id: delivery.id },
    });
    expect(updated?.status).toBe("success");
    expect(server.received).toHaveLength(1);

    await server.close();
  });
});
