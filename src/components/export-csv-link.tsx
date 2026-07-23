import { buttonVariants } from "@/components/ui/button";

export function ExportCsvLink({ entity }: { entity: string }) {
  return (
    <a
      href={`/api/export/${entity}`}
      className={buttonVariants({ variant: "outline" })}
    >
      Export CSV
    </a>
  );
}
