"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm shadow-xs dark:border-zinc-800 dark:bg-zinc-900";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  contact: "Contact",
  account: "Account",
  opportunity: "Opportunity",
};

export function NewFieldForm() {
  const router = useRouter();
  const [entityType, setEntityType] = useState("contact");
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/custom-fields", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType,
        key,
        label,
        type,
        options:
          type === "select"
            ? options
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Couldn't create that field.");
      setSubmitting(false);
      return;
    }

    setKey("");
    setLabel("");
    setOptions("");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="entityType">Applies to</Label>
            <select
              id="entityType"
              className={selectClassName}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              {Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="label">Field label</Label>
            <Input
              id="label"
              required
              placeholder="e.g. Renewal date"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              required
              placeholder="e.g. renewal_date"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              className={selectClassName}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select</option>
            </select>
          </div>
          {type === "select" && (
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="options">Options (comma-separated)</Label>
              <Input
                id="options"
                required
                placeholder="e.g. Small, Medium, Large"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
              />
            </div>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add field"}
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
