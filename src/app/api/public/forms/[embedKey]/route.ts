import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type RouteParams = { params: Promise<{ embedKey: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { embedKey } = await params;

  const form = await db.form.findUnique({
    where: { embedKey },
    select: { name: true, fields: true },
  });
  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ form });
}
