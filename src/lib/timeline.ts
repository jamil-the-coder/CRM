import { db } from "@/lib/db";

export type TimelineEntry =
  | {
      kind: "activity";
      id: string;
      type: string;
      payload: unknown;
      createdAt: Date;
    }
  | {
      kind: "note";
      id: string;
      body: string;
      authorEmail: string | null;
      createdAt: Date;
    }
  | {
      kind: "email";
      id: string;
      direction: string;
      subject: string;
      body: string;
      createdAt: Date;
    };

/**
 * Merges the Activity log (business events — created/stage-changed/etc,
 * written since Phase 4) with Notes (Phase 21) into one chronological stream
 * for a record's detail page — the "unified per-record timeline" the
 * addendum's gap analysis flagged as missing (Activity existed but had
 * nowhere to be shown).
 */
export async function getTimeline(
  tenantId: string,
  entityType: string,
  entityId: string,
): Promise<TimelineEntry[]> {
  const [activities, notes, emailLogs] = await Promise.all([
    db.activity.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { createdAt: "desc" },
    }),
    db.note.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { createdAt: "desc" },
      include: { author: true },
    }),
    entityType === "contact"
      ? db.emailLog.findMany({
          where: { tenantId, contactId: entityId },
          orderBy: { occurredAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const entries: TimelineEntry[] = [
    ...activities.map((a): TimelineEntry => ({
      kind: "activity",
      id: a.id,
      type: a.type,
      payload: a.payload,
      createdAt: a.createdAt,
    })),
    ...notes.map((n): TimelineEntry => ({
      kind: "note",
      id: n.id,
      body: n.body,
      authorEmail: n.author?.email ?? null,
      createdAt: n.createdAt,
    })),
    ...emailLogs.map((e): TimelineEntry => ({
      kind: "email",
      id: e.id,
      direction: e.direction,
      subject: e.subject,
      body: e.body,
      createdAt: e.occurredAt,
    })),
  ];

  return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
