/**
 * Fixed categorical palette for tag chips, defined once and reused everywhere
 * a tag renders (list rows, filters, the tags settings page) — per the UI
 * bar's "colour must mean something consistently" rule. Never generate a
 * color from a hash; a tag's color is always one of these six, chosen at
 * creation time.
 */
export const TAG_COLOR_CLASSNAMES: Record<string, string> = {
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  emerald:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

export function tagColorClassName(color: string): string {
  return TAG_COLOR_CLASSNAMES[color] ?? TAG_COLOR_CLASSNAMES.zinc;
}
