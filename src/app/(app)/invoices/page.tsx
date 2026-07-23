import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { invoiceStatusBadgeVariant } from "@/lib/status-badge";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function InvoicesPage() {
  const user = await getCurrentUser();
  const invoices = await db.invoice.findMany({
    where: { tenantId: user!.tenantId },
    orderBy: { createdAt: "desc" },
    include: { opportunity: { include: { contact: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Invoices
        </h1>
        <p className="text-muted-foreground text-sm">
          Created automatically by the Finance Agent when a deal closes won. A
          placeholder for a real accounting integration (Xero/QuickBooks) — not
          a payment processor.
        </p>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            No invoices yet. They appear here once an opportunity is marked
            closed won and the Finance Agent n8n flow runs.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-border divide-y p-0">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="hover:bg-muted/40 flex items-center justify-between px-4 py-3 transition-colors"
              >
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {invoice.opportunity.name} ·{" "}
                    {invoice.opportunity.contact.firstName}{" "}
                    {invoice.opportunity.contact.lastName ?? ""}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {currencyFormatter.format(Number(invoice.amount))}
                  </p>
                </div>
                <Badge variant={invoiceStatusBadgeVariant(invoice.status)}>
                  {invoice.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
