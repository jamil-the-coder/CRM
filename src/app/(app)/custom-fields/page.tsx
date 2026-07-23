import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NewFieldForm } from "./new-field-form";
import { DeleteFieldButton } from "./delete-field-button";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  contact: "Contact",
  account: "Account",
  opportunity: "Opportunity",
};

export default async function CustomFieldsPage() {
  const user = await getCurrentUser();
  const fields = await db.customFieldDefinition.findMany({
    where: { tenantId: user!.tenantId },
    orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }],
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Custom Fields
        </h1>
        <p className="text-sm text-zinc-500">
          Add extra fields to Contacts, Accounts, and Opportunities to match
          how your business works — no code change needed.
        </p>
      </div>

      <NewFieldForm />

      {fields.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            No custom fields yet. Add one above to get started.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
            {fields.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {field.label}{" "}
                    <span className="font-normal text-zinc-500">
                      ({field.key})
                    </span>
                  </p>
                  <p className="text-xs text-zinc-500">{field.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {ENTITY_TYPE_LABELS[field.entityType] ?? field.entityType}
                  </Badge>
                  <DeleteFieldButton id={field.id} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
