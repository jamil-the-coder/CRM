import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { computeDedupeKey, findDuplicateContacts } from "@/lib/dedupe";
import { HONEYPOT_FIELD_NAME } from "@/lib/forms";
import { getClientIp, isFormSubmissionRateLimited } from "@/lib/rate-limit";
import { emitEvent } from "@/lib/webhooks";

const submissionSchema = z.object({
  firstName: z.string().trim().min(1).max(200),
  lastName: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email().max(320).optional(),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  [HONEYPOT_FIELD_NAME]: z.string().max(500).optional(),
});

type RouteParams = { params: Promise<{ embedKey: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { embedKey } = await params;

  const form = await db.form.findUnique({ where: { embedKey } });
  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { [HONEYPOT_FIELD_NAME]: honeypotValue, ...fields } = parsed.data;
  const ipAddress = getClientIp(request);

  // Honeypot tripped: a real visitor never sees or fills this field, so
  // anything in it means an automated submission. Respond as if it succeeded
  // (don't tip off the bot) but create nothing.
  if (honeypotValue) {
    await db.formSubmission.create({
      data: {
        tenantId: form.tenantId,
        formId: form.id,
        payload: fields as Prisma.InputJsonValue,
        status: "rejected_honeypot",
        ipAddress,
      },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (await isFormSubmissionRateLimited(form.id, ipAddress)) {
    await db.formSubmission.create({
      data: {
        tenantId: form.tenantId,
        formId: form.id,
        payload: fields as Prisma.InputJsonValue,
        status: "rejected_rate_limited",
        ipAddress,
      },
    });
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
    );
  }

  const duplicates = await findDuplicateContacts(form.tenantId, fields);
  const contact = await db.contact.create({
    data: {
      tenantId: form.tenantId,
      ...fields,
      dedupeKey: computeDedupeKey(fields),
    },
  });

  const lead = await db.lead.create({
    data: {
      tenantId: form.tenantId,
      contactId: contact.id,
      source: `form:${form.name}`,
    },
  });
  await logActivity(form.tenantId, "lead", lead.id, "lead.created", {
    source: lead.source,
  });
  await logActivity(form.tenantId, "lead", lead.id, "form.submitted", {
    formId: form.id,
    possibleDuplicates: duplicates.map((d) => d.id),
  });
  await emitEvent(form.tenantId, "lead.created", { lead });
  await emitEvent(form.tenantId, "form.submitted", {
    formId: form.id,
    formName: form.name,
    lead,
  });

  await db.formSubmission.create({
    data: {
      tenantId: form.tenantId,
      formId: form.id,
      payload: fields as Prisma.InputJsonValue,
      status: "accepted",
      leadId: lead.id,
      ipAddress,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
