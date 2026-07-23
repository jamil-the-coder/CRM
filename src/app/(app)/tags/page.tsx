import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NewTagForm } from "./new-tag-form";
import { DeleteTagButton } from "./delete-tag-button";
import { tagColorClassName } from "@/lib/tag-colors";

export default async function TagsPage() {
  const user = await getCurrentUser();
  const tags = await db.tag.findMany({
    where: { tenantId: user!.tenantId },
    orderBy: { name: "asc" },
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Tags
        </h1>
        <p className="text-sm text-muted-foreground">
          Flexible labels you can attach to Contacts, Accounts, Leads, and
          Opportunities — filterable in list views.
        </p>
      </div>

      <NewTagForm />

      {tags.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No tags yet. Add one above to get started.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0 dark:divide-border">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <Badge className={tagColorClassName(tag.color)}>
                  {tag.name}
                </Badge>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {tag._count.assignments} record
                    {tag._count.assignments === 1 ? "" : "s"}
                  </span>
                  <DeleteTagButton id={tag.id} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
