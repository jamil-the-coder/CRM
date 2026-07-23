"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Building2,
  Users,
  Flame,
  Kanban,
  Receipt,
  Package,
  FileText,
  Phone,
  ClipboardList,
  Webhook,
  KeyRound,
  SlidersHorizontal,
  Tag,
  UsersRound,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Overview",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/tasks", label: "My Tasks", icon: ListChecks },
    ],
  },
  {
    label: "Sales",
    links: [
      { href: "/accounts", label: "Accounts", icon: Building2 },
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/leads", label: "Leads", icon: Flame },
      { href: "/opportunities", label: "Opportunities", icon: Kanban },
      { href: "/products", label: "Products", icon: Package },
      { href: "/quotes", label: "Quotes", icon: FileText },
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/calls", label: "Calls", icon: Phone },
    ],
  },
  {
    label: "Automation",
    links: [
      { href: "/forms", label: "Forms", icon: ClipboardList },
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
      { href: "/api-keys", label: "API Keys", icon: KeyRound },
    ],
  },
  {
    label: "Workspace",
    links: [
      { href: "/custom-fields", label: "Custom Fields", icon: SlidersHorizontal },
      { href: "/tags", label: "Tags", icon: Tag },
      { href: "/team", label: "Team", icon: UsersRound },
      { href: "/audit-log", label: "Audit Log", icon: ScrollText },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-2 pb-1 text-[0.65rem] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">
            {group.label}
          </p>
          {group.links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                {active && (
                  <span className="absolute top-1 bottom-1 -left-2 w-0.75 rounded-full bg-primary" />
                )}
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-primary" : "text-sidebar-foreground/50",
                  )}
                />
                {link.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
