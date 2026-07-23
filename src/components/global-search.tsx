"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ResultGroup = { label: string; items: { id: string; label: string; sublabel?: string; href: string }[] };

const GROUP_LABELS: Record<string, string> = {
  contacts: "Contacts",
  accounts: "Accounts",
  leads: "Leads",
  opportunities: "Opportunities",
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayedGroups = query.trim().length < 2 ? [] : groups;
  const flatItems = displayedGroups.flatMap((g) => g.items);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) return;
      const data = await response.json();
      const nextGroups: ResultGroup[] = Object.entries(GROUP_LABELS)
        .map(([key, label]) => ({ label, items: data[key] ?? [] }))
        .filter((g) => g.items.length > 0);
      setGroups(nextGroups);
      setActiveIndex(-1);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function navigateTo(href: string) {
    setOpen(false);
    setQuery("");
    setGroups([]);
    router.push(href);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flatItems[activeIndex] ?? flatItems[0];
      if (item) navigateTo(item.href);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative w-full max-w-sm">
      <input
        type="search"
        placeholder="Search contacts, accounts, leads, opportunities…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        aria-label="Search"
        className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm shadow-xs dark:bg-input/30"
      />
      {open && displayedGroups.length > 0 && (
        <div className="absolute top-full left-0 z-20 mt-1 w-full max-h-96 overflow-y-auto rounded-md border border-border bg-white py-1 shadow-md dark:bg-input/30">
          {displayedGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => {
                const index = flatItems.indexOf(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => navigateTo(item.href)}
                    className={`block w-full px-3 py-1.5 text-left text-sm ${
                      index === activeIndex
                        ? "bg-accent"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="text-foreground">
                      {item.label}
                    </span>
                    {item.sublabel && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {item.sublabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {open && query.trim().length >= 2 && displayedGroups.length === 0 && (
        <div className="absolute top-full left-0 z-20 mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground shadow-md dark:bg-input/30">
          No matches.
        </div>
      )}
    </div>
  );
}
