import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { ensurePipelineStages } from "@/lib/pipeline-stages";

const createStageSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9_]+$/,
      "Use lowercase letters, numbers, and underscores only",
    ),
  label: z.string().trim().min(1).max(100),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
  defaultProbability: z.number().int().min(0).max(100).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const stages = await ensurePipelineStages(auth.user.tenantId);
  return NextResponse.json({ stages });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;

  const body = await request.json().catch(() => null);
  const parsed = createStageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await db.pipelineStage.findUnique({
    where: { tenantId_key: { tenantId, key: parsed.data.key } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A stage with that key already exists" },
      { status: 409 },
    );
  }

  const maxOrder = await db.pipelineStage.aggregate({
    where: { tenantId },
    _max: { sortOrder: true },
  });
  const stage = await db.pipelineStage.create({
    data: {
      tenantId,
      key: parsed.data.key,
      label: parsed.data.label,
      isWon: parsed.data.isWon ?? false,
      isLost: parsed.data.isLost ?? false,
      defaultProbability: parsed.data.defaultProbability ?? 0,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json({ stage }, { status: 201 });
}
