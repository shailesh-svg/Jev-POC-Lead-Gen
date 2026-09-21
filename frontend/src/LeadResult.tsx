import { ArrowRight, ChevronDown, Download, TriangleAlert } from "lucide-react";
import { RequestDetails } from "./PromptDetails";
import { leadLabel, readable, toCsv } from "./leadFormat";
import type { LeadBatch, LeadResult, LevelResult } from "./leadTypes";

export function LeadResultDetail({
  result,
  onReset,
}: {
  result: LeadResult;
  onReset?: () => void;
}) {
  return (
    <>
      <RequestDetails requests={result.requests} />
      {result.needs_review && (
        <div className="alert warning" role="status">
          <span>
            <TriangleAlert size={14} /> Check this lead before acting on it
            {result.review_reasons?.length
              ? ` — ${result.review_reasons.join(", ")}.`
              : ": the model was not confident."}
          </span>
        </div>
      )}
      <div className="score-top">
        <div
          className="score-ring"
          style={{ "--score": result.priority + "%" } as React.CSSProperties}
        >
          <div>
            <strong>
              {result.priority}
              <small>/100</small>
            </strong>
            <span>Priority</span>
          </div>
        </div>
        <div>
          <span
            className={
              "badge " +
              (result.disqualified
                ? "tier-out"
                : "tier-" + result.tier.toLowerCase())
            }
          >
            {result.disqualified ? "Disqualified" : `${result.tier} lead`}
          </span>
          <h3>{result.profile_name}</h3>
          <p>
            ICP fit {result.icp_fit}% · Route: {readable(result.route)}
            {result.disqualified &&
              " · scored on fit, then ruled out by routing"}
          </p>
        </div>
      </div>
      <div className="level-grid">
        {(
          [
            ["Industry fit", result.industry_fit],
            ["Company maturity", result.company_maturity],
            ["Purchase intent", result.purchase_intent],
          ] as [string, LevelResult][]
        ).map(([label, lvl]) => (
          <div className="level-card" key={label}>
            <span className="small-pill">{label}</span>
            <b>{lvl.level}</b>
            <div className="score-caption">
              <span>Model confidence</span>
              <b>{Math.round(lvl.confidence * 100)}%</b>
            </div>
          </div>
        ))}
      </div>
      <div className="route-card">
        <div>
          <span className="small-pill">Routing decision</span>
          <b>{readable(result.route)}</b>
          <p>{result.route_description}</p>
        </div>
        <div className="score-caption">
          <span>Confidence</span>
          <b>{Math.round(result.route_confidence * 100)}%</b>
        </div>
      </div>
      <div className="criteria-heading">
        ICP CRITERIA BREAKDOWN <span>Weight</span>
      </div>
      {result.criteria.map((c, i) => (
        <div className="criterion-result" key={i}>
          <div>
            <strong>{c.name}</strong>
            <span>{c.weight}×</span>
          </div>
          <p>{c.description}</p>
          <div className="bar">
            <i style={{ width: c.fit + "%" }} />
          </div>
          <div className="score-caption">
            <span>Fit</span>
            <b>{c.fit}%</b>
          </div>
        </div>
      ))}
      {onReset && (
        <button className="secondary reset-lead" onClick={onReset}>
          Score another lead <ArrowRight size={15} />
        </button>
      )}
      <p className="method-note">
        Priority combines ICP fit (40%), industry fit (20%), company maturity
        (15%), and purchase intent (25%) into one number you control. Check the
        source text before acting on a lead.
      </p>
    </>
  );
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

export function LeadQueue({
  batch,
  texts,
  openIndex,
  onOpen,
}: {
  batch: LeadBatch;
  texts: string[];
  openIndex: number | null;
  onOpen: (index: number | null) => void;
}) {
  return (
    <>
      <div className="queue-head">
        <span>
          {batch.scored} scored
          {batch.failed > 0 && ` · ${batch.failed} failed`}
        </span>
        <button className="secondary" onClick={() => downloadCsv(batch, texts)}>
          <Download size={14} /> Export CSV
        </button>
      </div>
      {batch.leads.map((lead, rank) => (
        <div className="queue-lead" key={lead.index}>
          <button
            className="queue-row"
            aria-expanded={openIndex === lead.index}
            onClick={() => onOpen(openIndex === lead.index ? null : lead.index)}
          >
            <span className="queue-rank">{rank + 1}</span>
            <span className="queue-label">
              {leadLabel(texts[lead.index] || "", lead.index)}
            </span>
            {lead.result ? (
              <>
                {lead.result.needs_review && (
                  <TriangleAlert
                    size={14}
                    className="queue-flag"
                    aria-label="Needs review"
                  />
                )}
                <span className="queue-route">
                  {readable(lead.result.route)}
                </span>
                <span
                  className={
                    "badge " +
                    (lead.result.disqualified
                      ? "tier-out"
                      : "tier-" + lead.result.tier.toLowerCase())
                  }
                >
                  {lead.result.disqualified
                    ? "Disqualified"
                    : `${lead.result.tier} ${lead.result.priority}`}
                </span>
              </>
            ) : (
              <span className="queue-error">{lead.error}</span>
            )}
            <ChevronDown
              size={15}
              className={openIndex === lead.index ? "queue-open" : ""}
            />
          </button>
          {openIndex === lead.index && lead.result && (
            <div className="queue-detail">
              <LeadResultDetail result={lead.result} />
            </div>
          )}
        </div>
      ))}
    </>
  );
}
