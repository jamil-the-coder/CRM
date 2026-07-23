import { db } from "@/lib/db";

export type CustomFieldEntityType = "contact" | "account" | "opportunity";
export const CUSTOM_FIELD_ENTITY_TYPES: CustomFieldEntityType[] = [
  "contact",
  "account",
  "opportunity",
];
export const CUSTOM_FIELD_TYPES = ["text", "number", "date", "select"] as const;

export async function getFieldDefinitions(
  tenantId: string,
  entityType: CustomFieldEntityType,
) {
  return db.customFieldDefinition.findMany({
    where: { tenantId, entityType },
    orderBy: { sortOrder: "asc" },
  });
}

/** Batched fetch for list views: entityId -> { key: value }. */
export async function getFieldValuesForEntities(
  tenantId: string,
  entityType: CustomFieldEntityType,
  entityIds: string[],
): Promise<Record<string, Record<string, string>>> {
  if (entityIds.length === 0) return {};
  const rows = await db.customFieldValue.findMany({
    where: { tenantId, entityId: { in: entityIds }, definition: { entityType } },
    include: { definition: true },
  });
  const result: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    if (row.value === null) continue;
    result[row.entityId] ??= {};
    result[row.entityId][row.definition.key] = row.value;
  }
  return result;
}

export async function getFieldValues(
  tenantId: string,
  entityType: CustomFieldEntityType,
  entityId: string,
): Promise<Record<string, string>> {
  const map = await getFieldValuesForEntities(tenantId, entityType, [entityId]);
  return map[entityId] ?? {};
}

/**
 * Upserts values for whichever keys have a matching field definition for
 * this tenant+entityType; unknown keys are silently ignored (lenient, so an
 * n8n flow posting a slightly stale field list doesn't 400 the whole request).
 */
export async function setFieldValues(
  tenantId: string,
  entityType: CustomFieldEntityType,
  entityId: string,
  values: Record<string, string | null>,
) {
  const definitions = await getFieldDefinitions(tenantId, entityType);
  const byKey = new Map(definitions.map((d) => [d.key, d]));

  for (const [key, value] of Object.entries(values)) {
    const definition = byKey.get(key);
    if (!definition) continue;
    await db.customFieldValue.upsert({
      where: { definitionId_entityId: { definitionId: definition.id, entityId } },
      create: { tenantId, definitionId: definition.id, entityId, value },
      update: { value },
    });
  }
}
