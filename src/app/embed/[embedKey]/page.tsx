import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { FormField } from "@/lib/forms";
import { EmbedForm } from "./embed-form";

export default async function EmbedFormPage({
  params,
}: {
  params: Promise<{ embedKey: string }>;
}) {
  const { embedKey } = await params;
  const form = await db.form.findUnique({
    where: { embedKey },
    select: { name: true, fields: true },
  });

  if (!form) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-lg font-semibold text-zinc-900">
          {form.name}
        </h1>
        <EmbedForm embedKey={embedKey} fields={form.fields as FormField[]} />
      </div>
    </div>
  );
}
