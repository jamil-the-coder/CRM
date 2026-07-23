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
import { tagColorClassName } from "@/lib/tag-colors";

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

  const [timeline, tagsByEntity, attachments] = await Promise.all([
    getTimeline(tenantId, "lead", id),
    getTagsForEntities(tenantId, "lead", [id]),
    db.attachment.findMany({
      where: { tenantId, entityType: "lead", entityId: id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const tags = tagsByEntity[id] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {lead.contact.firstName} {lead.contact.lastName ?? ""}
        </h1>
        <p className="text-sm text-zinc-500">Source: {lead.source}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              <p className="text-xs text-zinc-500">Status</p>
              <Badge variant="secondary">{lead.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Score</p>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {lead.score}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Contact</p>
              <Link
                href={`/contacts/${lead.contact.id}`}
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
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
