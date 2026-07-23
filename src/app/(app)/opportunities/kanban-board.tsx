"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type Stage = { key: string; label: string; isWon: boolean; isLost: boolean };

function stageAccentClass(stage: Stage) {
  if (stage.isWon) return "bg-emerald-500";
  if (stage.isLost) return "bg-destructive";
  return "bg-primary/40";
}
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
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const cards = opportunities.filter((o) => o.stage === stage.key);
          return (
            <div
              key={stage.key}
              data-stage-key={stage.key}
              className={`flex w-64 shrink-0 flex-col gap-2 overflow-hidden rounded-lg border pb-2 transition-colors ${
                dragOverKey === stage.key
                  ? "border-primary/40 bg-accent"
                  : "border-border bg-muted/40"
              }`}
            >
              <div className={`h-1 shrink-0 ${stageAccentClass(stage)}`} />
              <div className="flex items-center justify-between px-3">
                <p className="text-foreground/80 text-sm font-semibold">
                  {stage.label}
                </p>
                <Badge variant="secondary">{cards.length}</Badge>
              </div>
              <div className="flex flex-col gap-2 px-2">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    onMouseDown={() => handleCardMouseDown(card.id)}
                    className={`bg-card border-border cursor-grab rounded-md border p-3 shadow-sm transition-shadow select-none hover:shadow-md active:cursor-grabbing ${
                      draggingId === card.id ? "opacity-50" : ""
                    }`}
                  >
                    <Link
                      href={`/opportunities/${card.id}`}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="text-foreground hover:text-primary text-sm font-medium transition-colors"
                    >
                      {card.name}
                    </Link>
                    <p className="text-muted-foreground text-xs tabular-nums">
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
