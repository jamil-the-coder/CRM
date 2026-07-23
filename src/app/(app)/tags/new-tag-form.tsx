"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TAG_COLOR_CLASSNAMES, tagColorClassName } from "@/lib/tag-colors";

export function NewTagForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("zinc");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, color }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Couldn't create that tag.");
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
            <Label htmlFor="name">Tag name</Label>
            <Input
              id="name"
              required
              placeholder="e.g. VIP"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <div className="flex items-center gap-1.5">
              {Object.keys(TAG_COLOR_CLASSNAMES).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className={`size-6 rounded-full ${tagColorClassName(c)} ${
                    color === c ? "ring-2 ring-zinc-900 dark:ring-zinc-100" : ""
                  }`}
                />
              ))}
            </div>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add tag"}
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
        {name && (
          <p className="mt-3 text-xs text-muted-foreground">
            Preview: <Badge className={tagColorClassName(color)}>{name}</Badge>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
