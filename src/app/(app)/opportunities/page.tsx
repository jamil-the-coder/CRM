import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function OpportunitiesPage() {
  const user = await getCurrentUser();
  const opportunities = await db.opportunity.findMany({
    where: { tenantId: user!.tenantId },
    orderBy: { createdAt: "desc" },
    include: { contact: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Opportunities
        </h1>
        <p className="text-sm text-zinc-500">
          Deals in progress across your pipeline.
        </p>
      </div>

      {opportunities.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            No opportunities yet. Convert a lead into an opportunity to start
            tracking it here.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
            {opportunities.map((opportunity) => (
              <div
                key={opportunity.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {opportunity.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {opportunity.contact.firstName}{" "}
                    {opportunity.contact.lastName ?? ""} ·{" "}
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
  );
}
