const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function PipelineValueChart({
  data,
}: {
  data: { key: string; label: string; value: number; count: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex flex-col gap-2">
      {data.map((row) => (
        <div
          key={row.key}
          className="flex items-center gap-3"
          title={`${row.label}: ${currencyFormatter.format(row.value)} across ${row.count} deal(s)`}
        >
          <span className="text-muted-foreground w-24 shrink-0 truncate text-xs">
            {row.label}
          </span>
          <div className="bg-muted h-3 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-primary h-3 rounded-full"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
          <span className="text-foreground w-24 shrink-0 text-right text-xs tabular-nums">
            {currencyFormatter.format(row.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
