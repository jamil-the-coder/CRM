"use client";

import { useRouter, useSearchParams } from "next/navigation";

const selectClassName =
  "h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm shadow-xs dark:border-zinc-800 dark:bg-zinc-900";

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
        const value = e.target.value;
        router.push(value ? `/contacts?tagId=${value}` : "/contacts");
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
