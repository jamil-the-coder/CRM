import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MineToggle } from "@/components/mine-toggle";
import { ExportCsvLink } from "@/components/export-csv-link";
import { leadStatusBadgeVariant } from "@/lib/status-badge";
import { NewLeadForm } from "./new-lead-form";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const { mine } = await searchParams;
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;
  const [leads, contacts] = await Promise.all([
    db.lead.findMany({
      where: {
        tenantId,
        ...(mine === "1" ? { ownerUserId: user!.id } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { contact: true },
    }),
    db.contact.findMany({
      where: { tenantId },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Leads
          </h1>
          <p className="text-sm text-muted-foreground">
            Contacts working their way toward becoming an opportunity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MineToggle />
          <ExportCsvLink entity="leads" />
        </div>
      </div>

      <NewLeadForm
        contacts={contacts.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName ?? ""}`.trim(),
        }))}
      />

      {leads.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No leads yet. Add one above, or they&apos;ll show up automatically
            from an embedded form or the API.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0 dark:divide-border">
            {leads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {lead.contact.firstName} {lead.contact.lastName ?? ""}
                  </p>
                  <p className="text-xs text-muted-foreground">Source: {lead.source}</p>
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
