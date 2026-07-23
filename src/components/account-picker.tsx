"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Account = { id: string; name: string };

/**
 * A lightweight searchable picker — no combobox/select primitive exists in
 * this project's component set yet, and pulling one in for a single field
 * was judged more than this needed. Filters a client-side list (accounts
 * fetched once by the parent) rather than hitting the API per keystroke,
 * since a tenant's account list is expected to stay small.
 */
export function AccountPicker({
  accounts,
  value,
  onChange,
  id = "accountId",
  label = "Account",
}: {
  accounts: Account[];
  value: string;
  onChange: (accountId: string) => void;
  id?: string;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = accounts.find((a) => a.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts.slice(0, 20);
    return accounts
      .filter((a) => a.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [accounts, query]);

  return (
    <div className="relative flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder="Search accounts…"
        value={open ? query : (selected?.name ?? "")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && (
        <div className="absolute top-full z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          {value && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange("");
                setQuery("");
                setOpen(false);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              No account
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="px-3 py-1.5 text-sm text-zinc-500">
              No matching accounts.
            </p>
          ) : (
            filtered.map((account) => (
              <button
                key={account.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(account.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                {account.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
