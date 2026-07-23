"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactPicker } from "@/components/contact-picker";

export function NewLeadForm({
  contacts,
}: {
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [contactId, setContactId] = useState("");
  const [source, setSource] = useState("manual");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!contactId) {
      setError("Pick a contact for this lead.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contactId, source: source || undefined }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Couldn't create that lead.");
      setSubmitting(false);
      return;
    }

    setContactId("");
    setSource("manual");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Card className="overflow-visible">
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex flex-1 flex-col gap-2">
            <ContactPicker
              contacts={contacts}
              value={contactId}
              onChange={setContactId}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="source">Source</Label>
            <Input
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add lead"}
          </Button>
        </form>
        {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
