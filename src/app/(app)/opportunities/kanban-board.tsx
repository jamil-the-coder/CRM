"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type Stage = { key: string; label: string; isWon: boolean; isLost: boolean };
type Opportunity = {
  id: string;
  name: string;
  stage: string;
  value: string;
  currency: string;
  contactName: string;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function KanbanBoard({
  stages,
  opportunities,
}: {
  stages: Stage[];
  opportunities: Opportunity[];
}) {
  const router = useRouter();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  function handleCardMouseDown(opportunityId: string) {
    draggingIdRef.current = opportunityId;
    setDraggingId(opportunityId);

    function handleMouseMove(event: MouseEvent) {
      const el = document.elementFromPoint(event.clientX, event.clientY);
      const column = el?.closest<HTMLElement>("[data-stage-key]");
      setDragOverKey(column?.dataset.stageKey ?? null);
    }

    async function handleMouseUp(event: MouseEvent) {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const el = document.elementFromPoint(event.clientX, event.clientY);
      const column = el?.closest<HTMLElement>("[data-stage-key]");
      const targetStage = column?.dataset.stageKey;
      const opportunity = opportunities.find(
        (o) => o.id === draggingIdRef.current,
      );

      setDraggingId(null);
      setDragOverKey(null);
      draggingIdRef.current = null;

      if (!targetStage || !opportunity || targetStage === opportunity.stage)
        return;

      const response = await fetch(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage: targetStage }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Couldn't move that opportunity.");
        return;
      }
      setError(null);
      router.refresh();
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const cards = opportunities.filter((o) => o.stage === stage.key);
          return (
            <div
              key={stage.key}
              data-stage-key={stage.key}
              className={`flex w-64 shrink-0 flex-col gap-2 rounded-lg border p-2 transition-colors ${
                dragOverKey === stage.key
                  ? "border-zinc-400 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900"
                  : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
              }`}
            >
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {stage.label}
                </p>
                <Badge variant="secondary">{cards.length}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    onMouseDown={() => handleCardMouseDown(card.id)}
                    className={`cursor-grab rounded-md border border-zinc-200 bg-white p-3 shadow-sm select-none active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-900 ${
                      draggingId === card.id ? "opacity-50" : ""
                    }`}
                  >
                    <Link
                      href={`/opportunities/${card.id}`}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {card.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {card.contactName} ·{" "}
                      {currencyFormatter.format(Number(card.value))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
