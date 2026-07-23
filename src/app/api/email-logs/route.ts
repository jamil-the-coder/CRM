import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

const createEmailLogSchema = z.object({
  contactId: z.string().min(1),
  direction: z.enum(["inbound", "outbound"]),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(10000),
  occurredAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;

  const body = await request.json().catch(() => null);
  const parsed = createEmailLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const contact = await db.contact.findFirst({
    where: { id: parsed.data.contactId, tenantId },
  });
  if (!contact) {
    return NextResponse.json(
      { error: "contactId does not belong to this tenant" },
      { status: 400 },
    );
  }

  const emailLog = await db.emailLog.create({
    data: {
      tenantId,
      contactId: parsed.data.contactId,
      direction: parsed.data.direction,
      subject: parsed.data.subject,
      body: parsed.data.body,
      occurredAt: parsed.data.occurredAt
        ? new Date(parsed.data.occurredAt)
        : new Date(),
    },
  });

  return NextResponse.json({ emailLog }, { status: 201 });
}
