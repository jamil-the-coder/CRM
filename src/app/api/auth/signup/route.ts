import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { createSession, hashPassword, setSessionCookie } from "@/lib/auth";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/pipeline-stages";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/audit-log";

const signupSchema = z.object({
  tenantName: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(10).max(200),
});

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request);
  // Skipped under the test runner: every test that needs a tenant calls this
  // route directly (createTestTenant), often dozens of times per file, all
  // with no IP header — a real per-IP limit would immediately 429 the suite.
  // checkRateLimit() itself is still exercised directly by its own test.
  if (!process.env.VITEST) {
    const { limited } = await checkRateLimit(`signup:${ipAddress ?? "unknown"}`, {
      windowMs: 60 * 60 * 1000,
      max: 5,
    });
    if (limited) {
      return NextResponse.json({ error: "Too many signup attempts. Please try again later." }, { status: 429 });
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { tenantName, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  let created: {
    user: Awaited<ReturnType<typeof db.user.create>>;
    tenant: Awaited<ReturnType<typeof db.tenant.create>>;
  };
  try {
    created = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: tenantName } });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash,
          role: "ADMIN",
        },
      });
      await tx.pipelineStage.createMany({
        data: DEFAULT_PIPELINE_STAGES.map((stage) => ({
          tenantId: tenant.id,
          ...stage,
        })),
      });
      return { user, tenant };
    });
  } catch (error) {
    // Handles the race where two signups for the same email land between the
    // check above and this transaction — the unique constraint is the real guard.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: 409 },
      );
    }
    throw error;
  }
  const { user, tenant } = created;

  await recordAuditLog({
    tenantId: tenant.id,
    actorUserId: user.id,
    action: "auth.signup",
    ipAddress,
  });

  const { token, expiresAt } = await createSession(user.id);

  const response = NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: { id: tenant.id, name: tenant.name },
    },
    { status: 201 },
  );
  setSessionCookie(response, token, expiresAt);
  return response;
}
