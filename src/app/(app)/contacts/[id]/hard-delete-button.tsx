"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function HardDeleteButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    const response = await fetch(`/api/contacts/${contactId}/hard-delete`, {
      method: "DELETE",
    });
    if (response.ok) {
      router.push("/contacts");
      router.refresh();
    } else {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        Delete permanently
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500">
        Permanently delete this person and all their notes, files, and
        activity?
      </span>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={busy}
        onClick={handleDelete}
      >
        {busy ? "Deleting…" : "Confirm delete"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </div>
  );
}
