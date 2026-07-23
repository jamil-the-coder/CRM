"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  entityType: string | null;
  entityId: string | null;
};

const ENTITY_PATHS: Record<string, string> = {
  contact: "/contacts",
  account: "/accounts",
  lead: "/leads",
  opportunity: "/opportunities",
};

export function TaskItem({ task }: { task: Task }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const isOverdue =
    task.status === "open" && task.dueDate && new Date(task.dueDate) < new Date();

  async function toggleDone() {
    setBusy(true);
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: task.status === "done" ? "open" : "done" }),
    });
    setBusy(false);
    router.refresh();
  }

  const linkPath =
    task.entityType && task.entityId
      ? `${ENTITY_PATHS[task.entityType]}/${task.entityId}`
      : null;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleDone}
          disabled={busy}
          aria-label={task.status === "done" ? "Mark as open" : "Mark as done"}
          className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${
            task.status === "done"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-input"
          }`}
        >
          {task.status === "done" ? "✓" : ""}
        </button>
        <div>
          <p
            className={`text-sm font-medium ${
              task.status === "done"
                ? "text-muted-foreground line-through dark:text-muted-foreground"
                : "text-foreground"
            }`}
          >
            {task.title}
          </p>
          {linkPath && (
            <a href={linkPath} className="text-xs text-muted-foreground hover:underline">
              View record
            </a>
          )}
        </div>
      </div>
      {task.dueDate && (
        <Badge variant={isOverdue ? "destructive" : "secondary"}>
          {isOverdue ? "Overdue: " : "Due "}
          {new Date(task.dueDate).toLocaleDateString()}
        </Badge>
      )}
    </div>
  );
}
