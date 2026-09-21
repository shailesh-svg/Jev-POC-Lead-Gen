import { ArrowRight, TriangleAlert } from "lucide-react";
import { RequestDetails } from "./PromptDetails";
import { readable } from "./leadFormat";
import type { LeadResult, LevelResult } from "./leadTypes";

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
