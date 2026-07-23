"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ConvertButton({
  leadId,
  contactId,
  defaultName,
}: {
  leadId: string;
  contactId: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const createResponse = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, contactId, leadId }),
    });

    if (!createResponse.ok) {
      const body = await createResponse.json().catch(() => ({}));
      setError(body.error ?? "Couldn't create the opportunity.");
      setSubmitting(false);
      return;
    }

    const { opportunity } = await createResponse.json();

    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "converted" }),
    });

    router.push(`/opportunities/${opportunity.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Convert to opportunity
      </Button>
    );
  }

  return (
    <form onSubmit={handleConvert} className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 w-56"
        autoFocus
      />
      <Button type="submit" size="sm" disabled={submitting}>
        {submitting ? "Converting…" : "Create"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(false)}
        disabled={submitting}
      >
        Cancel
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </form>
  );
}
