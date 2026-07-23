import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NewWebhookEndpointForm } from "./new-webhook-endpoint-form";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> =
  {
    success: "default",
    pending: "secondary",
    failed: "destructive",
    rejected_honeypot: "secondary",
    rejected_rate_limited: "secondary",
  };

export default async function WebhooksPage() {
  const user = await getCurrentUser();
  const endpoints = await db.webhookEndpoint.findMany({
    where: { tenantId: user!.tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { deliveries: true } },
      deliveries: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Webhooks
        </h1>
        <p className="text-sm text-muted-foreground">
          Send CRM events to n8n (or anywhere else) as signed HTTP POST
          requests. See <code className="text-xs">EVENTS.md</code> for the
          payload format.
        </p>
      </div>

      <NewWebhookEndpointForm />

      {endpoints.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No webhook endpoints configured yet.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {endpoints.map((endpoint) => (
            <Card key={endpoint.id}>
              <CardContent className="flex flex-col gap-3 pt-6">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-foreground">
                    {endpoint.url}
                  </p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {endpoint._count.deliveries} deliveries
                  </p>
                </div>
                {endpoint.deliveries.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Recent deliveries
                    </p>
                    {endpoint.deliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-muted-foreground">
                          {delivery.eventType} · attempt {delivery.attempts}
                          {delivery.lastError ? ` · ${delivery.lastError}` : ""}
                        </span>
                        <Badge
                          variant={
                            STATUS_VARIANT[delivery.status] ?? "secondary"
                          }
                        >
                          {delivery.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
