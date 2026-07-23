import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeQuoteTotal } from "@/lib/quotes";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { QuoteStatusActions } from "./quote-status-actions";
import { PrintButton } from "./print-button";
import { quoteStatusBadgeVariant } from "@/lib/status-badge";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const quote = await db.quote.findFirst({
    where: { id, tenantId: user!.tenantId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      opportunity: { include: { contact: true } },
    },
  });
  if (!quote) notFound();

  const total = computeQuoteTotal(quote.lines);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Quote — {quote.opportunity.name}
          </h1>
          <p className="text-sm text-zinc-500">
            For{" "}
            <Link
              href={`/contacts/${quote.opportunity.contact.id}`}
              className="hover:underline print:no-underline"
            >
              {quote.opportunity.contact.firstName}{" "}
              {quote.opportunity.contact.lastName ?? ""}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={quoteStatusBadgeVariant(quote.status)}>
            {quote.status}
          </Badge>
          <PrintButton />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium">Qty</th>
                <th className="pb-2 font-medium">Unit price</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((line) => (
                <tr
                  key={line.id}
                  className="border-b border-zinc-100 dark:border-zinc-900"
                >
                  <td className="py-2 text-zinc-900 dark:text-zinc-50">
                    {line.description}
                  </td>
                  <td className="py-2 text-zinc-500">{line.quantity.toString()}</td>
                  <td className="py-2 text-zinc-500">
                    {currencyFormatter.format(Number(line.unitPrice))}
                  </td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-50">
                    {currencyFormatter.format(
                      Number(line.quantity) * Number(line.unitPrice),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-3 text-right font-medium">
                  Total
                </td>
                <td className="pt-3 text-right text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {currencyFormatter.format(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <QuoteStatusActions quoteId={quote.id} status={quote.status} />
    </div>
  );
}
