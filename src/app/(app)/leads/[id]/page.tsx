import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTimeline } from "@/lib/timeline";
import { getTagsForEntities } from "@/lib/tags";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RecordTimeline } from "@/components/record-timeline";
import { AddNoteForm } from "@/components/add-note-form";
import { AttachmentsSection } from "@/components/attachments-section";
import { RecordTasksSection } from "@/components/record-tasks-section";
import { leadStatusBadgeVariant } from "@/lib/status-badge";
import { tagColorClassName } from "@/lib/tag-colors";
import { ConvertButton } from "./convert-button";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;

  const lead = await db.lead.findFirst({
    where: { id, tenantId },
    include: { contact: true },
  });
  if (!lead) notFound();

  const [timeline, tagsByEntity, attachments, tasks, convertedOpportunity] =
    await Promise.all([
      getTimeline(tenantId, "lead", id),
      getTagsForEntities(tenantId, "lead", [id]),
      db.attachment.findMany({
        where: { tenantId, entityType: "lead", entityId: id },
        orderBy: { createdAt: "desc" },
      }),
      db.task.findMany({
        where: { tenantId, entityType: "lead", entityId: id },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      }),
      db.opportunity.findFirst({ where: { tenantId, leadId: id } }),
    ]);
  const tags = tagsByEntity[id] ?? [];
  const contactName = `${lead.contact.firstName} ${lead.contact.lastName ?? ""}`.trim();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {lead.contact.firstName} {lead.contact.lastName ?? ""}
          </h1>
          <p className="text-sm text-muted-foreground">Source: {lead.source}</p>
        </div>
        {convertedOpportunity ? (
          <Link
            href={`/opportunities/${convertedOpportunity.id}`}
            className="text-primary text-sm font-medium hover:underline"
          >
            View opportunity →
          </Link>
        ) : (
          <ConvertButton
            leadId={id}
            contactId={lead.contactId}
            defaultName={`${contactName} — Opportunity`}
          />
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={leadStatusBadgeVariant(lead.status)}>
                {lead.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="font-medium text-foreground">
                {lead.score}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contact</p>
              <Link
                href={`/contacts/${lead.contact.id}`}
                className="font-medium text-foreground hover:text-primary transition-colors"
              >
                {lead.contact.firstName} {lead.contact.lastName ?? ""}
              </Link>
            </div>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag.id} className={tagColorClassName(tag.color)}>
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RecordTasksSection
        entityType="lead"
        entityId={id}
        tasks={tasks.map((t) => ({ ...t, dueDate: t.dueDate?.toISOString() ?? null }))}
      />
      <AttachmentsSection
        entityType="lead"
        entityId={id}
        attachments={attachments}
      />
      <AddNoteForm entityType="lead" entityId={id} />
      <RecordTimeline entries={timeline} />
    </div>
  );
}
