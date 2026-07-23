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
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Accounts
          </h1>
          <p className="text-sm text-zinc-500">
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
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            No accounts yet. Add one above to get started.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
            {accounts.map((account) => (
              <Link
                key={account.id}
                href={`/accounts/${account.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {account.name}
                </p>
                <p className="text-xs text-zinc-500">
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
