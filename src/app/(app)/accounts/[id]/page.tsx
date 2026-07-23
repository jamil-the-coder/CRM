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
import { tagColorClassName } from "@/lib/tag-colors";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;

  const account = await db.account.findFirst({
    where: { id, tenantId },
    include: {
      contacts: { orderBy: { createdAt: "desc" } },
      opportunities: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!account) notFound();

  const [timeline, customFields, tagsByEntity, attachments] = await Promise.all([
    getTimeline(tenantId, "account", id),
    getFieldValues(tenantId, "account", id),
    getTagsForEntities(tenantId, "account", [id]),
    db.attachment.findMany({
      where: { tenantId, entityType: "account", entityId: id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const tags = tagsByEntity[id] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {account.name}
        </h1>
        <p className="text-sm text-zinc-500">
          {account.contacts.length} contact
          {account.contacts.length === 1 ? "" : "s"} ·{" "}
          {account.opportunities.length} opportunit
          {account.opportunities.length === 1 ? "y" : "ies"}
        </p>
      </div>

      {(Object.keys(customFields).length > 0 || tags.length > 0) && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            {Object.keys(customFields).length > 0 && (
              <div className="flex flex-wrap gap-4 text-sm">
                {Object.entries(customFields).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-zinc-500">{key}</p>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            )}
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
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Contacts
        </h2>
        {account.contacts.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-zinc-500">
              No contacts linked to this account yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
              {account.contacts.map((contact) => (
                <Link
                  key={contact.id}
                  href={`/contacts/${contact.id}`}
                  className="block px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {contact.firstName} {contact.lastName ?? ""}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {[contact.email, contact.phone].filter(Boolean).join(" · ") ||
                      "No details yet"}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Opportunities
        </h2>
        {account.opportunities.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-zinc-500">
              No opportunities linked to this account yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
              {account.opportunities.map((opportunity) => (
                <Link
                  key={opportunity.id}
                  href={`/opportunities/${opportunity.id}`}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {opportunity.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {currencyFormatter.format(Number(opportunity.value))}
                    </p>
                  </div>
                  <Badge variant="secondary">{opportunity.stage}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <AttachmentsSection
        entityType="account"
        entityId={id}
        attachments={attachments}
      />
      <AddNoteForm entityType="account" entityId={id} />
      <RecordTimeline entries={timeline} />
    </div>
  );
}
