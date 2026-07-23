"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function MineToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mine = searchParams.get("mine") === "1";

  function toggle() {
    const params = new URLSearchParams(searchParams);
    if (mine) {
      params.delete("mine");
    } else {
      params.set("mine", "1");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={mine}
      className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
        mine
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 bg-transparent text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
      }`}
    >
      My records
    </button>
  );
}
