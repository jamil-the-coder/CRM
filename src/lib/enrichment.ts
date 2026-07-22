import { db } from "@/lib/db";

export type EnrichmentInput = {
  email?: string | null;
  company?: string | null;
};

// Only fields that actually exist on Contact today — extend both this type
// and the Contact model together if a real provider ever returns more.
export type EnrichmentResult = {
  company?: string;
};

/**
 * Interface for looking up additional data about a contact from a
 * third-party enrichment service. No real provider is wired up in v1 — per
 * PLAN.md, actual enrichment providers can be added later without callers
 * changing, the same pattern as CalendarProvider.
 */
export interface ContactEnrichmentProvider {
  readonly name: string;
  enrich(input: EnrichmentInput): Promise<EnrichmentResult | null>;
}

export class NoopEnrichmentProvider implements ContactEnrichmentProvider {
  readonly name = "noop";

  async enrich(_input: EnrichmentInput): Promise<EnrichmentResult | null> {
    return null;
  }
}

let cachedProvider: ContactEnrichmentProvider | undefined;

export function getEnrichmentProvider(): ContactEnrichmentProvider {
  if (!cachedProvider) {
    const providerName = process.env.ENRICHMENT_PROVIDER ?? "noop";
    if (providerName !== "noop") {
      throw new Error(
        `Unknown ENRICHMENT_PROVIDER "${providerName}" — no real enrichment provider is implemented yet.`,
      );
    }
    cachedProvider = new NoopEnrichmentProvider();
  }
  return cachedProvider;
}

/** Best-effort: looks up enrichment data and merges any returned fields onto the contact. Never throws — an enrichment provider being down must not break contact creation. */
export async function enrichContact(contactId: string, input: EnrichmentInput) {
  try {
    const provider = getEnrichmentProvider();
    const result = await provider.enrich(input);
    if (!result) return;

    await db.contact.update({ where: { id: contactId }, data: result });
  } catch {
    // Enrichment is a nice-to-have; failures here must never surface to the caller.
  }
}
