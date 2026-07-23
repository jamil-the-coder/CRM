import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NewContactForm } from "./new-contact-form";
import { TagFilter } from "./tag-filter";
import { ContactTags } from "./contact-tags";
import { getTagsForEntities, getEntityIdsForTag } from "@/lib/tags";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ tagId?: string }>;
}) {
  const { tagId } = await searchParams;
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;

  const [allContacts, accounts, customFieldDefinitions, allTags] =
    await Promise.all([
      db.contact.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        include: { account: true },
      }),
      db.account.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db.customFieldDefinition.findMany({
        where: { tenantId, entityType: "contact" },
        orderBy: { sortOrder: "asc" },
      }),
      db.tag.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    ]);

  const filteredIds = tagId
    ? new Set(await getEntityIdsForTag(tenantId, "contact", tagId))
    : null;
  const contacts = filteredIds
    ? allContacts.filter((c) => filteredIds.has(c.id))
    : allContacts;

  const tagsByContact = await getTagsForEntities(
    tenantId,
    "contact",
    contacts.map((c) => c.id),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Contacts
          </h1>
          <p className="text-sm text-zinc-500">
            People and companies you&apos;re in touch with.
          </p>
        </div>
        <TagFilter tags={allTags} />
      </div>

      <NewContactForm
        accounts={accounts}
        customFieldDefinitions={customFieldDefinitions}
      />

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            {tagId
              ? "No contacts with that tag."
              : "No contacts yet. Add one above to get started."}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-visible">
          <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <Link href={`/contacts/${contact.id}`} className="group">
                  <p className="text-sm font-medium text-zinc-900 group-hover:underline dark:text-zinc-50">
                    {contact.firstName} {contact.lastName ?? ""}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {[contact.email, contact.company]
                      .filter(Boolean)
                      .join(" · ") || "No details yet"}
                  </p>
                </Link>
                <div className="flex items-center gap-2">
                  {contact.account && (
                    <Badge variant="secondary">{contact.account.name}</Badge>
                  )}
                  <ContactTags
                    contactId={contact.id}
                    assignedTags={tagsByContact[contact.id] ?? []}
                    allTags={allTags}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
