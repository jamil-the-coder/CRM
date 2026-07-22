import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as processDue } from "./route";

describe("POST /api/webhooks/process-due", () => {
  it("rejects requests without the correct bearer secret", async () => {
    const response = await processDue(
      new NextRequest("http://localhost:3000/api/webhooks/process-due", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects requests with the wrong secret", async () => {
    const response = await processDue(
      new NextRequest("http://localhost:3000/api/webhooks/process-due", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("accepts requests with the correct bearer secret", async () => {
    const response = await processDue(
      new NextRequest("http://localhost:3000/api/webhooks/process-due", {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.WEBHOOK_PROCESSOR_SECRET}`,
        },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.processed).toBe("number");
  });
});
