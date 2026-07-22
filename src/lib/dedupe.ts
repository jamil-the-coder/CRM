import { db } from "@/lib/db";

type DedupeInput = { email?: string | null; phone?: string | null };

/** Exact-match dedupe key (email first, then phone digits-only). Real fuzzy/trigram matching lands in Phase 14 — this is the stub interface described in PLAN.md. */
export function computeDedupeKey(input: DedupeInput): string | null {
  const email = input.email?.trim().toLowerCase();
  if (email) return `email:${email}`;

  const phoneDigits = input.phone?.replace(/\D/g, "");
  if (phoneDigits) return `phone:${phoneDigits}`;

  return null;
}

export async function findDuplicateContacts(
  tenantId: string,
  input: DedupeInput,
) {
  const dedupeKey = computeDedupeKey(input);
  if (!dedupeKey) return [];
  return db.contact.findMany({ where: { tenantId, dedupeKey } });
}
