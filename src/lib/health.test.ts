import { describe, expect, it } from "vitest";
import { getHealthStatus } from "@/lib/health";

describe("getHealthStatus", () => {
  it("reports ok with a valid ISO timestamp", () => {
    const result = getHealthStatus();
    expect(result.status).toBe("ok");
    expect(new Date(result.checkedAt).toISOString()).toBe(result.checkedAt);
  });
});
