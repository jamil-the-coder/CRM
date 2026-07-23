import Link from "next/link";
import { Users, Flame, Kanban, TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getConversionFunnel,
  getLeadSourceBreakdown,
  getPipelineValueByStage,
  getTimeSeries,
  getWeightedPipelineValue,
} from "@/lib/reports";
import { PipelineValueChart } from "./pipeline-value-chart";
import { ConversionFunnelChart } from "./conversion-funnel-chart";
import { LeadSourceChart } from "./lead-source-chart";
import { TimeSeriesChart } from "./time-series-chart";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;

  const [
    contactCount,
    leadCount,
    openOpportunityCount,
    pipelineValue,
    weightedPipeline,
    funnel,
    leadSources,
    timeSeries,
  ] = await Promise.all([
    db.contact.count({ where: { tenantId } }),
    db.lead.count({ where: { tenantId } }),
    db.opportunity.count({
      where: { tenantId, stage: { notIn: ["closed_won", "closed_lost"] } },
    }),
    getPipelineValueByStage(tenantId),
    getWeightedPipelineValue(tenantId),
    getConversionFunnel(tenantId),
    getLeadSourceBreakdown(tenantId),
    getTimeSeries(tenantId),
  ]);

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const openWeightedTotal = weightedPipeline
    .filter((s) => s.key !== "closed_won" && s.key !== "closed_lost")
    .reduce((sum, s) => sum + s.weightedValue, 0);

  const stats = [
    { label: "Contacts", value: contactCount, href: "/contacts", icon: Users },
    { label: "Leads", value: leadCount, href: "/leads", icon: Flame },
    {
      label: "Open opportunities",
      value: openOpportunityCount,
      href: "/opportunities",
      icon: Kanban,
    },
    {
      label: "Weighted pipeline",
      value: currencyFormatter.format(openWeightedTotal),
      href: "/opportunities",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm">
          A quick look at your pipeline.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className="text-primary/60 size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-foreground text-3xl font-semibold tracking-tight tabular-nums">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {contactCount === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            No data yet. Add your first contact, or connect an embeddable form
            to start capturing leads automatically.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline value by stage</CardTitle>
            </CardHeader>
            <CardContent>
              <PipelineValueChart data={pipelineValue} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversion funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {funnel.some((f) => f.reached > 0) ? (
                <ConversionFunnelChart data={funnel} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No opportunities yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead source breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {leadSources.length > 0 ? (
                <LeadSourceChart data={leadSources} />
              ) : (
                <p className="text-muted-foreground text-sm">No leads yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leads &amp; deals, last 14 days</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={timeSeries} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
