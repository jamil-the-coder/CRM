"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Lead = { id: string; label: string };
type Slot = { startsAt: string; endsAt: string };

const selectClassName =
  "h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm shadow-xs dark:border-zinc-800 dark:bg-zinc-900";

export function NewBookingForm({
  leads,
  slots,
}: {
  leads: Lead[];
  slots: Slot[];
}) {
  const router = useRouter();
  const [leadId, setLeadId] = useState(leads[0]?.id ?? "");
  const [slotIndex, setSlotIndex] = useState(0);
  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const slot = slots[slotIndex];
    const response = await fetch("/api/call-bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        leadId: leadId || null,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        attendeeEmail,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Couldn't book that call.");
      setSubmitting(false);
      return;
    }

    setAttendeeEmail("");
    setSubmitting(false);
    router.refresh();
  }

  if (slots.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-zinc-500">
          No available slots right now.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="lead">Lead</Label>
            <select
              id="lead"
              className={selectClassName}
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
            >
              <option value="">(no lead)</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.label || lead.id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="slot">Slot</Label>
            <select
              id="slot"
              className={selectClassName}
              value={slotIndex}
              onChange={(e) => setSlotIndex(Number(e.target.value))}
            >
              {slots.map((slot, index) => (
                <option key={slot.startsAt} value={index}>
                  {new Date(slot.startsAt).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="attendeeEmail">Attendee email</Label>
            <Input
              id="attendeeEmail"
              type="email"
              required
              value={attendeeEmail}
              onChange={(e) => setAttendeeEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Booking…" : "Book call"}
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
