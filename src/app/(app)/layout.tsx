import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LogoutButton } from "./logout-button";
import { GlobalSearch } from "@/components/global-search";
import { SidebarNav } from "./sidebar-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } });
  const initial = (tenant?.name ?? "W").charAt(0).toUpperCase();

  return (
    <div className="flex flex-1">
      <aside className="bg-sidebar border-sidebar-border text-sidebar-foreground flex w-60 flex-col border-r p-3 print:hidden">
        <div className="mb-5 flex items-center gap-2.5 px-2 pt-1">
          <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-semibold">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              {tenant?.name ?? "Workspace"}
            </p>
            <p className="text-sidebar-foreground/50 truncate text-xs">
              {user.email}
            </p>
          </div>
        </div>
        <SidebarNav />
        <div className="border-sidebar-border mt-3 border-t pt-3">
          <LogoutButton />
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-border bg-background/80 flex items-center border-b px-8 py-3 backdrop-blur-sm print:hidden">
          <GlobalSearch />
        </header>
        <main className="bg-muted/40 flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
