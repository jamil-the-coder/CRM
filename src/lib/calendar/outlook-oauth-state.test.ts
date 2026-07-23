import { describe, expect, it } from "vitest";
import { signOutlookState, verifyOutlookState } from "./outlook-oauth-state";

describe("Outlook OAuth state signing", () => {
  it("round-trips a tenant id through sign/verify", () => {
    const state = signOutlookState("tenant_123");
    const result = verifyOutlookState(state);
    expect(result).toEqual({ tenantId: "tenant_123" });
  });

  it("rejects a tampered tenant id", () => {
    const state = signOutlookState("tenant_123");
    const tampered = state.replace("tenant_123", "tenant_456");
    expect(verifyOutlookState(tampered)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const state = signOutlookState("tenant_123");
    const tampered = state.slice(0, -2) + "xx";
    expect(verifyOutlookState(tampered)).toBeNull();
  });

  it("rejects a malformed state string", () => {
    expect(verifyOutlookState("not-a-valid-state")).toBeNull();
  });
});
