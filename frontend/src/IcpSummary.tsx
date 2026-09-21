import { ArrowUpRight, Ban } from "lucide-react";
import type { LeadProfile } from "./leadTypes";

/**
 * What the lead is about to be judged against. This sits where an empty state
 * would otherwise be, so the right-hand panel teaches instead of decorating.
 */
export function IcpSummary({
  profile,
  onEdit,
}: {
  profile?: LeadProfile;
  onEdit: () => void;
}) {
  if (!profile)
    return (
      <div className="icp-summary empty">
        <h3>No ICP yet</h3>
        <p>
          An ICP profile decides what counts as a fit, how each criterion is
          weighed, and where a lead is routed. Start from a template below, or
          build one from scratch.
        </p>
      </div>
    );

  return (
    <div className="icp-summary">
      <div className="icp-head">
        <div>
          <span className="eyebrow">SCORING AGAINST</span>
          <h3>{profile.name}</h3>
        </div>
        <button className="text-button" onClick={onEdit}>
          Edit <ArrowUpRight size={14} />
        </button>
      </div>

      <ul className="icp-criteria">
        {profile.criteria.map((c) => (
          <li key={c.name}>
            <span>{c.name}</span>
            <b>×{c.weight}</b>
          </li>
        ))}
      </ul>

      <div className="icp-rubrics">
        <span className="small-pill">Industry fit</span>
        <span className="small-pill">Company maturity</span>
        <span className="small-pill">Purchase intent</span>
      </div>

      <div className="icp-routes">
        {profile.routing.map((r) => (
          <span
            key={r.name}
            className={r.disqualifying ? "route out" : "route"}
          >
            {r.disqualifying && <Ban size={11} />}
            {r.name.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      <p className="icp-note">
        Priority weighs ICP fit 40%, industry 20%, maturity 15%, intent 25%. A
        disqualifying route overrides the score.
      </p>
    </div>
  );
}
