"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountPicker } from "@/components/account-picker";
import {
  CustomFieldsInputs,
  type CustomFieldDefinition,
} from "@/components/custom-fields-inputs";

const selectClassName =
  "h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm shadow-xs dark:border-zinc-800 dark:bg-zinc-900";

export function NewContactForm({
  accounts,
  users,
  customFieldDefinitions,
}: {
  accounts: { id: string; name: string }[];
  users: { id: string; email: string }[];
  customFieldDefinitions: CustomFieldDefinition[];
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [accountId, setAccountId] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName,
        email: email || undefined,
        company: company || undefined,
        accountId: accountId || undefined,
        ownerUserId: ownerUserId || undefined,
        customFields:
          Object.keys(customFields).length > 0 ? customFields : undefined,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Couldn't create that contact.");
      setSubmitting(false);
      return;
    }

    setFirstName("");
    setEmail("");
    setCompany("");
    setAccountId("");
    setOwnerUserId("");
    setCustomFields({});
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Card className="overflow-visible">
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="firstName">Name</Label>
            <Input
              id="firstName"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <AccountPicker
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ownerUserId">Owner</Label>
            <select
              id="ownerUserId"
              className={selectClassName}
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </div>
          <CustomFieldsInputs
            definitions={customFieldDefinitions}
            values={customFields}
            onChange={(key, value) =>
              setCustomFields((prev) => ({ ...prev, [key]: value }))
            }
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add contact"}
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
