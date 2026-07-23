import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { NewTaskForm } from "./new-task-form";
import { TaskItem } from "./task-item";

export default async function TasksPage() {
  const user = await getCurrentUser();

  const tasks = await db.task.findMany({
    where: { tenantId: user!.tenantId, ownerUserId: user!.id },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  const open = tasks.filter((t) => t.status === "open");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          My Tasks
        </h1>
        <p className="text-sm text-zinc-500">
          To-dos assigned to you, standalone or linked to a record.
        </p>
      </div>

      <NewTaskForm />

      {open.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            No open tasks. Add one above to get started.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
            {open.map((task) => (
              <TaskItem
                key={task.id}
                task={{
                  ...task,
                  dueDate: task.dueDate?.toISOString() ?? null,
                }}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {done.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Done
          </h2>
          <Card>
            <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
              {done.map((task) => (
                <TaskItem
                  key={task.id}
                  task={{
                    ...task,
                    dueDate: task.dueDate?.toISOString() ?? null,
                  }}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
