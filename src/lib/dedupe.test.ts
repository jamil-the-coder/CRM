import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { findDuplicateContacts } from "./dedupe";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

async function makeTenant(name: string) {
  const tenant = await db.tenant.create({ data: { name } });
  createdTenantIds.push(tenant.id);
  return tenant.id;
}

describe("findDuplicateContacts", () => {
  it("finds an exact match by email even with a completely different name", async () => {
    const tenantId = await makeTenant("dedupeExact");
    await db.contact.create({
      data: {
        tenantId,
        firstName: "Original",
        email: "same@example.com",
        dedupeKey: "email:same@example.com",
      },
    });

    const matches = await findDuplicateContacts(tenantId, {
      firstName: "Totally Different",
      email: "same@example.com",
    });
    expect(matches.length).toBe(1);
  });

  it("finds a fuzzy match on a typo'd name", async () => {
    const tenantId = await makeTenant("dedupeFuzzyName");
    const existing = await db.contact.create({
      data: { tenantId, firstName: "John", lastName: "Smith" },
    });

    // No shared email/phone — only a near-identical name (one-letter typo).
    const matches = await findDuplicateContacts(tenantId, {
      firstName: "Jon",
      lastName: "Smith",
    });
    expect(matches.some((m) => m.id === existing.id)).toBe(true);
  });

  it("finds a fuzzy match on a near-identical company name", async () => {
    const tenantId = await makeTenant("dedupeFuzzyCompany");
    const existing = await db.contact.create({
      data: { tenantId, firstName: "Someone", company: "Acme Corporation" },
    });

    const matches = await findDuplicateContacts(tenantId, {
      firstName: "Someone Else",
      company: "Acme Corp",
    });
    expect(matches.some((m) => m.id === existing.id)).toBe(true);
  });

  it("does NOT flag unrelated contacts as duplicates (no false positives)", async () => {
    const tenantId = await makeTenant("dedupeNoFalsePositive");
    await db.contact.create({
      data: {
        tenantId,
        firstName: "Alice",
        lastName: "Johnson",
        company: "Widgets Inc",
      },
    });

    const matches = await findDuplicateContacts(tenantId, {
      firstName: "Bob",
      lastName: "Williams",
      company: "Gadgets LLC",
    });
    expect(matches).toHaveLength(0);
  });

  it("scopes fuzzy matching to the caller's tenant only", async () => {
    const tenantA = await makeTenant("dedupeIsoA");
    const tenantB = await makeTenant("dedupeIsoB");
    await db.contact.create({
      data: { tenantId: tenantA, firstName: "John", lastName: "Smith" },
    });

    const matches = await findDuplicateContacts(tenantB, {
      firstName: "John",
      lastName: "Smith",
    });
    expect(matches).toHaveLength(0);
  });

  it("returns nothing when given no identifying information", async () => {
    const tenantId = await makeTenant("dedupeEmpty");
    const matches = await findDuplicateContacts(tenantId, {});
    expect(matches).toHaveLength(0);
  });
});
