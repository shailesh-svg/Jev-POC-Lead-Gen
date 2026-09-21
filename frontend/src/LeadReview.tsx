import {
  ArrowRight,
  LoaderCircle,
  Plus,
  TriangleAlert,
  Trash2,
} from "lucide-react";
import { MAX_BATCH, leadIssue, leadLabel } from "./leadFormat";
import type { ParsedLead } from "./leadParse";

/**
 * What the parser made of the paste, before anything is sent. Every row is
 * editable, so a wrong guess costs one click rather than a bad score.
 */
export function LeadReview({
  leads,
  busy,
  canScore,
  onChange,
  onScore,
}: {
  leads: ParsedLead[];
  busy: boolean;
  canScore: boolean;
  onChange: (leads: ParsedLead[]) => void;
  onScore: () => void;
}) {
  const problems = leads.filter((l) => leadIssue(l.text)).length;
  const ready = leads.length - problems;

  return (
    <div className="review">
      <div className="review-head">
        <div>
          <b>
            {leads.length} {leads.length === 1 ? "lead" : "leads"} detected
          </b>
          {problems > 0 && (
            <span className="review-problem">
              <TriangleAlert size={12} /> {problems} cannot be scored
            </span>
          )}
          {leads.length > MAX_BATCH && (
            <span className="review-problem">
              <TriangleAlert size={12} /> only the first {MAX_BATCH} will be
              sent
            </span>
          )}
        </div>
        <button
          className="primary"
          disabled={busy || !canScore}
          onClick={onScore}
        >
          {busy ? (
            <>
              <LoaderCircle size={16} className="spin" /> Scoring…
            </>
          ) : (
            <>
              Score {ready} {ready === 1 ? "lead" : "leads"}{" "}
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>

      <ul className="review-list">
        {leads.map((item, i) => {
          const issue = leadIssue(item.text);
          return (
            <li key={item.id} className={issue ? "bad" : ""}>
              <span className="review-index">{i + 1}</span>
              <div className="review-text">
                <b>{leadLabel(item.text, i)}</b>
                <textarea
                  aria-label={`Lead ${i + 1} text`}
                  value={item.text}
                  rows={2}
                  onChange={(e) =>
                    onChange(
                      leads.map((l) =>
                        l.id === item.id ? { ...l, text: e.target.value } : l,
                      ),
                    )
                  }
                />
                <small>
                  {item.text.trim().length.toLocaleString()} characters
                  {issue && <span className="review-problem"> · {issue}</span>}
                </small>
              </div>
              <button
                aria-label={`Remove lead ${i + 1}`}
                disabled={busy}
                onClick={() => onChange(leads.filter((l) => l.id !== item.id))}
              >
                <Trash2 size={16} />
              </button>
            </li>
          );
        })}
      </ul>

      <button
        className="secondary"
        disabled={busy}
        onClick={() => onChange([...leads, { id: Date.now(), text: "" }])}
      >
        <Plus size={15} /> Add a lead
      </button>
    </div>
  );
}
