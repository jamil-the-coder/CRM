"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

export function VisibilityToggle({
  restrictMemberVisibility,
}: {
  restrictMemberVisibility: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch("/api/team/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        restrictMemberVisibility: !restrictMemberVisibility,
      }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-6">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Restrict members to their own records
          </p>
          <p className="text-xs text-zinc-500">
            When on, Member accounts only see Contacts, Accounts, Leads, and
            Opportunities they own. Admins always see everything.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={restrictMemberVisibility}
          className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
            restrictMemberVisibility ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800"
          }`}
        >
          <span
            className={`block size-5 rounded-full bg-white shadow transition-transform dark:bg-zinc-950 ${
              restrictMemberVisibility ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </CardContent>
    </Card>
  );
}
