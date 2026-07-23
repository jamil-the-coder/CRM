import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { computeQuoteTotal } from "@/lib/quotes";
import { NewQuoteForm } from "./new-quote-form";

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
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Quotes
        </h1>
        <p className="text-sm text-zinc-500">
          Tied to an opportunity — accepting one updates the deal&apos;s value.
        </p>
      </div>

      <NewQuoteForm
        opportunities={opportunities}
        products={products.map((p) => ({ ...p, unitPrice: p.unitPrice.toString() }))}
      />

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            No quotes yet. Create one above.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
            {quotes.map((quote) => (
              <Link
                key={quote.id}
                href={`/quotes/${quote.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {quote.opportunity.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {currencyFormatter.format(computeQuoteTotal(quote.lines))}
                  </p>
                </div>
                <Badge variant="secondary">{quote.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
