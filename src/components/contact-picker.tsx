"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Contact = { id: string; name: string };

function splitName(fullName: string) {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed, lastName: undefined };
  return {
    firstName: trimmed.slice(0, spaceIndex),
    lastName: trimmed.slice(spaceIndex + 1),
  };
}

/**
 * Searchable contact lookup, same pattern as AccountPicker — filters a
 * client-side list and supports creating a new contact inline when the
 * typed name doesn't match one that already exists, so picking a contact
 * for a new lead or opportunity never dead-ends on "that person isn't in
 * the system yet."
 */
export function ContactPicker({
  contacts,
  value,
  onChange,
  id = "contactId",
  label = "Contact",
}: {
  contacts: Contact[];
  value: string;
  onChange: (contactId: string) => void;
  id?: string;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [extraContacts, setExtraContacts] = useState<Contact[]>([]);
  const [creating, setCreating] = useState(false);

  const allContacts = useMemo(
    () => [...contacts, ...extraContacts],
    [contacts, extraContacts],
  );
  const selected = allContacts.find((c) => c.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allContacts.slice(0, 20);
    return allContacts
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [allContacts, query]);

  const trimmedQuery = query.trim();
  const hasExactMatch = allContacts.some(
    (c) => c.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );

  async function createContact() {
    if (!trimmedQuery || creating) return;
    setCreating(true);
    const { firstName, lastName } = splitName(trimmedQuery);
    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName, lastName }),
    });
    setCreating(false);
    if (!response.ok) return;
    const body = await response.json();
    const name = `${body.contact.firstName} ${body.contact.lastName ?? ""}`.trim();
    setExtraContacts((prev) => [...prev, { id: body.contact.id, name }]);
    onChange(body.contact.id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder="Search contacts…"
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
        <div className="bg-popover absolute top-full z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border py-1 shadow-md">
          {filtered.length === 0 && !trimmedQuery ? (
            <p className="px-3 py-1.5 text-sm text-muted-foreground">
              No matching contacts.
            </p>
          ) : (
            filtered.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(contact.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
              >
                {contact.name}
              </button>
            ))
          )}
          {trimmedQuery && !hasExactMatch && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={createContact}
              disabled={creating}
              className="text-primary hover:bg-muted w-full border-t border-border px-3 py-1.5 text-left text-sm font-medium disabled:opacity-50"
            >
              {creating ? "Creating…" : `+ Create "${trimmedQuery}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
