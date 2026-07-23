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
import { LogEmailForm } from "@/components/log-email-form";
import { AttachmentsSection } from "@/components/attachments-section";
import { RecordTasksSection } from "@/components/record-tasks-section";
import { tagColorClassName } from "@/lib/tag-colors";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;

  const contact = await db.contact.findFirst({
    where: { id, tenantId },
    include: { account: true },
  });
  if (!contact) notFound();

  const [timeline, customFields, tagsByEntity, attachments, tasks] = await Promise.all([
    getTimeline(tenantId, "contact", id),
    getFieldValues(tenantId, "contact", id),
    getTagsForEntities(tenantId, "contact", [id]),
    db.attachment.findMany({
      where: { tenantId, entityType: "contact", entityId: id },
      orderBy: { createdAt: "desc" },
    }),
    db.task.findMany({
      where: { tenantId, entityType: "contact", entityId: id },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
  ]);
  const tags = tagsByEntity[id] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {contact.firstName} {contact.lastName ?? ""}
        </h1>
        <p className="text-sm text-zinc-500">
          {[contact.email, contact.phone].filter(Boolean).join(" · ") ||
            "No contact details yet"}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap gap-4 text-sm">
            {contact.account && (
              <div>
                <p className="text-xs text-zinc-500">Account</p>
                <Link
                  href={`/accounts/${contact.account.id}`}
                  className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                >
                  {contact.account.name}
                </Link>
              </div>
            )}
            {contact.company && !contact.account && (
              <div>
                <p className="text-xs text-zinc-500">Company</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {contact.company}
                </p>
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
        entityType="contact"
        entityId={id}
        tasks={tasks.map((t) => ({ ...t, dueDate: t.dueDate?.toISOString() ?? null }))}
      />
      <AttachmentsSection
        entityType="contact"
        entityId={id}
        attachments={attachments}
      />
      <AddNoteForm entityType="contact" entityId={id} />
      <LogEmailForm contactId={id} />
      <RecordTimeline entries={timeline} />
    </div>
  );
}
