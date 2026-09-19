import type { LeadBatch } from "./leadTypes";

/** A line of three or more dashes starts the next lead in the box. */
const SEPARATOR = /^\s*-{3,}\s*$/m;

export const readable = (route: string) => route.replace(/_/g, " ");

export function splitLeads(text: string) {
  return text
    .split(SEPARATOR)
    .map((lead) => lead.trim())
    .filter(Boolean);
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
