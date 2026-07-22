import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { isSafeWebhookUrl } from "@/lib/url-safety";
import { recordAuditLog } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";

const createWebhookEndpointSchema = z.object({
  url: z.string().trim().url().max(2000),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const endpoints = await db.webhookEndpoint.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { deliveries: true } },
      deliveries: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  return NextResponse.json({ endpoints });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const body = await request.json().catch(() => null);
  const parsed = createWebhookEndpointSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (!isSafeWebhookUrl(parsed.data.url)) {
    return NextResponse.json(
      {
        error:
          "That URL isn't allowed (must be a public http/https address, not a private/local network address)",
      },
      { status: 400 },
    );
  }

  const endpoint = await db.webhookEndpoint.create({
    data: {
      tenantId: auth.user.tenantId,
      url: parsed.data.url,
      secret: crypto.randomBytes(24).toString("base64url"),
    },
  });

  await recordAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "webhook_endpoint.created",
    metadata: { webhookEndpointId: endpoint.id, url: endpoint.url },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ endpoint }, { status: 201 });
}
