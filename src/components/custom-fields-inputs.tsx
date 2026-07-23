import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm shadow-xs dark:border-zinc-800 dark:bg-zinc-900";

export type CustomFieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: string;
  options: unknown;
};

/** Renders one input per tenant-defined custom field, for use inside a create/edit form. */
export function CustomFieldsInputs({
  definitions,
  values,
  onChange,
}: {
  definitions: CustomFieldDefinition[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (definitions.length === 0) return null;

  return (
    <>
      {definitions.map((def) => {
        const id = `custom-${def.key}`;
        if (def.type === "select") {
          const options = Array.isArray(def.options) ? (def.options as string[]) : [];
          return (
            <div key={def.id} className="flex flex-1 flex-col gap-2">
              <Label htmlFor={id}>{def.label}</Label>
              <select
                id={id}
                className={selectClassName}
                value={values[def.key] ?? ""}
                onChange={(e) => onChange(def.key, e.target.value)}
              >
                <option value="">—</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        return (
          <div key={def.id} className="flex flex-1 flex-col gap-2">
            <Label htmlFor={id}>{def.label}</Label>
            <Input
              id={id}
              type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
              value={values[def.key] ?? ""}
              onChange={(e) => onChange(def.key, e.target.value)}
            />
          </div>
        );
      })}
    </>
  );
}
