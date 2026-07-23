"use client";

import { useRouter, useSearchParams } from "next/navigation";

const selectClassName =
  "h-9 rounded-md border border-border bg-transparent px-3 text-sm shadow-xs dark:bg-input/30";

export function TagFilter({
  tags,
}: {
  tags: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTagId = searchParams.get("tagId") ?? "";

  if (tags.length === 0) return null;

  return (
    <select
      className={selectClassName}
      value={currentTagId}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams);
        if (e.target.value) {
          params.set("tagId", e.target.value);
        } else {
          params.delete("tagId");
        }
        const query = params.toString();
        router.push(query ? `/contacts?${query}` : "/contacts");
      }}
      aria-label="Filter by tag"
    >
      <option value="">All tags</option>
      {tags.map((tag) => (
        <option key={tag.id} value={tag.id}>
          {tag.name}
        </option>
      ))}
    </select>
  );
}
