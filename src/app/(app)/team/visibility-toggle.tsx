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
          <p className="text-sm font-medium text-foreground">
            Restrict members to their own records
          </p>
          <p className="text-xs text-muted-foreground">
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
            restrictMemberVisibility ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`block size-5 rounded-full bg-background shadow transition-transform ${
              restrictMemberVisibility ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </CardContent>
    </Card>
  );
}
