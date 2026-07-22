import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;

  const [contactCount, leadCount, openOpportunityCount] = await Promise.all([
    db.contact.count({ where: { tenantId } }),
    db.lead.count({ where: { tenantId } }),
    db.opportunity.count({
      where: { tenantId, stage: { notIn: ["closed_won", "closed_lost"] } },
    }),
  ]);

  const stats = [
    { label: "Contacts", value: contactCount, href: "/contacts" },
    { label: "Leads", value: leadCount, href: "/leads" },
    {
      label: "Open opportunities",
      value: openOpportunityCount,
      href: "/opportunities",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="text-sm text-zinc-500">A quick look at your pipeline.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-zinc-500">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {contactCount === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            No data yet. Add your first contact, or connect an embeddable form
            (coming in a later phase) to start capturing leads automatically.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
