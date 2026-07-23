import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { NewUserForm } from "./new-user-form";
import { UserRow } from "./user-row";
import { VisibilityToggle } from "./visibility-toggle";

export default async function TeamPage() {
  const user = await getCurrentUser();

  if (user!.role !== "ADMIN") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Team
          </h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            Only admins can manage the team.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [users, tenant] = await Promise.all([
    db.user.findMany({
      where: { tenantId: user!.tenantId },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, role: true },
    }),
    db.tenant.findUnique({
      where: { id: user!.tenantId },
      select: { restrictMemberVisibility: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Team
        </h1>
        <p className="text-sm text-zinc-500">
          People with access to this workspace.
        </p>
      </div>

      <NewUserForm />

      <Card>
        <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
          {users.map((u) => (
            <UserRow
              key={u.id}
              id={u.id}
              email={u.email}
              role={u.role}
              isSelf={u.id === user!.id}
            />
          ))}
        </CardContent>
      </Card>

      <VisibilityToggle
        restrictMemberVisibility={tenant?.restrictMemberVisibility ?? false}
      />
    </div>
  );
}
