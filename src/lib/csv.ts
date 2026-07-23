function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(escapeCsvCell).join(",");
  const lines = rows.map((row) => columns.map((col) => escapeCsvCell(row[col])).join(","));
  return [header, ...lines].join("\r\n");
}
