import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  LoaderCircle,
  Pencil,
  Plus,
  Target,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { api } from "./api";
import { RequestDetails, type ApiRequest } from "./PromptDetails";
import { useModalKeys } from "./useModalKeys";

const MAX_LEAD_CHARACTERS = 20000;
const MIN_LEAD_CHARACTERS = 20;

type Criterion = { name: string; description: string; weight: number };
type RoutingOption = { name: string; description: string };
type LeadProfile = {
  id: string;
  name: string;
  icp_description: string;
  criteria: Criterion[];
  industry_levels: string[];
  maturity_levels: string[];
  intent_levels: string[];
  routing: RoutingOption[];
};
type LevelResult = { level: string; score: number; confidence: number };
type LeadResult = {
  requests?: ApiRequest[];
  icp_fit: number;
  criteria: (Criterion & { fit: number })[];
  industry_fit: LevelResult;
  company_maturity: LevelResult;
  purchase_intent: LevelResult;
  priority: number;
  tier: "Hot" | "Warm" | "Cold";
  route: string;
  route_description: string;
  route_confidence: number;
  needs_review: boolean;
  profile_name: string;
};

const blank = (): LeadProfile => ({
  id: "",
  name: "",
  icp_description: "",
  criteria: [{ name: "", description: "", weight: 1 }],
  industry_levels: ["Poor industry fit", "Adjacent industry", "Core target industry"],
  maturity_levels: ["Early-stage", "Growth-stage", "Enterprise"],
  intent_levels: ["No stated need", "Some interest", "Ready to buy"],
  routing: [
    { name: "immediate_outreach", description: "Strong fit and intent. Route to sales for immediate outreach." },
    { name: "disqualify", description: "Poor fit or no real signal. Disqualify the lead." },
  ],
});

function LevelListEditor({
  title,
  hint,
  values,
  onChange,
}: {
  title: string;
  hint: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="level-editor">
      <div className="editor-criteria-title">
        <h3>{title}</h3>
        <span>{hint}</span>
      </div>
      {values.map((v, i) => (
        <div className="form-row level-row" key={i}>
          <label>
            Level {i + 1} {i === 0 ? "(weakest)" : i === values.length - 1 ? "(strongest)" : ""}
            <input
              required
              maxLength={300}
              value={v}
              onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </label>
          <button
            type="button"
            aria-label={"Remove level " + (i + 1)}
            disabled={values.length <= 2}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          >
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      <button
        className="secondary"
        type="button"
        disabled={values.length >= 10}
        onClick={() => onChange([...values, ""])}
      >
        <Plus size={15} /> Add level
      </button>
    </div>
  );
}

export function LeadGeneration({
  configured,
  openSettings,
}: {
  configured: boolean;
  openSettings: () => void;
}) {
  const [profiles, setProfiles] = useState<LeadProfile[]>([]),
    [moreTemplates, setMoreTemplates] = useState<LeadProfile[]>([]),
    [selected, setSelected] = useState(""),
    [text, setText] = useState(""),
    [result, setResult] = useState<LeadResult | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [draft, setDraft] = useState<LeadProfile | null>(null),
    [deleteId, setDeleteId] = useState("");
  const generation = useRef(0);
  const profile = profiles.find((p) => p.id === selected);
  useModalKeys(!!draft || !!deleteId, !!busy, () => {
    setDraft(null);
    setDeleteId("");
  });
  async function refresh() {
    const ps = await api("/lead-profiles");
    setProfiles(ps);
    setSelected((old) => (ps.some((p: LeadProfile) => p.id === old) ? old : ps[0]?.id || ""));
  }
  useEffect(() => {
    // Templates ship with the server and never change, so they load once.
    Promise.all([refresh(), api("/lead-profile-templates").then(setMoreTemplates)]).catch((e) =>
      setError(e.message),
    );
  }, []);
  function invalidate() {
    generation.current++;
    setResult(null);
    setError("");
    setNotice("");
  }
  const blocked = !configured
    ? ""
    : !profile
      ? "Choose or create an ICP profile before scoring."
      : text.trim().length < MIN_LEAD_CHARACTERS
        ? `Paste at least ${MIN_LEAD_CHARACTERS} characters of lead content.`
        : "";
  async function score() {
    if (!profile || text.trim().length < MIN_LEAD_CHARACTERS) return;
    invalidate();
    const gen = generation.current;
    setBusy("score");
    try {
      const r = await api("/lead-scores", {
        method: "POST",
        body: JSON.stringify({ lead_profile_id: profile.id, text }),
      });
      if (gen === generation.current) setResult(r);
    } catch (e) {
      if (gen === generation.current) setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy("save");
    setError("");
    try {
      const p = await api("/lead-profiles" + (draft.id ? "/" + draft.id : ""), {
        method: draft.id ? "PUT" : "POST",
        body: JSON.stringify(draft),
      });
      await refresh();
      setSelected(p.id);
      setDraft(null);
      invalidate();
      setNotice("ICP profile saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function deleteProfile() {
    setBusy("delete");
    try {
      await api("/lead-profiles/" + deleteId, { method: "DELETE" });
      await refresh();
      invalidate();
      setDeleteId("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      {error && (
        <div className="alert error" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          {notice}
        </div>
      )}
      <section className="profile-selector">
        <div className="selector-icon">
          <Target size={21} />
        </div>
        <div className="select-wrap">
          <label htmlFor="lead-profile">IDEAL CUSTOMER PROFILE</label>
          <select
            id="lead-profile"
            value={selected}
            disabled={!!busy}
            onChange={(e) => {
              setSelected(e.target.value);
              invalidate();
            }}
          >
            {!profiles.length && <option value="">Choose an ICP to get started</option>}
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <span className="profile-meta">
          {profile ? `${profile.criteria.length} ICP criteria · ${profile.routing.length} routes` : "Define your ideal customer"}
        </span>
        <button
          className="text-button"
          onClick={() => (profile ? setDraft(structuredClone(profile)) : setDraft(blank()))}
        >
          {profile ? "Edit ICP" : "Create ICP"}
          <ArrowUpRight size={15} />
        </button>
      </section>
      <div className="review-grid">
        <section className="panel input-panel">
          <div className="panel-heading">
            <div>
              <span className="step">01</span>
              <h2>Lead content</h2>
            </div>
            <span className="small-pill">Text</span>
          </div>
          <div className="input-body">
            <textarea
              className="text-preview"
              aria-label="Lead content"
              placeholder="Paste a company profile, executive bio, or inbound message…"
              value={text}
              maxLength={MAX_LEAD_CHARACTERS}
              disabled={!!busy}
              onChange={(e) => {
                setText(e.target.value);
                invalidate();
              }}
            />
            <div className="preview-label char-count">
              <span>
                {text.length.toLocaleString()} / {MAX_LEAD_CHARACTERS.toLocaleString()} characters
              </span>
              {text.length >= MAX_LEAD_CHARACTERS && <span>Character limit reached</span>}
            </div>
            <div className="upload-help">
              <Target size={18} />
              <div>
                <b>One lead. A clear next step.</b>
                <p>
                  Paste a company profile, an executive bio, or an inbound message.
                  Your ICP profile decides how it is scored and routed.
                </p>
              </div>
            </div>
            <div className="input-footer">
              <p>
                <TriangleAlert size={14} /> Lead content is not stored. Text is sent to
                TypeSafe for scoring.
              </p>
              <button
                className="primary wide"
                disabled={!!busy || !!blocked || !configured}
                onClick={score}
              >
                {busy === "score" ? (
                  <>
                    <LoaderCircle size={17} className="spin" />
                    Scoring lead…
                  </>
                ) : (
                  <>
                    Score lead <ArrowRight size={17} />
                  </>
                )}
              </button>
              {!configured ? (
                <button className="setup-link" onClick={openSettings}>
                  Connect your TypeSafe API key to score leads <ArrowUpRight size={12} />
                </button>
              ) : (
                blocked && (
                  <p className="blocked-hint" role="status">
                    {blocked}
                  </p>
                )
              )}
            </div>
          </div>
        </section>
        <section className="panel results-panel">
          <div className="panel-heading">
            <div>
              <span className="step">02</span>
              <h2>Lead insights</h2>
            </div>
            <span className="small-pill">{result ? "Complete" : "Overview"}</span>
          </div>
          {result ? (
            <div className="results-body">
              <RequestDetails requests={result.requests} />
              {result.needs_review && (
                <div className="alert warning" role="status">
                  <span>
                    <TriangleAlert size={14} /> Low model confidence on intent or routing.
                    Review this lead before acting on it.
                  </span>
                </div>
              )}
              <div className="score-top">
                <div className="score-ring" style={{ "--score": result.priority + "%" } as React.CSSProperties}>
                  <div>
                    <strong>
                      {result.priority}
                      <small>/100</small>
                    </strong>
                    <span>Priority</span>
                  </div>
                </div>
                <div>
                  <span className={"badge tier-" + result.tier.toLowerCase()}>
                    {result.tier} lead
                  </span>
                  <h3>{result.profile_name}</h3>
                  <p>ICP fit {result.icp_fit}% · Route: {result.route.replace(/_/g, " ")}</p>
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
                  <b>{result.route.replace(/_/g, " ")}</b>
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
              <p className="method-note">
                Priority combines ICP fit (40%), industry fit (20%), company maturity
                (15%), and purchase intent (25%) into one number you control. Check
                the source text before acting on a lead.
              </p>
            </div>
          ) : (
            <div className="empty-results">
              <div className={"insight-illustration " + (busy === "score" ? "pulse" : "")}>
                <span>
                  <CheckCheck size={29} />
                </span>
                <div />
                <div />
                <div />
              </div>
              <h3>{busy === "score" ? "Scoring against your ICP…" : "One lead. One clear route."}</h3>
              <p>
                {busy === "score"
                  ? "TypeSafe is scoring ICP fit, industry, maturity, and intent, then choosing a route. This can take up to 90 seconds."
                  : "Choose an ICP and paste lead content. Your priority score and route will appear here."}
              </p>
              <div className="result-features">
                <span>
                  <Check size={14} /> Priority score
                </span>
                <span>
                  <Check size={14} /> Industry, maturity, intent
                </span>
                <span>
                  <Check size={14} /> Routing decision
                </span>
              </div>
            </div>
          )}
        </section>
      </div>
      <div className="template-banner">
        <div>
          <h3>Start with a useful ICP template</h3>
          <p>Use a starting point, then adjust criteria, levels, and routing.</p>
        </div>
        {moreTemplates.map((t, i) => (
          <button
            key={t.name}
            className="secondary"
            onClick={() => setDraft({ ...structuredClone(t), id: "" })}
          >
            <Target size={16} /> {t.name}
          </button>
        ))}
      </div>
      <div className="profile-grid">
        {profiles.map((p) => (
          <article className="panel profile-card" key={p.id}>
            <span className="badge">Lead</span>
            <h2>{p.name}</h2>
            <p>{p.icp_description}</p>
            <div className="tags">
              <span>{p.criteria.length} criteria</span>
              <span>{p.routing.length} routes</span>
            </div>
            <footer>
              <button
                className="text-button"
                onClick={() => {
                  setSelected(p.id);
                  invalidate();
                }}
              >
                Use ICP <ArrowRight size={15} />
              </button>
              <button aria-label={"Edit " + p.name} onClick={() => setDraft(structuredClone(p))}>
                <Pencil size={16} />
              </button>
              <button aria-label={"Delete " + p.name} onClick={() => setDeleteId(p.id)}>
                <Trash2 size={16} />
              </button>
            </footer>
          </article>
        ))}
      </div>
      {!profiles.length && (
        <div className="empty-profiles">
          <Target size={34} />
          <h3>Your first ICP starts here.</h3>
          <p>Choose a template above or create an ICP profile from scratch.</p>
        </div>
      )}
      {draft && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="lead-editor-title">
            <form onSubmit={saveProfile}>
              <header>
                <div>
                  <span className="eyebrow">LEAD SCORING CONFIGURATION</span>
                  <h2 id="lead-editor-title">{draft.id ? "Edit ICP profile" : "Create an ICP profile"}</h2>
                </div>
                <button type="button" aria-label="Close editor" disabled={!!busy} onClick={() => setDraft(null)}>
                  <X />
                </button>
              </header>
              <div className="modal-body">
                {error && (
                  <div className="alert error" role="alert">
                    {error}
                  </div>
                )}
                <label>
                  Profile name
                  <input
                    autoFocus
                    required
                    maxLength={120}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Enterprise DevOps Platform"
                  />
                </label>
                <label>
                  Ideal customer profile
                  <textarea
                    required
                    maxLength={20000}
                    rows={4}
                    value={draft.icp_description}
                    onChange={(e) => setDraft({ ...draft, icp_description: e.target.value })}
                    placeholder="Describe who you sell to and who the buyer is."
                  />
                </label>
                <div className="editor-criteria-title">
                  <h3>ICP fit criteria</h3>
                  <span>Higher weights have more effect on the overall ICP fit.</span>
                </div>
                {draft.criteria.map((c, i) => (
                  <div className="criterion-editor" key={i}>
                    <div className="form-row">
                      <label>
                        Criterion {i + 1}
                        <input
                          required
                          maxLength={100}
                          value={c.name}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              criteria: draft.criteria.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                            })
                          }
                        />
                      </label>
                      <label className="weight-input">
                        Weight
                        <input
                          type="number"
                          min={1}
                          max={10}
                          required
                          value={c.weight}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              criteria: draft.criteria.map((x, j) =>
                                j === i ? { ...x, weight: Number(e.target.value) } : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={"Remove criterion " + (i + 1)}
                        disabled={draft.criteria.length === 1}
                        onClick={() =>
                          setDraft({ ...draft, criteria: draft.criteria.filter((_, j) => j !== i) })
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <label>
                      Requirement
                      <textarea
                        required
                        maxLength={2000}
                        rows={2}
                        value={c.description}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            criteria: draft.criteria.map((x, j) =>
                              j === i ? { ...x, description: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
                <button
                  className="secondary"
                  type="button"
                  disabled={draft.criteria.length >= 20}
                  onClick={() =>
                    setDraft({ ...draft, criteria: [...draft.criteria, { name: "", description: "", weight: 1 }] })
                  }
                >
                  <Plus size={15} /> Add criterion
                </button>
                <LevelListEditor
                  title="Industry fit levels"
                  hint="Ordered from weakest to strongest industry fit."
                  values={draft.industry_levels}
                  onChange={(v) => setDraft({ ...draft, industry_levels: v })}
                />
                <LevelListEditor
                  title="Company maturity levels"
                  hint="Ordered from least to most organizationally mature."
                  values={draft.maturity_levels}
                  onChange={(v) => setDraft({ ...draft, maturity_levels: v })}
                />
                <LevelListEditor
                  title="Purchase intent levels"
                  hint="Ordered from no stated need to ready to buy."
                  values={draft.intent_levels}
                  onChange={(v) => setDraft({ ...draft, intent_levels: v })}
                />
                <div className="editor-criteria-title">
                  <h3>Routing destinations</h3>
                  <span>TypeSafe selects exactly one destination per lead.</span>
                </div>
                {draft.routing.map((r, i) => (
                  <div className="criterion-editor" key={i}>
                    <div className="form-row">
                      <label>
                        Destination {i + 1}
                        <input
                          required
                          maxLength={60}
                          value={r.name}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              routing: draft.routing.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                            })
                          }
                          placeholder="e.g. immediate_sdr_outreach"
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={"Remove destination " + (i + 1)}
                        disabled={draft.routing.length <= 2}
                        onClick={() => setDraft({ ...draft, routing: draft.routing.filter((_, j) => j !== i) })}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <label>
                      When to use this route
                      <textarea
                        required
                        maxLength={500}
                        rows={2}
                        value={r.description}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            routing: draft.routing.map((x, j) =>
                              j === i ? { ...x, description: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
                <button
                  className="secondary"
                  type="button"
                  disabled={draft.routing.length >= 8}
                  onClick={() =>
                    setDraft({ ...draft, routing: [...draft.routing, { name: "", description: "" }] })
                  }
                >
                  <Plus size={15} /> Add destination
                </button>
              </div>
              <footer>
                <button type="button" className="secondary" disabled={!!busy} onClick={() => setDraft(null)}>
                  Cancel
                </button>
                <button className="primary" disabled={!!busy}>
                  {busy === "save" ? "Saving…" : "Save ICP profile"}
                  <Check size={16} />
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
      {deleteId && (
        <div className="modal-backdrop">
          <section className="modal confirm" role="dialog" aria-modal="true" aria-labelledby="lead-delete-title">
            <h2 id="lead-delete-title">Delete this ICP profile?</h2>
            <p>The profile, its criteria, levels, and routing will be removed.</p>
            <div>
              <button className="secondary" onClick={() => setDeleteId("")}>
                Cancel
              </button>
              <button className="primary danger" disabled={!!busy} onClick={deleteProfile}>
                Delete profile
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
