import { db } from "@/lib/db";
import { ensurePipelineStages } from "@/lib/pipeline-stages";

export async function getPipelineValueByStage(tenantId: string) {
  const stages = await ensurePipelineStages(tenantId);
  const opportunities = await db.opportunity.findMany({
    where: { tenantId },
    select: { stage: true, value: true },
  });

  return stages.map((stage) => {
    const inStage = opportunities.filter((o) => o.stage === stage.key);
    const value = inStage.reduce((sum, o) => sum + Number(o.value), 0);
    return { key: stage.key, label: stage.label, value, count: inStage.length };
  });
}

export async function getConversionFunnel(tenantId: string) {
  const stages = await ensurePipelineStages(tenantId);
  const nonLostStages = stages
    .filter((s) => !s.isLost)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const activities = await db.activity.findMany({
    where: {
      tenantId,
      entityType: "opportunity",
      type: { in: ["opportunity.created", "opportunity.stage_changed"] },
    },
    select: { entityId: true, type: true, payload: true },
  });

  // "Reached stage X" = ever created at X, or ever transitioned to X.
  const reachedByStage = new Map<string, Set<string>>();
  for (const stage of nonLostStages) reachedByStage.set(stage.key, new Set());

  for (const activity of activities) {
    const payload = activity.payload as { stage?: string; to?: string } | null;
    const stageKey =
      activity.type === "opportunity.created" ? payload?.stage : payload?.to;
    if (stageKey && reachedByStage.has(stageKey)) {
      reachedByStage.get(stageKey)!.add(activity.entityId);
    }
  }

  const baseline = reachedByStage.get(nonLostStages[0]?.key ?? "")?.size ?? 0;

  return nonLostStages.map((stage) => {
    const reached = reachedByStage.get(stage.key)?.size ?? 0;
    return {
      key: stage.key,
      label: stage.label,
      reached,
      conversionRate:
        baseline === 0 ? 0 : Math.round((reached / baseline) * 1000) / 10,
    };
  });
}

export async function getLeadSourceBreakdown(tenantId: string) {
  const leads = await db.lead.groupBy({
    by: ["source"],
    where: { tenantId },
    _count: { _all: true },
  });

  return leads
    .map((row) => ({ source: row.source, count: row._count._all }))
    .sort((a, b) => b.count - a.count);
}

export async function getTimeSeries(tenantId: string, days = 14) {
  // UTC-based day boundaries throughout (not local time) so "today" in the
  // loop always matches "today" as computed by toISOString() elsewhere.
  const todayUtc = new Date();
  const sinceUtcMs = Date.UTC(
    todayUtc.getUTCFullYear(),
    todayUtc.getUTCMonth(),
    todayUtc.getUTCDate() - (days - 1),
  );
  const since = new Date(sinceUtcMs);

  const [leads, closedWonOpportunities] = await Promise.all([
    db.lead.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    db.opportunity.findMany({
      where: { tenantId, stage: "closed_won", closedAt: { gte: since } },
      select: { closedAt: true },
    }),
  ]);

  const days_: { date: string; leadsCreated: number; dealsClosed: number }[] =
    [];
  for (let i = 0; i < days; i++) {
    const day = new Date(sinceUtcMs + i * 24 * 60 * 60 * 1000);
    const dateKey = day.toISOString().slice(0, 10);
    const leadsCreated = leads.filter(
      (l) => l.createdAt.toISOString().slice(0, 10) === dateKey,
    ).length;
    const dealsClosed = closedWonOpportunities.filter(
      (o) => o.closedAt && o.closedAt.toISOString().slice(0, 10) === dateKey,
    ).length;
    days_.push({ date: dateKey, leadsCreated, dealsClosed });
  }
  return days_;
}
