"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewFormForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/forms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Couldn't create that form.");
      setSubmitting(false);
      return;
    }

    setName("");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="formName">Form name</Label>
            <Input
              id="formName"
              placeholder="e.g. Website contact form"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create form"}
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
