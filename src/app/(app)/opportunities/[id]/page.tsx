import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTimeline } from "@/lib/timeline";
import { getFieldValues } from "@/lib/custom-fields";
import { getTagsForEntities } from "@/lib/tags";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RecordTimeline } from "@/components/record-timeline";
import { AddNoteForm } from "@/components/add-note-form";
import { AttachmentsSection } from "@/components/attachments-section";
import { RecordTasksSection } from "@/components/record-tasks-section";
import { tagColorClassName } from "@/lib/tag-colors";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;

  const opportunity = await db.opportunity.findFirst({
    where: { id, tenantId },
    include: { contact: true, account: true },
  });
  if (!opportunity) notFound();

  const [timeline, customFields, tagsByEntity, attachments, tasks] = await Promise.all([
    getTimeline(tenantId, "opportunity", id),
    getFieldValues(tenantId, "opportunity", id),
    getTagsForEntities(tenantId, "opportunity", [id]),
    db.attachment.findMany({
      where: { tenantId, entityType: "opportunity", entityId: id },
      orderBy: { createdAt: "desc" },
    }),
    db.task.findMany({
      where: { tenantId, entityType: "opportunity", entityId: id },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
  ]);
  const tags = tagsByEntity[id] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {opportunity.name}
        </h1>
        <p className="text-sm text-zinc-500">
          {currencyFormatter.format(Number(opportunity.value))}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              <p className="text-xs text-zinc-500">Stage</p>
              <Badge variant="secondary">{opportunity.stage}</Badge>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Contact</p>
              <Link
                href={`/contacts/${opportunity.contact.id}`}
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
              >
                {opportunity.contact.firstName} {opportunity.contact.lastName ?? ""}
              </Link>
            </div>
            {opportunity.account && (
              <div>
                <p className="text-xs text-zinc-500">Account</p>
                <Link
                  href={`/accounts/${opportunity.account.id}`}
                  className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                >
                  {opportunity.account.name}
                </Link>
              </div>
            )}
            {Object.entries(customFields).map(([key, value]) => (
              <div key={key}>
                <p className="text-xs text-zinc-500">{key}</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {value}
                </p>
              </div>
            ))}
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
        entityType="opportunity"
        entityId={id}
        tasks={tasks.map((t) => ({ ...t, dueDate: t.dueDate?.toISOString() ?? null }))}
      />
      <AttachmentsSection
        entityType="opportunity"
        entityId={id}
        attachments={attachments}
      />
      <AddNoteForm entityType="opportunity" entityId={id} />
      <RecordTimeline entries={timeline} />
    </div>
  );
}
