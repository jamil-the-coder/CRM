"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const selectClassName =
  "h-8 rounded-md border border-zinc-200 bg-transparent px-2 text-sm shadow-xs dark:border-zinc-800 dark:bg-zinc-900";

export function UserRow({
  id,
  email,
  role,
  isSelf,
}: {
  id: string;
  email: string;
  role: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function changeRole(newRole: string) {
    setBusy(true);
    await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    await fetch(`/api/team/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {email}
          {isSelf && <span className="ml-2 text-xs text-zinc-500">(you)</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <select
          className={selectClassName}
          value={role}
          disabled={busy || isSelf}
          onChange={(e) => changeRole(e.target.value)}
        >
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
        </select>
        {!isSelf && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={remove}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
