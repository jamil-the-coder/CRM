import { db } from "@/lib/db";

export type TaggableEntityType = "contact" | "account" | "lead" | "opportunity";
export const TAGGABLE_ENTITY_TYPES: TaggableEntityType[] = [
  "contact",
  "account",
  "lead",
  "opportunity",
];

// A small fixed palette, not free-typed hex — keeps every tag chip visually
// consistent instead of a rainbow of one-off colors (dataviz skill's
// categorical-color rule applied to a non-chart UI element).
export const TAG_COLORS = [
  "zinc",
  "red",
  "amber",
  "emerald",
  "sky",
  "violet",
] as const;

/** Batched fetch for list views: entityId -> Tag[]. */
export async function getTagsForEntities(
  tenantId: string,
  entityType: TaggableEntityType,
  entityIds: string[],
): Promise<Record<string, { id: string; name: string; color: string }[]>> {
  if (entityIds.length === 0) return {};
  const assignments = await db.tagAssignment.findMany({
    where: { tenantId, entityType, entityId: { in: entityIds } },
    include: { tag: true },
  });
  const result: Record<string, { id: string; name: string; color: string }[]> = {};
  for (const assignment of assignments) {
    result[assignment.entityId] ??= [];
    result[assignment.entityId].push({
      id: assignment.tag.id,
      name: assignment.tag.name,
      color: assignment.tag.color,
    });
  }
  return result;
}

/** Entity ids (for a given entityType) that carry the given tag — used for list-view filtering. */
export async function getEntityIdsForTag(
  tenantId: string,
  entityType: TaggableEntityType,
  tagId: string,
): Promise<string[]> {
  const assignments = await db.tagAssignment.findMany({
    where: { tenantId, entityType, tagId },
    select: { entityId: true },
  });
  return assignments.map((a) => a.entityId);
}
