import { db } from "@/lib/db";

export const DEFAULT_PIPELINE_STAGES = [
  { key: "new", label: "New", sortOrder: 0, isWon: false, isLost: false },
  {
    key: "contacted",
    label: "Contacted",
    sortOrder: 1,
    isWon: false,
    isLost: false,
  },
  {
    key: "qualified",
    label: "Qualified",
    sortOrder: 2,
    isWon: false,
    isLost: false,
  },
  {
    key: "proposal",
    label: "Proposal",
    sortOrder: 3,
    isWon: false,
    isLost: false,
  },
  {
    key: "closed_won",
    label: "Closed Won",
    sortOrder: 4,
    isWon: true,
    isLost: false,
  },
  {
    key: "closed_lost",
    label: "Closed Lost",
    sortOrder: 5,
    isWon: false,
    isLost: true,
  },
];

export function seedDefaultPipelineStages(tenantId: string) {
  return db.pipelineStage.createMany({
    data: DEFAULT_PIPELINE_STAGES.map((stage) => ({ tenantId, ...stage })),
  });
}

/** Lazily backfills default stages for any tenant that predates this feature. */
export async function ensurePipelineStages(tenantId: string) {
  const count = await db.pipelineStage.count({ where: { tenantId } });
  if (count === 0) {
    await seedDefaultPipelineStages(tenantId);
  }
  return db.pipelineStage.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });
}
