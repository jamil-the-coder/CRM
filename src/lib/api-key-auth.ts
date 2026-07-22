import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

const KEY_PREFIX = "crm_live_";

export function generateApiKey(): {
  fullKey: string;
  keyHash: string;
  keyPrefix: string;
} {
  const fullKey = `${KEY_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
  return {
    fullKey,
    keyHash: hashApiKey(fullKey),
    keyPrefix: fullKey.slice(0, KEY_PREFIX.length + 8),
  };
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

type ApiKeyAuthResult =
  | { tenantId: string; unauthorized?: undefined }
  | { tenantId?: undefined; unauthorized: NextResponse };

/** Authenticates n8n-facing (or any other third-party) requests via a per-tenant API key, instead of the browser session cookie used elsewhere. */
export async function requireApiKey(
  request: NextRequest,
): Promise<ApiKeyAuthResult> {
  const header = request.headers.get("authorization");
  const token = header?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return {
      unauthorized: NextResponse.json(
        { error: "Missing API key" },
        { status: 401 },
      ),
    };
  }

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash: hashApiKey(token) },
  });
  if (!apiKey) {
    return {
      unauthorized: NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 },
      ),
    };
  }

  db.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { tenantId: apiKey.tenantId };
}
