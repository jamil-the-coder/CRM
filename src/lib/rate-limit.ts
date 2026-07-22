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
