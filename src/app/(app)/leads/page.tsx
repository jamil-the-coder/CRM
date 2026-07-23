import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MineToggle } from "@/components/mine-toggle";
import { ExportCsvLink } from "@/components/export-csv-link";
import { leadStatusBadgeVariant } from "@/lib/status-badge";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const { mine } = await searchParams;
  const user = await getCurrentUser();
  const leads = await db.lead.findMany({
    where: {
      tenantId: user!.tenantId,
      ...(mine === "1" ? { ownerUserId: user!.id } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { contact: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Leads
          </h1>
          <p className="text-sm text-zinc-500">
            Contacts working their way toward becoming an opportunity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MineToggle />
          <ExportCsvLink entity="leads" />
        </div>
      </div>

      {leads.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            No leads yet. Leads show up here once a contact comes in through an
            embedded form or is created via the API.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
            {leads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {lead.contact.firstName} {lead.contact.lastName ?? ""}
                  </p>
                  <p className="text-xs text-zinc-500">Source: {lead.source}</p>
                </div>
                <Badge variant={leadStatusBadgeVariant(lead.status)}>
                  {lead.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
