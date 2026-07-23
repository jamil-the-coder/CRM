"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactPicker } from "@/components/contact-picker";
import { AccountPicker } from "@/components/account-picker";

const selectClassName =
  "h-9 rounded-md border border-border bg-transparent px-3 text-sm shadow-xs dark:bg-input/30";

export function NewOpportunityForm({
  stages,
  contacts,
  accounts,
}: {
  stages: { key: string; label: string }[];
  contacts: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [stage, setStage] = useState(stages[0]?.key ?? "new");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!contactId) {
      setError("Pick a contact for this opportunity.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        contactId,
        accountId: accountId || undefined,
        stage,
        value: value ? Number(value) : undefined,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Couldn't create that opportunity.");
      setSubmitting(false);
      return;
    }

    setName("");
    setContactId("");
    setAccountId("");
    setValue("");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Card className="overflow-visible">
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap"
        >
          <div className="flex flex-1 min-w-48 flex-col gap-2">
            <Label htmlFor="name">Deal name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-1 min-w-48 flex-col gap-2">
            <ContactPicker
              contacts={contacts}
              value={contactId}
              onChange={setContactId}
            />
          </div>
          <div className="flex flex-1 min-w-48 flex-col gap-2">
            <AccountPicker
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="stage">Stage</Label>
            <select
              id="stage"
              className={selectClassName}
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              {stages.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-32 flex-col gap-2">
            <Label htmlFor="value">Value ($)</Label>
            <Input
              id="value"
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add opportunity"}
          </Button>
        </form>
        {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
