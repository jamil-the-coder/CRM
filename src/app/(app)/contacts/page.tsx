import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NewContactForm } from "./new-contact-form";
import { TagFilter } from "./tag-filter";
import { ContactTags } from "./contact-tags";
import { getTagsForEntities, getEntityIdsForTag } from "@/lib/tags";
import { MineToggle } from "@/components/mine-toggle";
import { ExportCsvLink } from "@/components/export-csv-link";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ tagId?: string; mine?: string }>;
}) {
  const { tagId, mine } = await searchParams;
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;

  const [allContacts, accounts, users, customFieldDefinitions, allTags] =
    await Promise.all([
      db.contact.findMany({
        where: { tenantId, ...(mine === "1" ? { ownerUserId: user!.id } : {}) },
        orderBy: { createdAt: "desc" },
        include: { account: true },
      }),
      db.account.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db.user.findMany({
        where: { tenantId },
        orderBy: { email: "asc" },
        select: { id: true, email: true },
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
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Contacts
          </h1>
          <p className="text-muted-foreground text-sm">
            People and companies you&apos;re in touch with.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MineToggle />
          <TagFilter tags={allTags} />
          <ExportCsvLink entity="contacts" />
        </div>
      </div>

      <NewContactForm
        accounts={accounts}
        users={users}
        customFieldDefinitions={customFieldDefinitions}
      />

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {tagId
              ? "No contacts with that tag."
              : "No contacts yet. Add one above to get started."}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-visible">
          <CardContent className="divide-border divide-y p-0">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="hover:bg-muted/40 flex items-center justify-between gap-4 px-4 py-3 transition-colors"
              >
                <Link href={`/contacts/${contact.id}`} className="group">
                  <p className="text-foreground group-hover:text-primary text-sm font-medium transition-colors">
                    {contact.firstName} {contact.lastName ?? ""}
                  </p>
                  <p className="text-muted-foreground text-xs">
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
