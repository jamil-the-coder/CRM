import { NextResponse, type NextRequest } from "next/server";
import { processDueDeliveries } from "@/lib/webhooks";

/**
 * Meant to be hit periodically by an external scheduler (cron job, Vercel
 * Cron, etc.) to retry webhook deliveries whose backoff window has elapsed.
 * Protected by a shared secret rather than a user session, since nothing
 * ties this to a particular signed-in user — it processes all tenants' due
 * deliveries in one pass.
 */
export async function POST(request: NextRequest) {
  const providedSecret = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const expectedSecret = process.env.WEBHOOK_PROCESSOR_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "WEBHOOK_PROCESSOR_SECRET is not configured" },
      { status: 500 },
    );
  }
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await processDueDeliveries();
  return NextResponse.json(result);
}
