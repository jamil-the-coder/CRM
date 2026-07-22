"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HONEYPOT_FIELD_NAME, type FormField } from "@/lib/forms";

const INPUT_TYPES: Record<FormField["name"], string> = {
  firstName: "text",
  lastName: "text",
  email: "email",
  phone: "tel",
  company: "text",
};

export function EmbedForm({
  embedKey,
  fields,
}: {
  embedKey: string;
  fields: FormField[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/public/forms/${embedKey}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    setStatus("success");
    setSubmitting(false);
  }

  if (status === "success") {
    return (
      <p className="text-sm text-zinc-700">
        Thanks — we&apos;ll be in touch shortly.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {fields.map((field) => (
        <div key={field.name} className="flex flex-col gap-2">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required ? " *" : ""}
          </Label>
          <Input
            id={field.name}
            type={INPUT_TYPES[field.name]}
            required={field.required}
            value={values[field.name] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
            }
          />
        </div>
      ))}

      {/* Honeypot: hidden from real visitors, only automated fillers see/populate it. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", opacity: 0 }}
      >
        <label htmlFor={HONEYPOT_FIELD_NAME}>Leave this field blank</label>
        <input
          id={HONEYPOT_FIELD_NAME}
          name={HONEYPOT_FIELD_NAME}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values[HONEYPOT_FIELD_NAME] ?? ""}
          onChange={(e) =>
            setValues((prev) => ({
              ...prev,
              [HONEYPOT_FIELD_NAME]: e.target.value,
            }))
          }
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Submit"}
      </Button>
    </form>
  );
}
