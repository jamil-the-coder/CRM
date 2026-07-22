// Fixed categorical hue order (never cycled/reassigned per filter) — first
// four slots of the validated default palette are enough for typical lead
// source counts; a 5th+ distinct source would ideally fold into "Other".
const CATEGORICAL_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#4a3aa7",
  "#e34948",
];

export function LeadSourceChart({
  data,
}: {
  data: { source: string; count: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex flex-col gap-2">
      {data.map((row, index) => {
        const color = CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length];
        return (
          <div
            key={row.source}
            className="flex items-center gap-3"
            title={`${row.source}: ${row.count} lead(s) (${total === 0 ? 0 : Math.round((row.count / total) * 100)}%)`}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="w-28 shrink-0 truncate text-xs text-zinc-500">
              {row.source}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
              <div
                className="h-3 rounded-full"
                style={{
                  width: `${(row.count / max) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs text-zinc-700 dark:text-zinc-300">
              {row.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
