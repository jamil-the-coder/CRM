export function TimeSeriesChart({
  data,
}: {
  data: { date: string; leadsCreated: number; dealsClosed: number }[];
}) {
  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.leadsCreated, d.dealsClosed)),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="text-muted-foreground flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: "#2a78d6" }}
          />
          Leads created
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: "#eb6834" }}
          />
          Deals closed
        </span>
      </div>
      <div className="flex h-32 gap-1.5">
        {data.map((day) => (
          <div
            key={day.date}
            className="flex h-full flex-1 items-end gap-0.5"
            title={`${day.date}: ${day.leadsCreated} lead(s), ${day.dealsClosed} deal(s) closed`}
          >
            <div
              className="flex-1 rounded-t-sm"
              style={{
                height: `${Math.max((day.leadsCreated / max) * 100, day.leadsCreated > 0 ? 4 : 0)}%`,
                backgroundColor: "#2a78d6",
              }}
            />
            <div
              className="flex-1 rounded-t-sm"
              style={{
                height: `${Math.max((day.dealsClosed / max) * 100, day.dealsClosed > 0 ? 4 : 0)}%`,
                backgroundColor: "#eb6834",
              }}
            />
          </div>
        ))}
      </div>
      <div className="text-muted-foreground flex justify-between text-[10px]">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}
