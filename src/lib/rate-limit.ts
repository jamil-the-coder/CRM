import { db } from "@/lib/db";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;

/** Per-IP-per-form submission cap over a rolling window. Broader, IP-agnostic rate limiting across all public endpoints is covered by the Phase 17 hardening pass. */
export async function isFormSubmissionRateLimited(
  formId: string,
  ipAddress: string | null,
): Promise<boolean> {
  if (!ipAddress) return false;

  const since = new Date(Date.now() - WINDOW_MS);
  const count = await db.formSubmission.count({
    where: { formId, ipAddress, createdAt: { gte: since } },
  });
  return count >= MAX_SUBMISSIONS_PER_WINDOW;
}

export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

/**
 * General-purpose IP-based rate limiter for public endpoints (login, signup,
 * the public form-config lookup, the webhook-processor trigger). Records a
 * hit and reports whether the caller is over the limit for this key.
 * Fails open (never blocks) if there's no IP to key on — same trade-off as
 * isFormSubmissionRateLimited above.
 */
export async function checkRateLimit(
  key: string,
  { windowMs, max }: { windowMs: number; max: number },
): Promise<{ limited: boolean }> {
  const since = new Date(Date.now() - windowMs);
  const count = await db.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  if (count >= max) {
    return { limited: true };
  }
  await db.rateLimitHit.create({ data: { key } });
  return { limited: false };
}
