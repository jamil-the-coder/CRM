import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { getStorageProvider } from "@/lib/storage";
import {
  ALLOWED_ATTACHMENT_CONTENT_TYPES,
  ATTACHMENT_ENTITY_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  attachmentEntityBelongsToTenant,
} from "@/lib/attachments";

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: "entityType and entityId query params are required" },
      { status: 400 },
    );
  }

  const attachments = await db.attachment.findMany({
    where: { tenantId: auth.user.tenantId, entityType, entityId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ attachments });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId, id: userId } = auth.user;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  const entityType = formData.get("entityType");
  const entityId = formData.get("entityId");

  if (!(file instanceof File) || typeof entityType !== "string" || typeof entityId !== "string") {
    return NextResponse.json(
      { error: "file, entityType, and entityId are required" },
      { status: 400 },
    );
  }
  if (!ATTACHMENT_ENTITY_TYPES.includes(entityType as (typeof ATTACHMENT_ENTITY_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
  }
  if (!(await attachmentEntityBelongsToTenant(entityType, entityId, tenantId))) {
    return NextResponse.json(
      { error: "entityId does not belong to this tenant" },
      { status: 400 },
    );
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the ${MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024}MB limit` },
      { status: 400 },
    );
  }
  if (!ALLOWED_ATTACHMENT_CONTENT_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `File type "${file.type}" is not allowed` },
      { status: 400 },
    );
  }

  const storageKey = `${tenantId}/${crypto.randomUUID()}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await getStorageProvider().save({ key: storageKey, data: buffer });

  const attachment = await db.attachment.create({
    data: {
      tenantId,
      entityType,
      entityId,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      storageKey,
      uploadedByUserId: userId,
    },
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
