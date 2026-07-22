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
          <span className="w-24 shrink-0 truncate text-xs text-zinc-500">
            {row.label}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
            <div
              className="h-3 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-xs text-zinc-700 dark:text-zinc-300">
            {currencyFormatter.format(row.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
