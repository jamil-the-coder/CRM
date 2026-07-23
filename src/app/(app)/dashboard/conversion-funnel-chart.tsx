export function ConversionFunnelChart({
  data,
}: {
  data: {
    key: string;
    label: string;
    reached: number;
    conversionRate: number;
  }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {data.map((row) => (
        <div
          key={row.key}
          className="flex items-center gap-3"
          title={`${row.label}: ${row.reached} opportunit${row.reached === 1 ? "y" : "ies"} reached this stage (${row.conversionRate}% of the first stage)`}
        >
          <span className="text-muted-foreground w-24 shrink-0 truncate text-xs">
            {row.label}
          </span>
          <div className="bg-muted h-3 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-primary/45 h-3 rounded-full"
              style={{
                width: `${Math.max(row.conversionRate, row.reached > 0 ? 2 : 0)}%`,
              }}
            />
          </div>
          <span className="text-foreground w-16 shrink-0 text-right text-xs tabular-nums">
            {row.conversionRate}%
          </span>
        </div>
      ))}
    </div>
  );
}
