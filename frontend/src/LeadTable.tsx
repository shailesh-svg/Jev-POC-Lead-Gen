import { useEffect } from "react";
import { ChevronDown, Download, TriangleAlert, X } from "lucide-react";
import { LeadResultDetail } from "./LeadResult";
import { downloadCsv, leadLabel, readable } from "./leadFormat";
import type { LeadBatch, ScoredLead } from "./leadTypes";

type Filter = "all" | "hot" | "warm" | "cold" | "out" | "flagged";

const matches = (lead: ScoredLead, filter: Filter) => {
  const r = lead.result;
  if (filter === "all") return true;
  if (!r) return filter === "flagged";
  if (filter === "out") return !!r.disqualified;
  if (filter === "flagged") return r.needs_review;
  return !r.disqualified && r.tier.toLowerCase() === filter;
};

const tierClass = (lead: ScoredLead) =>
  !lead.result
    ? "tier-out"
    : lead.result.disqualified
      ? "tier-out"
      : "tier-" + lead.result.tier.toLowerCase();

const tierLabel = (lead: ScoredLead) =>
  !lead.result
    ? "Failed"
    : lead.result.disqualified
      ? "Disqualified"
      : lead.result.tier;

export function LeadTable({
  batch,
  texts,
  filter,
  onFilter,
  openId,
  onOpen,
}: {
  batch: LeadBatch;
  texts: string[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  openId: number | null;
  onOpen: (index: number | null) => void;
}) {
  const shown = batch.leads.filter((lead) => matches(lead, filter));
  const counts = {
    hot: batch.leads.filter((l) => matches(l, "hot")).length,
    warm: batch.leads.filter((l) => matches(l, "warm")).length,
    cold: batch.leads.filter((l) => matches(l, "cold")).length,
    out: batch.leads.filter((l) => matches(l, "out")).length,
    flagged: batch.leads.filter((l) => matches(l, "flagged")).length,
  };
  const open = batch.leads.find((l) => l.index === openId) || null;

  // Arrow keys move through the queue while a lead is open.
  useEffect(() => {
    if (!open) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onOpen(null);
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const at = shown.findIndex((l) => l.index === open.index);
      const next = shown[at + (event.key === "ArrowDown" ? 1 : -1)];
      if (next) onOpen(next.index);
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, shown, onOpen]);

  const chips: [Filter, string, number][] = [
    ["all", "All", batch.leads.length],
    ["hot", "Hot", counts.hot],
    ["warm", "Warm", counts.warm],
    ["cold", "Cold", counts.cold],
    ["out", "Disqualified", counts.out],
    ["flagged", "Needs review", counts.flagged],
  ];

  return (
    <div className="queue">
      <div className="queue-summary">
        <span>
          <b>{batch.scored}</b> scored
          {batch.failed > 0 && (
            <>
              {" · "}
              <b>{batch.failed}</b> failed
            </>
          )}
          {counts.out > 0 && (
            <>
              {" · "}
              <b>{counts.out}</b> disqualified
            </>
          )}
          {counts.flagged > 0 && (
            <>
              {" · "}
              <b>{counts.flagged}</b> to check
            </>
          )}
        </span>
        <button className="secondary" onClick={() => downloadCsv(batch, texts)}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="queue-filters">
        {chips.map(([id, label, count]) => (
          <button
            key={id}
            className={"chip" + (filter === id ? " on" : "")}
            aria-pressed={filter === id}
            disabled={count === 0 && id !== "all"}
            onClick={() => onFilter(id)}
          >
            {label} <span>{count}</span>
          </button>
        ))}
      </div>

      <table className="queue-table">
        <thead>
          <tr>
            <th className="col-rank">#</th>
            <th>Lead</th>
            <th className="col-tier">Tier</th>
            <th className="col-score">Priority</th>
            <th className="col-route">Route</th>
            <th className="col-intent">Intent</th>
            <th aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {shown.map((lead) => (
            <tr
              key={lead.index}
              className={
                (openId === lead.index ? "open " : "") +
                (lead.result?.disqualified ? "muted" : "")
              }
              onClick={() => onOpen(openId === lead.index ? null : lead.index)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(lead.index);
                }
              }}
            >
              <td className="col-rank">{batch.leads.indexOf(lead) + 1}</td>
              <td className="col-lead">
                {leadLabel(texts[lead.index] || "", lead.index)}
                {lead.result?.needs_review && (
                  <TriangleAlert
                    size={13}
                    className="queue-flag"
                    aria-label="Needs review"
                  />
                )}
              </td>
              <td className="col-tier">
                <span className={"badge " + tierClass(lead)}>
                  {tierLabel(lead)}
                </span>
              </td>
              <td className="col-score">
                {lead.result ? lead.result.priority : "—"}
              </td>
              <td className="col-route">
                {lead.result ? readable(lead.result.route) : lead.error}
              </td>
              <td className="col-intent">
                {lead.result ? lead.result.purchase_intent.level : "—"}
              </td>
              <td className="col-open">
                <ChevronDown size={14} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {open && (
        <aside className="drawer" aria-label="Lead detail">
          <header>
            <div>
              <span className="eyebrow">
                LEAD {batch.leads.indexOf(open) + 1} OF {batch.leads.length}
              </span>
              <h3>{leadLabel(texts[open.index] || "", open.index)}</h3>
            </div>
            <button aria-label="Close lead detail" onClick={() => onOpen(null)}>
              <X size={18} />
            </button>
          </header>
          <div className="drawer-body">
            {open.result ? (
              <LeadResultDetail result={open.result} />
            ) : (
              <div className="alert error" role="alert">
                {open.error}
              </div>
            )}
          </div>
          <footer>Use ↑ and ↓ to move through the queue, Esc to close.</footer>
        </aside>
      )}
    </div>
  );
}
