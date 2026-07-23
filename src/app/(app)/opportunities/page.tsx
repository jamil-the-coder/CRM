import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensurePipelineStages } from "@/lib/pipeline-stages";
import { Card, CardContent } from "@/components/ui/card";
import { KanbanBoard } from "./kanban-board";
import { NewOpportunityForm } from "./new-opportunity-form";
import { MineToggle } from "@/components/mine-toggle";
import { ExportCsvLink } from "@/components/export-csv-link";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const { mine } = await searchParams;
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;

  const [stages, opportunities, contacts, accounts] = await Promise.all([
    ensurePipelineStages(tenantId),
    db.opportunity.findMany({
      where: { tenantId, ...(mine === "1" ? { ownerUserId: user!.id } : {}) },
      orderBy: { createdAt: "desc" },
      include: { contact: true },
    }),
    db.contact.findMany({
      where: { tenantId },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.account.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Opportunities
          </h1>
          <p className="text-muted-foreground text-sm">
            Drag a card to move it through your pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MineToggle />
          <ExportCsvLink entity="opportunities" />
        </div>
      </div>

      <NewOpportunityForm
        stages={stages.map((s) => ({ key: s.key, label: s.label }))}
        contacts={contacts.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName ?? ""}`.trim(),
        }))}
        accounts={accounts}
      />

      {opportunities.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            No opportunities yet. Add one above, convert a lead, or create one
            via the API.
          </CardContent>
        </Card>
      ) : (
        <KanbanBoard
          stages={stages.map((s) => ({
            key: s.key,
            label: s.label,
            isWon: s.isWon,
            isLost: s.isLost,
          }))}
          opportunities={opportunities.map((o) => ({
            id: o.id,
            name: o.name,
            stage: o.stage,
            value: o.value.toString(),
            currency: o.currency,
            contactName:
              `${o.contact.firstName} ${o.contact.lastName ?? ""}`.trim(),
          }))}
        />
      )}
    </div>
  );
}
