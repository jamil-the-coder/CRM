import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { getStorageProvider } from "@/lib/storage";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const attachment = await db.attachment.findFirst({
    where: { id, tenantId: auth.user.tenantId },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = await getStorageProvider().read(attachment.storageKey);
  if (!data) {
    return NextResponse.json({ error: "File is missing from storage" }, { status: 410 });
  }

  // Always a forced download, never inline — regardless of content type, so
  // an uploaded HTML/SVG file (accepted or not) is never rendered by the
  // browser in this origin's context. Content-Type is also forced to
  // octet-stream for the same reason: some browsers will still attempt
  // inline rendering of certain types even with an attachment disposition
  // if the declared content-type invites it.
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
      "content-length": String(attachment.sizeBytes),
    },
  });
}
