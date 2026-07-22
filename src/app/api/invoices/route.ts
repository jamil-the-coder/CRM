import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const invoices = await db.invoice.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { opportunity: { include: { contact: true } } },
  });
  return NextResponse.json({ invoices });
}
