import { db } from "@/lib/db";

type DedupeInput = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
};

// Trigram similarity() returns 0-1; these thresholds were chosen empirically
// (see dedupe.test.ts) to catch typo-level variations ("Jon Smith" vs "John
// Smith", "Acme Corp" vs "Acme Corporation") without flagging unrelated
// contacts that merely share a common word.
const FUZZY_NAME_THRESHOLD = 0.35;
const FUZZY_COMPANY_THRESHOLD = 0.45;

/** Exact-match dedupe key (email first, then phone digits-only) — cheap, indexed, checked first. */
export function computeDedupeKey(
  input: Pick<DedupeInput, "email" | "phone">,
): string | null {
  const email = input.email?.trim().toLowerCase();
  if (email) return `email:${email}`;

  const phoneDigits = input.phone?.replace(/\D/g, "");
  if (phoneDigits) return `phone:${phoneDigits}`;

  return null;
}

async function findExactDuplicates(
  tenantId: string,
  input: DedupeInput,
): Promise<{ id: string }[]> {
  const dedupeKey = computeDedupeKey(input);
  if (!dedupeKey) return [];
  return db.contact.findMany({
    where: { tenantId, dedupeKey },
    select: { id: true },
  });
}

/** Fuzzy fallback via Postgres trigram similarity (pg_trgm) on full name and company — catches near-matches that don't share an exact email/phone. */
async function findFuzzyDuplicates(
  tenantId: string,
  input: DedupeInput,
): Promise<{ id: string }[]> {
  const fullName = [input.firstName, input.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const company = input.company?.trim() || null;
  if (!fullName && !company) return [];

  return db.$queryRaw<{ id: string }[]>`
    SELECT id FROM contacts
    WHERE tenant_id = ${tenantId}
      AND (
        (${fullName} != '' AND similarity(first_name || ' ' || coalesce(last_name, ''), ${fullName}) > ${FUZZY_NAME_THRESHOLD})
        OR (${company}::text IS NOT NULL AND company IS NOT NULL AND similarity(company, ${company}) > ${FUZZY_COMPANY_THRESHOLD})
      )
    LIMIT 10
  `;
}

/** Combines exact and fuzzy matches, deduplicated by contact id. Informational only (see route handlers) — never blocks creation. */
export async function findDuplicateContacts(
  tenantId: string,
  input: DedupeInput,
): Promise<{ id: string }[]> {
  const [exact, fuzzy] = await Promise.all([
    findExactDuplicates(tenantId, input),
    findFuzzyDuplicates(tenantId, input),
  ]);

  const seen = new Set<string>();
  const merged: { id: string }[] = [];
  for (const row of [...exact, ...fuzzy]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row);
    }
  }
  return merged;
}
