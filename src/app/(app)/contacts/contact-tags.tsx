"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { tagColorClassName } from "@/lib/tag-colors";

type Tag = { id: string; name: string; color: string };

export function ContactTags({
  contactId,
  assignedTags,
  allTags,
}: {
  contactId: string;
  assignedTags: Tag[];
  allTags: Tag[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const available = allTags.filter(
    (t) => !assignedTags.some((assigned) => assigned.id === t.id),
  );

  async function assign(tagId: string) {
    setBusy(true);
    await fetch("/api/tag-assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tagId, entityType: "contact", entityId: contactId }),
    });
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  async function unassign(tagId: string) {
    setBusy(true);
    await fetch(
      `/api/tag-assignments?tagId=${tagId}&entityId=${contactId}`,
      { method: "DELETE" },
    );
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="relative flex flex-wrap items-center justify-end gap-1">
      {assignedTags.map((tag) => (
        <Badge
          key={tag.id}
          className={`${tagColorClassName(tag.color)} cursor-pointer`}
          onClick={() => !busy && unassign(tag.id)}
          title="Click to remove"
        >
          {tag.name}
        </Badge>
      ))}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted"
        aria-label="Add tag"
      >
        +
      </button>
      {open && (
        <div className="absolute top-full right-0 z-10 mt-1 w-40 rounded-md border border-border bg-white py-1 shadow-md dark:bg-input/30">
          {available.length === 0 ? (
            <p className="px-3 py-1.5 text-xs text-muted-foreground">
              No more tags to add.
            </p>
          ) : (
            available.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => assign(tag.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
              >
                <Badge className={tagColorClassName(tag.color)}>
                  {tag.name}
                </Badge>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
