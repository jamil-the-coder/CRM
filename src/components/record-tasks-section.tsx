"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
};

export function RecordTasksSection({
  entityType,
  entityId,
  tasks,
}: {
  entityType: "contact" | "account" | "lead" | "opportunity";
  entityId: string;
  tasks: Task[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, entityType, entityId }),
    });
    setTitle("");
    setSubmitting(false);
    router.refresh();
  }

  async function toggleDone(task: Task) {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: task.status === "done" ? "open" : "done" }),
    });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <p className="text-sm font-medium text-foreground">
          Tasks
        </p>
        <form onSubmit={handleAdd} className="flex items-end gap-2">
          <Input
            required
            placeholder="Add a task…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add"}
          </Button>
        </form>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks linked yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {tasks.map((task) => {
              const isOverdue =
                task.status === "open" &&
                task.dueDate &&
                new Date(task.dueDate) < new Date();
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleDone(task)}
                    aria-label={
                      task.status === "done" ? "Mark as open" : "Mark as done"
                    }
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                      task.status === "done"
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-input"
                    }`}
                  >
                    {task.status === "done" ? "✓" : ""}
                  </button>
                  <span
                    className={
                      task.status === "done"
                        ? "text-muted-foreground line-through dark:text-muted-foreground"
                        : "text-foreground"
                    }
                  >
                    {task.title}
                  </span>
                  {task.dueDate && (
                    <span
                      className={`ml-auto text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
