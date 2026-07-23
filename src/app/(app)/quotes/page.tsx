import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { computeQuoteTotal } from "@/lib/quotes";
import { NewQuoteForm } from "./new-quote-form";
import { quoteStatusBadgeVariant } from "@/lib/status-badge";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function QuotesPage() {
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;

  const [quotes, opportunities, products] = await Promise.all([
    db.quote.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { lines: true, opportunity: { select: { name: true } } },
    }),
    db.opportunity.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
    db.product.findMany({
      where: { tenantId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unitPrice: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Quotes
        </h1>
        <p className="text-sm text-muted-foreground">
          Tied to an opportunity — accepting one updates the deal&apos;s value.
        </p>
      </div>

      <NewQuoteForm
        opportunities={opportunities}
        products={products.map((p) => ({ ...p, unitPrice: p.unitPrice.toString() }))}
      />

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No quotes yet. Create one above.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0 dark:divide-border">
            {quotes.map((quote) => (
              <Link
                key={quote.id}
                href={`/quotes/${quote.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {quote.opportunity.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currencyFormatter.format(computeQuoteTotal(quote.lines))}
                  </p>
                </div>
                <Badge variant={quoteStatusBadgeVariant(quote.status)}>
                  {quote.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
