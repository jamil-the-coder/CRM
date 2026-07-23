import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { getOwnershipVisibilityWhere } from "@/lib/visibility";
import { toCsv } from "@/lib/csv";
import { recordAuditLog } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";

const EXPORTERS: Record<
  string,
  {
    columns: string[];
    fetch: (
      tenantId: string,
      visibility: { ownerUserId?: string },
    ) => Promise<Record<string, unknown>[]>;
  }
> = {
  contacts: {
    columns: ["id", "firstName", "lastName", "email", "phone", "company", "createdAt"],
    fetch: (tenantId, visibility) =>
      db.contact.findMany({ where: { tenantId, ...visibility } }),
  },
  accounts: {
    columns: ["id", "name", "createdAt"],
    fetch: (tenantId, visibility) =>
      db.account.findMany({ where: { tenantId, ...visibility } }),
  },
  leads: {
    columns: ["id", "contactId", "source", "status", "score", "createdAt"],
    fetch: (tenantId, visibility) =>
      db.lead.findMany({ where: { tenantId, ...visibility } }),
  },
  opportunities: {
    columns: ["id", "name", "stage", "value", "currency", "createdAt"],
    fetch: (tenantId, visibility) =>
      db.opportunity.findMany({ where: { tenantId, ...visibility } }),
  },
};

type RouteParams = { params: Promise<{ entity: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { entity } = await params;

  const exporter = EXPORTERS[entity];
  if (!exporter) {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  const visibility = await getOwnershipVisibilityWhere(auth.user);
  const rows = await exporter.fetch(auth.user.tenantId, visibility);
  const csv = toCsv(rows, exporter.columns);

  await recordAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "data.exported",
    metadata: { entity, rowCount: rows.length },
    ipAddress: getClientIp(request),
  });

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${entity}.csv"`,
    },
  });
}
