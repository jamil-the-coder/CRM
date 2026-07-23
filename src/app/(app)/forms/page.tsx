import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { NewFormForm } from "./new-form-form";
import { EmbedSnippet } from "./embed-snippet";

export default async function FormsPage() {
  const user = await getCurrentUser();
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const origin = `${protocol}://${host}`;

  const forms = await db.form.findMany({
    where: { tenantId: user!.tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { submissions: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Forms
        </h1>
        <p className="text-sm text-muted-foreground">
          Embed a form on your website to capture leads straight into this CRM.
        </p>
      </div>

      <NewFormForm />

      {forms.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No forms yet. Create one above to get an embeddable snippet.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {forms.map((form) => (
            <Card key={form.id}>
              <CardContent className="flex flex-col gap-3 pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {form.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {form._count.submissions} submissions
                  </p>
                </div>
                <EmbedSnippet embedKey={form.embedKey} origin={origin} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
