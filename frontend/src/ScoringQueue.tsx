import { LoaderCircle } from "lucide-react";

/**
 * What the queue looks like while it is being scored: the leads that were sent,
 * in order, each waiting its turn. Three run at a time, and no per-lead progress
 * comes back from one batch request, so nothing here pretends to know which
 * lead is finished — it shows what was sent and how long it has taken.
 */
export function ScoringQueue({
  labels,
  elapsed,
}: {
  labels: string[];
  elapsed: string;
}) {
  return (
    <div className="scoring" role="status" aria-live="polite">
      <div className="scoring-head">
        <LoaderCircle size={16} className="spin" />
        <b>
          Scoring {labels.length} {labels.length === 1 ? "lead" : "leads"}
        </b>
        <span>{elapsed}</span>
      </div>

      <ul className="scoring-list">
        {labels.map((label, i) => (
          <li key={i} style={{ animationDelay: `${(i % 6) * 0.12}s` }}>
            <span className="scoring-rank">{i + 1}</span>
            <span className="scoring-label">{label}</span>
            <span className="scoring-bar">
              <i />
            </span>
          </li>
        ))}
      </ul>

      <p className="scoring-note">
        One request per lead — a question for each ICP criterion, three rubrics
        and the routing decision — three in flight at a time.
      </p>
    </div>
  );
}
