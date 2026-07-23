"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AccountPicker } from "@/components/account-picker";

export function AccountLinker({
  contactId,
  account,
  accounts,
}: {
  contactId: string;
  account: { id: string; name: string } | null;
  accounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [accountId, setAccountId] = useState(account?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function save(newAccountId: string) {
    setAccountId(newAccountId);
    setSaving(true);
    await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId: newAccountId || null }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex w-56 items-end gap-2">
        <div className="flex-1">
          <AccountPicker
            accounts={accounts}
            value={accountId}
            onChange={save}
            label="Account"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(false)}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground">Account</p>
      <div className="flex items-center gap-2">
        {account ? (
          <Link
            href={`/accounts/${account.id}`}
            className="font-medium text-foreground hover:text-primary transition-colors"
          >
            {account.name}
          </Link>
        ) : (
          <span className="text-muted-foreground text-sm">No account</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-primary text-xs font-medium hover:underline"
        >
          {account ? "Change" : "+ Link"}
        </button>
      </div>
    </div>
  );
}
