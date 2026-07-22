import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Invoices
        </h1>
        <p className="text-sm text-zinc-500">
          Created automatically by the Finance Agent when a deal closes won. A
          placeholder for a real accounting integration (Xero/QuickBooks) — not
          a payment processor.
        </p>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            No invoices yet. They appear here once an opportunity is marked
            closed won and the Finance Agent n8n flow runs.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {invoice.opportunity.name} ·{" "}
                    {invoice.opportunity.contact.firstName}{" "}
                    {invoice.opportunity.contact.lastName ?? ""}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {currencyFormatter.format(Number(invoice.amount))}
                  </p>
                </div>
                <Badge variant="secondary">{invoice.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
