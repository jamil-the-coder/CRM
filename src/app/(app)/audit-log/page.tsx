import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatAction(action: string): string {
  return action.replace(/[._]/g, " ");
}

export default async function AuditLogPage() {
  const user = await getCurrentUser();

  if (user!.role !== "ADMIN") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Audit Log
          </h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            Only admins can view the audit log.
          </CardContent>
        </Card>
      </div>
    );
  }

  const entries = await db.auditLog.findMany({
    where: { tenantId: user!.tenantId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const actorIds = [
    ...new Set(entries.map((e) => e.actorUserId).filter((id): id is string => Boolean(id))),
  ];
  const actors = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, email: true },
      })
    : [];
  const actorEmailById = new Map(actors.map((a) => [a.id, a.email]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Audit Log
        </h1>
        <p className="text-sm text-zinc-500">
          Security-sensitive actions — sign-ins, API key and webhook changes,
          team and data-export events. Separate from each record&apos;s own
          activity timeline.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            Nothing logged yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {formatAction(entry.action)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {entry.actorUserId
                      ? (actorEmailById.get(entry.actorUserId) ?? "Unknown user")
                      : "System"}
                    {entry.ipAddress && ` · ${entry.ipAddress}`}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {entry.createdAt.toLocaleString()}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
