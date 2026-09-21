import type { LeadBatch } from "./leadTypes";

/** Limits the server enforces, mirrored here so the box says so before a request. */
export const MAX_BATCH = 25;
export const MAX_LEAD_CHARACTERS = 20000;
export const MIN_LEAD_CHARACTERS = 20;
/** One box holds a queue, so it holds a full-length lead per batch slot. */
export const MAX_BOX_CHARACTERS = MAX_BATCH * MAX_LEAD_CHARACTERS;

export const readable = (route: string) => route.replace(/_/g, " ");

/**
 * A line of three or more dashes still separates leads for anyone who types
 * them, though leadParse works without any marker at all.
 */
const SEPARATOR = /^\s*-{3,}\s*$/m;

export function splitLeads(text: string) {
  return text
    .split(SEPARATOR)
    .map((lead) => lead.trim())
    .filter(Boolean);
}

/** Why one lead cannot be sent, or "" when it is fine. */
export function leadIssue(text: string) {
  const length = text.trim().length;
  if (length === 0) return "Empty";
  if (length < MIN_LEAD_CHARACTERS)
    return `Too short to score, needs ${MIN_LEAD_CHARACTERS} characters`;
  if (length > MAX_LEAD_CHARACTERS)
    return `Too long to score, limit is ${MAX_LEAD_CHARACTERS.toLocaleString()} characters`;
  return "";
}

/** First line of a lead, short enough to sit in a queue row. */
export function leadLabel(text: string, index: number) {
  const first = text.trim().split("\n")[0].trim();
  if (!first) return `Lead ${index + 1}`;
  return first.length > 70 ? first.slice(0, 69) + "…" : first;
}

const CSV_COLUMNS = [
  "rank",
  "lead",
  "priority",
  "tier",
  "icp_fit",
  "industry_fit",
  "company_maturity",
  "purchase_intent",
  "route",
  "route_confidence",
  "needs_review",
  "error",
];

const cell = (value: string | number | boolean) =>
  `"${String(value).replace(/"/g, '""')}"`;

export function toCsv(batch: LeadBatch, texts: string[]) {
  const rows = batch.leads.map((lead, rank) => {
    const r = lead.result;
    return [
      rank + 1,
      leadLabel(texts[lead.index] || "", lead.index),
      r?.priority ?? "",
      r?.tier ?? "",
      r?.icp_fit ?? "",
      r?.industry_fit.level ?? "",
      r?.company_maturity.level ?? "",
      r?.purchase_intent.level ?? "",
      r ? readable(r.route) : "",
      r?.route_confidence ?? "",
      r ? r.needs_review : "",
      lead.error ?? "",
    ].map(cell);
  });
  return [CSV_COLUMNS.map(cell), ...rows]
    .map((row) => row.join(","))
    .join("\n");
}

export function downloadCsv(batch: LeadBatch, texts: string[]) {
  const blob = new Blob([toCsv(batch, texts)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lead-scores-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
