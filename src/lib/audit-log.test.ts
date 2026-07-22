import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { recordAuditLog } from "./audit-log";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.auditLog.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

async function makeTenant(name: string) {
  const tenant = await db.tenant.create({ data: { name } });
  createdTenantIds.push(tenant.id);
  return tenant.id;
}

describe("recordAuditLog", () => {
  it("persists an entry with the given action, tenant, and metadata", async () => {
    const tenantId = await makeTenant("auditBasic");
    await recordAuditLog({
      tenantId,
      action: "auth.signup",
      metadata: { foo: "bar" },
      ipAddress: "203.0.113.5",
    });

    const entries = await db.auditLog.findMany({ where: { tenantId } });
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe("auth.signup");
    expect(entries[0].ipAddress).toBe("203.0.113.5");
    expect(entries[0].metadata).toEqual({ foo: "bar" });
  });

  it("accepts entries with no tenant or actor (e.g. a failed login for an unknown email)", async () => {
    const nonce = crypto.randomUUID();
    await recordAuditLog({ action: "auth.login_failed", metadata: { nonce } });

    const entries = await db.auditLog.findMany({
      where: { tenantId: null, action: "auth.login_failed" },
    });
    const match = entries.find((e) => (e.metadata as { nonce?: string } | null)?.nonce === nonce);
    expect(match).toBeDefined();

    await db.auditLog.delete({ where: { id: match!.id } });
  });
});
