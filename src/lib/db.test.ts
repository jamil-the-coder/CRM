import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";

describe("database connectivity & seed data", () => {
  it("reads back the seeded demo tenant and its admin user", async () => {
    const tenant = await db.tenant.findUnique({
      where: { id: "demo-tenant" },
      include: { users: true },
    });

    expect(tenant).not.toBeNull();
    expect(tenant?.name).toBe("Demo Tenant");
    expect(tenant?.users).toHaveLength(1);
    expect(tenant?.users[0].email).toBe("admin@demo.test");
    expect(tenant?.users[0].role).toBe("ADMIN");
  });

  it("enforces tenant scoping via the foreign key relation", async () => {
    const user = await db.user.findUnique({
      where: { email: "admin@demo.test" },
      include: { tenant: true },
    });

    expect(user?.tenant.id).toBe("demo-tenant");
  });
});
