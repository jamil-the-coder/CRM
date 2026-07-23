import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { NewApiKeyForm } from "./new-api-key-form";

export default async function ApiKeysPage() {
  const user = await getCurrentUser();
  const apiKeys = await db.apiKey.findMany({
    where: { tenantId: user!.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          API keys
        </h1>
        <p className="text-sm text-muted-foreground">
          Used by n8n (or any other tool) to read and write CRM data. See{" "}
          <code className="text-xs">API.md</code> for the full endpoint
          reference.
        </p>
      </div>

      <NewApiKeyForm />

      {apiKeys.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No API keys yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0 dark:divide-border">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {key.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {key.keyPrefix}… ·{" "}
                    {key.lastUsedAt
                      ? `last used ${key.lastUsedAt.toLocaleDateString()}`
                      : "never used"}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
