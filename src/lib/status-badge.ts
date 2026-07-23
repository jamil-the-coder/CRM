/**
 * Reserved status-color mapping (Phase 34 UI consistency pass) — pipeline
 * stage / lead status "meaning" is shown with the same three colors
 * everywhere it appears (Kanban board, list rows, detail pages), instead of
 * every badge rendering the same flat gray regardless of what it says.
 * Mirrors the dataviz skill's status-palette rule: good/serious reserved,
 * never reused for an unrelated "series".
 */
export function stageBadgeVariant(
  stageKey: string,
): "success" | "destructive" | "secondary" {
  if (stageKey === "closed_won") return "success";
  if (stageKey === "closed_lost") return "destructive";
  return "secondary";
}

const POSITIVE_LEAD_STATUSES = new Set(["qualified", "converted"]);
const NEGATIVE_LEAD_STATUSES = new Set(["unqualified", "disqualified", "lost"]);

export function leadStatusBadgeVariant(
  status: string,
): "success" | "destructive" | "secondary" {
  if (POSITIVE_LEAD_STATUSES.has(status)) return "success";
  if (NEGATIVE_LEAD_STATUSES.has(status)) return "destructive";
  return "secondary";
}

export function quoteStatusBadgeVariant(
  status: string,
): "success" | "destructive" | "secondary" {
  if (status === "accepted") return "success";
  if (status === "declined") return "destructive";
  return "secondary";
}
