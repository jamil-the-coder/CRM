"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm shadow-xs dark:border-zinc-800 dark:bg-zinc-900";

type Opportunity = { id: string; name: string };
type Product = { id: string; name: string; unitPrice: string };
type Line = {
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

const emptyLine: Line = { productId: "", description: "", quantity: "1", unitPrice: "" };

export function NewQuoteForm({
  opportunities,
  products,
}: {
  opportunities: Opportunity[];
  products: Product[];
}) {
  const router = useRouter();
  const [opportunityId, setOpportunityId] = useState(opportunities[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function pickProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateLine(index, {
      productId,
      description: product?.name ?? "",
      unitPrice: product?.unitPrice ?? "",
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        opportunityId,
        lines: lines.map((line) => ({
          productId: line.productId || undefined,
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Couldn't create that quote.");
      setSubmitting(false);
      return;
    }

    const { quote } = await response.json();
    setSubmitting(false);
    router.push(`/quotes/${quote.id}`);
  }

  if (opportunities.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-zinc-500">
          Create an opportunity first — quotes are tied to one.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="opportunityId">Opportunity</Label>
            <select
              id="opportunityId"
              className={selectClassName}
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
            >
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            {lines.map((line, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Product</Label>
                  <select
                    className={selectClassName}
                    value={line.productId}
                    onChange={(e) => pickProduct(index, e.target.value)}
                  >
                    <option value="">Custom line</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    required
                    value={line.description}
                    onChange={(e) =>
                      updateLine(index, { description: e.target.value })
                    }
                  />
                </div>
                <div className="flex w-20 flex-col gap-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                  />
                </div>
                <div className="flex w-28 flex-col gap-1">
                  <Label className="text-xs">Unit price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setLines((prev) => prev.filter((_, i) => i !== index))
                  }
                  disabled={lines.length === 1}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setLines((prev) => [...prev, { ...emptyLine }])}
            >
              + Add line
            </Button>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create quote"}
            </Button>
          </div>
        </form>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
