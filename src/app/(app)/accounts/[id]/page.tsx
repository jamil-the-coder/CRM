import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

  const account = await db.account.findFirst({
    where: { id, tenantId: user!.tenantId },
    include: {
      contacts: { orderBy: { createdAt: "desc" } },
      opportunities: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!account) notFound();

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
                <div key={contact.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {contact.firstName} {contact.lastName ?? ""}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {[contact.email, contact.phone].filter(Boolean).join(" · ") ||
                      "No details yet"}
                  </p>
                </div>
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
                <div
                  key={opportunity.id}
                  className="flex items-center justify-between px-4 py-3"
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
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
