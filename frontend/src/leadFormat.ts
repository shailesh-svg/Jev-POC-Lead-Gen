import type { LeadBatch } from "./leadTypes";

/** Limits the server enforces, mirrored here so the box says so before a request. */
export const MAX_BATCH = 10;
export const MAX_LEAD_CHARACTERS = 20000;
export const MIN_LEAD_CHARACTERS = 20;
/** One box holds a queue, so it holds a full-length lead per batch slot. */
export const MAX_BOX_CHARACTERS = MAX_BATCH * MAX_LEAD_CHARACTERS;

/** A line of three or more dashes starts the next lead in the box. */
const SEPARATOR = /^\s*-{3,}\s*$/m;

/** Why the Score button is disabled, or "" when the queue is ready to send. */
export function scoreBlocker({
  configured,
  hasProfile,
  leads,
}: {
  configured: boolean;
  hasProfile: boolean;
  leads: string[];
}) {
  if (!configured) return "";
  if (!hasProfile) return "Choose or create an ICP profile before scoring.";
  if (!leads.length || leads.some((l) => l.length < MIN_LEAD_CHARACTERS))
    return `Every lead needs at least ${MIN_LEAD_CHARACTERS} characters.`;
  if (leads.some((l) => l.length > MAX_LEAD_CHARACTERS))
    return `Keep each lead under ${MAX_LEAD_CHARACTERS.toLocaleString()} characters.`;
  if (leads.length > MAX_BATCH)
    return `Score at most ${MAX_BATCH} leads at a time. This box holds ${leads.length}.`;
  return "";
}

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
