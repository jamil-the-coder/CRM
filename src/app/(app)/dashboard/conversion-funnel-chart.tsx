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
          <span className="w-24 shrink-0 truncate text-xs text-zinc-500">
            {row.label}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
            <div
              className="h-3 rounded-full bg-[#86b6ef] dark:bg-[#184f95]"
              style={{
                width: `${Math.max(row.conversionRate, row.reached > 0 ? 2 : 0)}%`,
              }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs text-zinc-700 dark:text-zinc-300">
            {row.conversionRate}%
          </span>
        </div>
      ))}
    </div>
  );
}
