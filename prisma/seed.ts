import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

async function main() {
  const tenant = await db.tenant.upsert({
    where: { id: "demo-tenant" },
    update: {},
    create: {
      id: "demo-tenant",
      name: "Demo Tenant",
      plan: "trial",
    },
  });

  const passwordHash = await bcrypt.hash("demo-password-123", 10);

  const admin = await db.user.upsert({
    where: { email: "admin@demo.test" },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "admin@demo.test",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Seeded tenant "${tenant.name}" (${tenant.id}) with admin user ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
