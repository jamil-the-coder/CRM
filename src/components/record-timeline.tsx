import { Card, CardContent } from "@/components/ui/card";
import type { TimelineEntry } from "@/lib/timeline";

function formatActivityType(type: string): string {
  return type.replace(/[._]/g, " ");
}

function formatPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.from === "string" && typeof obj.to === "string") {
    return `${obj.from} → ${obj.to}`;
  }
  return null;
}

export function RecordTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-zinc-500">
          Nothing here yet — activity and notes will show up as they happen.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
        {entries.map((entry) => (
          <div key={`${entry.kind}-${entry.id}`} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {entry.kind === "note"
                  ? `Note${entry.authorEmail ? ` from ${entry.authorEmail}` : ""}`
                  : formatActivityType(entry.type)}
              </p>
              <p className="shrink-0 text-xs text-zinc-500">
                {entry.createdAt.toLocaleString()}
              </p>
            </div>
            {entry.kind === "note" ? (
              <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {entry.body}
              </p>
            ) : (
              formatPayload(entry.payload) && (
                <p className="mt-1 text-sm text-zinc-500">
                  {formatPayload(entry.payload)}
                </p>
              )
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
