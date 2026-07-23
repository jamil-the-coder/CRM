import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NewContactForm } from "./new-contact-form";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  const [contacts, accounts, customFieldDefinitions] = await Promise.all([
    db.contact.findMany({
      where: { tenantId: user!.tenantId },
      orderBy: { createdAt: "desc" },
      include: { account: true },
    }),
    db.account.findMany({
      where: { tenantId: user!.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.customFieldDefinition.findMany({
      where: { tenantId: user!.tenantId, entityType: "contact" },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Contacts
        </h1>
        <p className="text-sm text-zinc-500">
          People and companies you&apos;re in touch with.
        </p>
      </div>

      <NewContactForm
        accounts={accounts}
        customFieldDefinitions={customFieldDefinitions}
      />

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            No contacts yet. Add one above to get started.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {contact.firstName} {contact.lastName ?? ""}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {[contact.email, contact.company]
                      .filter(Boolean)
                      .join(" · ") || "No details yet"}
                  </p>
                </div>
                {contact.account && (
                  <Badge variant="secondary">{contact.account.name}</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
