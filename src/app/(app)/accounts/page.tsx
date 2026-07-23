import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { NewAccountForm } from "./new-account-form";
import { MineToggle } from "@/components/mine-toggle";
import { ExportCsvLink } from "@/components/export-csv-link";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const { mine } = await searchParams;
  const user = await getCurrentUser();
  const [accounts, customFieldDefinitions] = await Promise.all([
    db.account.findMany({
      where: {
        tenantId: user!.tenantId,
        ...(mine === "1" ? { ownerUserId: user!.id } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { contacts: true, opportunities: true } } },
    }),
    db.customFieldDefinition.findMany({
      where: { tenantId: user!.tenantId, entityType: "account" },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Accounts
          </h1>
          <p className="text-sm text-muted-foreground">
            The companies you sell to — group contacts and opportunities under
            them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MineToggle />
          <ExportCsvLink entity="accounts" />
        </div>
      </div>

      <NewAccountForm customFieldDefinitions={customFieldDefinitions} />

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No accounts yet. Add one above to get started.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0 dark:divide-border">
            {accounts.map((account) => (
              <Link
                key={account.id}
                href={`/accounts/${account.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <p className="text-sm font-medium text-foreground">
                  {account.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {account._count.contacts} contact
                  {account._count.contacts === 1 ? "" : "s"} ·{" "}
                  {account._count.opportunities} opportunit
                  {account._count.opportunities === 1 ? "y" : "ies"}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
