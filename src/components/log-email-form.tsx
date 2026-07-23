"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm shadow-xs dark:border-zinc-800 dark:bg-zinc-900";

export function LogEmailForm({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [direction, setDirection] = useState("outbound");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/email-logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contactId, direction, subject, body }),
    });

    if (!response.ok) {
      const responseBody = await response.json().catch(() => ({}));
      setError(responseBody.error ?? "Couldn't log that email.");
      setSubmitting(false);
      return;
    }

    setSubject("");
    setBody("");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Log an email
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-col gap-2">
              <Label htmlFor="direction">Direction</Label>
              <select
                id="direction"
                className={selectClassName}
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              >
                <option value="outbound">Sent</option>
                <option value="inbound">Received</option>
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>
          <textarea
            required
            placeholder="Email body…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Logging…" : "Log email"}
            </Button>
          </div>
        </form>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
