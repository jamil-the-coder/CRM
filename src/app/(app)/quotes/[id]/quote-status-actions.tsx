"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const NEXT_STATUS: Record<string, { label: string; status: string }[]> = {
  draft: [{ label: "Mark as sent", status: "sent" }],
  sent: [
    { label: "Mark accepted", status: "accepted" },
    { label: "Mark declined", status: "declined" },
  ],
  accepted: [],
  declined: [{ label: "Reopen as draft", status: "draft" }],
};

export function QuoteStatusActions({
  quoteId,
  status,
}: {
  quoteId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: string) {
    setBusy(true);
    await fetch(`/api/quotes/${quoteId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    router.refresh();
  }

  const actions = NEXT_STATUS[status] ?? [];
  if (actions.length === 0) return null;

  return (
    <div className="flex gap-2 print:hidden">
      {actions.map((action) => (
        <Button
          key={action.status}
          type="button"
          variant={action.status === "declined" ? "destructive" : "default"}
          disabled={busy}
          onClick={() => setStatus(action.status)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
