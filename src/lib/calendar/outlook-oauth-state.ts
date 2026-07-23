import crypto from "node:crypto";

/**
 * The OAuth "state" param round-trips which tenant initiated the connect
 * flow through Microsoft's redirect — HMAC-signed (keyed with SESSION_SECRET,
 * same secret already used to key session-token hashes) so a forged state
 * can't be used to attach someone else's Outlook account to your tenant.
 */
export function signOutlookState(tenantId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const nonce = crypto.randomBytes(16).toString("base64url");
  const payload = `${tenantId}.${nonce}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOutlookState(state: string): { tenantId: string } | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");

  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [tenantId, nonce, signature] = parts;
  const payload = `${tenantId}.${nonce}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }
  return { tenantId };
}
