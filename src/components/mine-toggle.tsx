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
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-transparent text-muted-foreground hover:bg-muted/60"
      }`}
    >
      My records
    </button>
  );
}
