import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { getOwnershipVisibilityWhere } from "@/lib/visibility";

const PER_TYPE_LIMIT = 5;

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({
      contacts: [],
      accounts: [],
      leads: [],
      opportunities: [],
    });
  }

  const { tenantId } = auth.user;
  const visibility = await getOwnershipVisibilityWhere(auth.user);
  const insensitive = { contains: q, mode: "insensitive" as const };

  const [contacts, accounts, leads, opportunities] = await Promise.all([
    db.contact.findMany({
      where: {
        tenantId,
        ...visibility,
        OR: [
          { firstName: insensitive },
          { lastName: insensitive },
          { email: insensitive },
          { company: insensitive },
        ],
      },
      take: PER_TYPE_LIMIT,
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    db.account.findMany({
      where: { tenantId, ...visibility, name: insensitive },
      take: PER_TYPE_LIMIT,
      select: { id: true, name: true },
    }),
    db.lead.findMany({
      where: {
        tenantId,
        ...visibility,
        contact: {
          OR: [
            { firstName: insensitive },
            { lastName: insensitive },
            { email: insensitive },
          ],
        },
      },
      take: PER_TYPE_LIMIT,
      select: { id: true, contact: { select: { firstName: true, lastName: true } } },
    }),
    db.opportunity.findMany({
      where: { tenantId, ...visibility, name: insensitive },
      take: PER_TYPE_LIMIT,
      select: { id: true, name: true },
    }),
  ]);

  return NextResponse.json({
    contacts: contacts.map((c) => ({
      id: c.id,
      label: `${c.firstName} ${c.lastName ?? ""}`.trim(),
      sublabel: c.email,
      href: `/contacts/${c.id}`,
    })),
    accounts: accounts.map((a) => ({
      id: a.id,
      label: a.name,
      href: `/accounts/${a.id}`,
    })),
    leads: leads.map((l) => ({
      id: l.id,
      label: `${l.contact.firstName} ${l.contact.lastName ?? ""}`.trim(),
      href: `/leads/${l.id}`,
    })),
    opportunities: opportunities.map((o) => ({
      id: o.id,
      label: o.name,
      href: `/opportunities/${o.id}`,
    })),
  });
}
