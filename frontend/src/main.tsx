import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  FileText,
  Layers3,
  LayoutDashboard,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
  Pencil,
  LoaderCircle,
  BriefcaseBusiness,
  Target,
} from "lucide-react";
import "./style.css";
import { api } from "./api";
import { PdfClassification } from "./PdfClassification";
import { LeadGeneration } from "./LeadGeneration";
import { useModalKeys } from "./useModalKeys";
import {
  PromptSettings,
  RequestDetails,
  type ApiRequest,
} from "./PromptDetails";

type Criterion = { name: string; description: string; weight: number };
type Profile = {
  id: string;
  name: string;
  category: "Resume" | "Document" | "Image" | "Custom";
  description: string;
  input_label: string;
  accepted_types: string[];
  criteria: Criterion[];
};
type Result = {
  requests?: ApiRequest[];
  score: number;
  profile_name: string;
  model: string;
  criteria: (Criterion & { score: number; status: string })[];
};
const blank = (): Profile => ({
  id: "",
  name: "",
  category: "Resume",
  description: "",
  input_label: "Resume",
  accepted_types: ["pdf"],
  criteria: [{ name: "", description: "", weight: 1 }],
});
const templates: Record<string, Profile> = {
  Resume: {
    ...blank(),
    name: "Senior Product Designer",
    description:
      "We are looking for a Senior Product Designer to lead end-to-end design for a B2B SaaS product. The role works with product managers and engineers to turn complex workflows into clear user experiences. Candidates should show experience with user research, interaction design, and design systems.",
    criteria: [
      {
        name: "Product design experience",
        description:
          "At least 5 years of experience designing and shipping digital products.",
        weight: 3,
      },
      {
        name: "User research",
        description:
          "Evidence of planning user interviews, usability tests, and using findings in design decisions.",
        weight: 2,
      },
      {
        name: "Design systems",
        description:
          "Experience creating or maintaining reusable components and design guidelines.",
        weight: 2,
      },
      {
        name: "Cross-functional work",
        description:
          "Experience working with product managers and engineers to ship products.",
        weight: 1,
      },
    ],
  },
  Document: {
    ...blank(),
    category: "Document",
    input_label: "Document",
    name: "Project proposal review",
    description:
      "Review a project proposal for completeness and a clear delivery plan.",
    criteria: [
      {
        name: "Clear scope",
        description:
          "The proposal defines the problem, goals, and deliverables.",
        weight: 3,
      },
      {
        name: "Delivery plan",
        description:
          "The proposal includes a timeline, owners, and milestones.",
        weight: 2,
      },
      {
        name: "Risks and costs",
        description:
          "The proposal identifies costs, risks, and mitigation steps.",
        weight: 2,
      },
    ],
  },
};
function App() {
  const [moreTemplates, setMoreTemplates] = useState<Profile[]>([]);
  const [page, setPage] = useState("review"),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [selected, setSelected] = useState(""),
    [configured, setConfigured] = useState(false),
    [envKey, setEnvKey] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [draft, setDraft] = useState<Profile | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [upload, setUpload] = useState<{
      filename: string;
      text: string;
      kind: string;
    } | null>(null),
    [key, setKey] = useState(""),
    [drag, setDrag] = useState(false),
    [deleteId, setDeleteId] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const profile = profiles.find((p) => p.id === selected);
  async function refresh() {
    const [ps, s] = await Promise.all([api("/profiles"), api("/settings")]);
    setProfiles(ps);
    setConfigured(s.configured);
    setEnvKey(s.environment_key);
    setSelected((old) =>
      ps.some((p: Profile) => p.id === old) ? old : ps[0]?.id || "",
    );
  }
  useEffect(() => {
    // Templates ship with the server and never change, so they load once.
    Promise.all([refresh(), api("/profile-templates").then(setMoreTemplates)]).catch(
      (e) => setError(e.message),
    );
  }, []);
  function invalidate() {
    generation.current++;
    setResult(null);
    setError("");
    setNotice("");
  }
  async function loadFile(file?: File) {
    if (!file) return;
    invalidate();
    setUpload(null);
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Choose a file smaller than 10 MB.");
      return;
    }
    setBusy("extract");
    const gen = generation.current;
    try {
      const data = new FormData();
      data.append("file", file);
      const extracted = await api("/extract", { method: "POST", body: data });
      if (gen === generation.current) setUpload(extracted);
    } catch (e) {
      if (gen === generation.current) setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function review() {
    if (!upload || !profile) return;
    invalidate();
    const gen = generation.current;
    setBusy("review");
    try {
      const r = await api("/reviews", {
        method: "POST",
        body: JSON.stringify({
          profile_id: profile.id,
          text: upload.text,
          kind: upload.kind,
        }),
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
      const p = await api("/profiles" + (draft.id ? "/" + draft.id : ""), {
        method: draft.id ? "PUT" : "POST",
        body: JSON.stringify(draft),
      });
      await refresh();
      setSelected(p.id);
      setDraft(null);
      invalidate();
      setNotice("Profile saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function deleteProfile() {
    setBusy("delete");
    try {
      await api("/profiles/" + deleteId, { method: "DELETE" });
      await refresh();
      invalidate();
      setDeleteId("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  useModalKeys(!!draft || !!deleteId, !!busy, () => {
    setDraft(null);
    setDeleteId("");
  });
  function navigate(p: string) {
    setPage(p);
    setError("");
    setNotice("");
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => navigate("review")}>
          <span className="brand-icon">
            <Layers3 size={21} />
          </span>
          align<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">W</span>
          <div>
            My workspace<small>Personal workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {[
            ["review", "Review", LayoutDashboard],
            ["classification", "PDF classification", FileText],
            ["leads", "Lead generation", Target],
            ["profiles", "Profiles", BriefcaseBusiness],
            ["settings", "Settings", Settings2],
          ].map(([id, label, Icon]) => (
            <button
              key={id as string}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id as string)}
            >
              <Icon size={18} />
              {label as string}
              {id === "profiles" && (
                <span className="count">{profiles.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="provider">
            <span className={"status-dot " + (configured ? "on" : "")} />
            <div>
              TypeSafe AI
              <small>
                {configured ? "API key configured" : "Setup required"}
              </small>
            </div>
            <button
              aria-label="Open settings"
              onClick={() => navigate("settings")}
            >
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="user">
            <span>ME</span>
            <div>
              My workspace<small>Local edition</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <b>
              {page === "review"
                ? "Review"
                : page === "profiles"
                  ? "Profiles"
                  : page === "classification"
                    ? "PDF classification"
                    : page === "leads"
                      ? "Lead generation"
                      : "Settings"}
            </b>
          </span>
          <span className="top-note">
            <ShieldCheck size={14} /> Built for thoughtful decisions
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "review"
                  ? "A CLEARER PICTURE"
                  : page === "profiles"
                    ? "DEFINE WHAT MATTERS"
                    : page === "classification"
                      ? "SORT YOUR DOCUMENTS"
                      : page === "leads"
                        ? "FIND YOUR NEXT CUSTOMER"
                        : "YOUR WORKSPACE"}
              </div>
              <h1>
                {page === "review"
                  ? "Find the right fit."
                  : page === "profiles"
                    ? "Review profiles"
                    : page === "classification"
                      ? "PDF classification"
                      : page === "leads"
                        ? "Score and route leads."
                        : "Settings"}
              </h1>
              <p>
                {page === "review"
                  ? "Turn documents into clear, criteria-based insights."
                  : page === "profiles"
                    ? "Manage jobs, descriptions, and the criteria behind every review."
                    : page === "classification"
                      ? "Upload a batch of PDFs and identify what each document is."
                      : page === "leads"
                        ? "Match leads to your ICP, score fit and intent, and route them in one step."
                        : "Connect TypeSafe to start reviewing your documents."}
              </p>
            </div>
            {page === "review" || page === "leads" ? (
              <span className="badge">
                <Sparkles size={13} /> Powered by TypeSafe
              </span>
            ) : page === "profiles" ? (
              <button className="primary" onClick={() => setDraft(blank())}>
                <Plus size={16} />
                New profile
              </button>
            ) : null}
          </div>
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
          <div hidden={page !== "classification"}>
            <PdfClassification
              configured={configured}
              openSettings={() => navigate("settings")}
            />
          </div>
          <div hidden={page !== "leads"}>
            <LeadGeneration
              configured={configured}
              openSettings={() => navigate("settings")}
            />
          </div>
          {page === "review" && (
            <>
              <section className="profile-selector">
                <div className="selector-icon">
                  <BriefcaseBusiness size={21} />
                </div>
                <div className="select-wrap">
                  <label htmlFor="profile">REVIEW PROFILE</label>
                  <select
                    id="profile"
                    value={selected}
                    disabled={!!busy}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      invalidate();
                    }}
                  >
                    {!profiles.length && (
                      <option value="">Choose a profile to get started</option>
                    )}
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="profile-meta">
                  {profile
                    ? `${profile.criteria.length} criteria · ${profile.category}`
                    : "Define your review criteria"}
                </span>
                <button
                  className="text-button"
                  onClick={() =>
                    profile
                      ? setDraft(structuredClone(profile))
                      : navigate("profiles")
                  }
                >
                  {profile ? "Edit profile" : "Create profile"}
                  <ArrowUpRight size={15} />
                </button>
              </section>
              <div className="review-grid">
                <section className="panel input-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="step">01</span>
                      <h2>
                        Your {profile?.input_label.toLowerCase() || "document"}
                      </h2>
                    </div>
                    <span className="small-pill">PDF</span>
                  </div>
                  <div className="input-body">
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".pdf,application/pdf"
                      hidden
                      onChange={(e) => {
                        loadFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    {!upload ? (
                      <button
                        disabled={!!busy}
                        className={"dropzone " + (drag ? "drag" : "")}
                        onClick={() => fileInput.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDrag(true);
                        }}
                        onDragLeave={() => setDrag(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDrag(false);
                          if (!busy) loadFile(e.dataTransfer.files[0]);
                        }}
                      >
                        <span className="upload-icon">
                          {busy === "extract" ? (
                            <LoaderCircle className="spin" />
                          ) : (
                            <Upload size={25} />
                          )}
                        </span>
                        <strong>
                          {busy === "extract"
                            ? "Reading your PDF…"
                            : "Drop your document here"}
                        </strong>
                        <span>
                          or <em>browse files</em> to upload
                        </span>
                        <small>PDF with selectable text · Up to 10 MB</small>
                      </button>
                    ) : (
                      <>
                        <div className="file-row">
                          <FileText size={23} />
                          <div>
                            <b>{upload.filename}</b>
                            <small>
                              {upload.text.length.toLocaleString()} characters
                              extracted
                            </small>
                          </div>
                          <button
                            disabled={!!busy}
                            aria-label="Remove document"
                            onClick={() => {
                              setUpload(null);
                              invalidate();
                            }}
                          >
                            <X size={17} />
                          </button>
                        </div>
                        <div className="preview-label">
                          EXTRACTED TEXT <span>Review before you submit</span>
                        </div>
                        <textarea
                          className="text-preview"
                          aria-label="Extracted document text"
                          value={upload.text}
                          disabled={!!busy}
                          onChange={(e) => {
                            setUpload({ ...upload, text: e.target.value });
                            invalidate();
                          }}
                        />
                      </>
                    )}
                    {!upload && (
                      <div className="upload-help">
                        <FileText size={18} />
                        <div>
                          <b>One document. A clear review.</b>
                          <p>
                            Upload a resume, proposal, or another PDF. Your
                            profile defines how it is assessed.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="input-footer">
                      <p>
                        <ShieldCheck size={14} /> Files are not stored. Text is
                        sent to TypeSafe for review.
                      </p>
                      <button
                        className="primary wide"
                        disabled={
                          !!busy ||
                          !profile ||
                          !upload ||
                          upload.text.trim().length < 20 ||
                          !configured
                        }
                        onClick={review}
                      >
                        {busy === "review" ? (
                          <>
                            <LoaderCircle size={17} className="spin" />
                            Review in progress…
                          </>
                        ) : (
                          <>
                            Review{" "}
                            {profile?.input_label.toLowerCase() || "document"}
                            <ArrowRight size={17} />
                          </>
                        )}
                      </button>
                      {!configured && (
                        <button
                          className="setup-link"
                          onClick={() => navigate("settings")}
                        >
                          Connect your TypeSafe API key to review{" "}
                          <ArrowUpRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </section>
                <section className="panel results-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="step">02</span>
                      <h2>Review insights</h2>
                    </div>
                    <span className="small-pill">
                      {result ? "Complete" : "Overview"}
                    </span>
                  </div>
                  {result ? (
                    <div className="results-body">
                      <RequestDetails requests={result.requests} />
                      <div className="score-top">
                        <div
                          className="score-ring"
                          style={
                            {
                              "--score": result.score + "%",
                            } as React.CSSProperties
                          }
                        >
                          <div>
                            <strong>
                              {result.score}
                              <small>/100</small>
                            </strong>
                            <span>Overall fit</span>
                          </div>
                        </div>
                        <div>
                          <span className="badge green">
                            {result.score >= 75
                              ? "Strong support"
                              : result.score >= 40
                                ? "Mixed support"
                                : "Limited support"}
                          </span>
                          <h3>{result.profile_name}</h3>
                          <p>
                            Weighted across {result.criteria.length} criteria
                          </p>
                        </div>
                      </div>
                      <div className="criteria-heading">
                        CRITERIA BREAKDOWN <span>Weight</span>
                      </div>
                      {result.criteria.map((c, i) => (
                        <div className="criterion-result" key={i}>
                          <div>
                            <strong>{c.name}</strong>
                            <span>{c.weight}×</span>
                          </div>
                          <p>{c.description}</p>
                          <div className="bar">
                            <i style={{ width: c.score + "%" }} />
                          </div>
                          <div className="score-caption">
                            <span>{c.status}</span>
                            <b>{c.score}%</b>
                          </div>
                        </div>
                      ))}
                      <p className="method-note">
                        Scores reflect model support for each criterion, not a
                        verified measure of ability. Check the source text
                        before making a decision.
                      </p>
                    </div>
                  ) : (
                    <div className="empty-results">
                      <div
                        className={
                          "insight-illustration " +
                          (busy === "review" ? "pulse" : "")
                        }
                      >
                        <span>
                          <CheckCheck size={29} />
                        </span>
                        <div />
                        <div />
                        <div />
                      </div>
                      <h3>
                        {busy === "review"
                          ? "Checking each criterion…"
                          : "A little context. A lot of clarity."}
                      </h3>
                      <p>
                        {busy === "review"
                          ? "TypeSafe is reviewing your document against the selected profile. This can take up to 90 seconds."
                          : "Select a profile and upload a document. Your review will appear here."}
                      </p>
                      <div className="result-features">
                        <span>
                          <Check size={14} /> Overall fit
                        </span>
                        <span>
                          <Check size={14} /> Criteria breakdown
                        </span>
                        <span>
                          <Check size={14} /> Areas to review
                        </span>
                      </div>
                    </div>
                  )}
                </section>
              </div>
              <div className="bottom-note">
                <span>Flexible by design.</span> One review flow for resumes,
                proposals, and documents.
                <button onClick={() => navigate("profiles")}>
                  Explore profiles <ArrowRight size={13} />
                </button>
              </div>
            </>
          )}
          {page === "profiles" && (
            <>
              <div className="template-banner">
                <div>
                  <h3>Start with a useful template</h3>
                  <p>
                    Use a starting point, then adjust the criteria to your
                    needs.
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => setDraft(structuredClone(templates.Resume))}
                >
                  <BriefcaseBusiness size={16} /> Resume review
                </button>
                <button
                  className="secondary"
                  onClick={() => setDraft(structuredClone(templates.Document))}
                >
                  <FileText size={16} /> Document review
                </button>
              </div>
              <label className="template-picker">
                More profile templates
                <select
                  value=""
                  onChange={(e) => {
                    const template = moreTemplates[Number(e.target.value)];
                    if (template)
                      setDraft({ ...structuredClone(template), id: "" });
                  }}
                >
                  <option value="" disabled>
                    Choose a role or document checklist…
                  </option>
                  {moreTemplates.map((t, i) => (
                    <option key={t.name} value={i}>
                      {t.category} · {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="profile-grid">
                {profiles.map((p) => (
                  <article className="panel profile-card" key={p.id}>
                    <span className="badge">{p.category}</span>
                    <h2>{p.name}</h2>
                    <p>{p.description}</p>
                    <div className="tags">
                      <span>{p.criteria.length} criteria</span>
                      <span>PDF input</span>
                    </div>
                    <footer>
                      <button
                        className="text-button"
                        onClick={() => {
                          setSelected(p.id);
                          invalidate();
                          navigate("review");
                        }}
                      >
                        Use profile <ArrowRight size={15} />
                      </button>
                      <button
                        aria-label={"Edit " + p.name}
                        onClick={() => setDraft(structuredClone(p))}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        aria-label={"Delete " + p.name}
                        onClick={() => setDeleteId(p.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
              {!profiles.length && (
                <div className="empty-profiles">
                  <Layers3 size={34} />
                  <h3>Your first profile starts here.</h3>
                  <p>
                    Choose a template above or create a profile from scratch.
                  </p>
                </div>
              )}
            </>
          )}
          {page === "settings" && (
            <section className="panel settings-panel">
              <div className="panel-heading">
                <div>
                  <Settings2 size={19} />
                  <h2>TypeSafe connection</h2>
                </div>
                <span className={"badge " + (configured ? "green" : "")}>
                  {configured ? "Configured" : "Not connected"}
                </span>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy("key");
                  setError("");
                  try {
                    await api("/settings", {
                      method: "PUT",
                      body: JSON.stringify({ api_key: key }),
                    });
                    setKey("");
                    await refresh();
                    setNotice("API key saved. You can now run a review.");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy("");
                  }
                }}
              >
                <p>
                  Use your TypeSafe API key to assess documents against your
                  criteria.
                </p>
                <label htmlFor="api-key">API key</label>
                <input
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  placeholder={
                    configured
                      ? "Enter a new key to replace the saved key"
                      : "Paste your TypeSafe API key"
                  }
                  required
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
                <small>
                  Your key is encrypted on this computer and is never returned
                  to the browser.{" "}
                  {envKey && "An environment key is also available."}
                </small>
                <div className="settings-actions">
                  <button className="primary" disabled={!!busy || !key.trim()}>
                    Save API key <Check size={15} />
                  </button>
                  {configured && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={!!busy}
                      onClick={async () => {
                        try {
                          await api("/settings", { method: "DELETE" });
                          await refresh();
                          setNotice(
                            envKey
                              ? "Saved key removed. The environment key remains active."
                              : "Saved API key removed.",
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Remove saved key
                    </button>
                  )}
                </div>
                <a
                  href="https://console.typesafe.ai"
                  target="_blank"
                  rel="noreferrer"
                >
                  Get an API key <ArrowUpRight size={13} />
                </a>
              </form>
              <div className="settings-note">
                <ShieldCheck size={20} />
                <p>
                  This is a local workspace. Uploaded files and review results
                  are not saved. Profiles and settings stay on this computer.
                </p>
              </div>
            </section>
          )}
          {page === "settings" && <PromptSettings />}
        </main>
        <footer className="app-footer">
          <span>
            align. <span>Bring clarity to every review.</span>
          </span>
          <span>
            Made with TypeSafe AI <span className="footer-dot">✦</span>
          </span>
        </footer>
      </div>
      {draft && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
          >
            <form onSubmit={saveProfile}>
              <header>
                <div>
                  <span className="eyebrow">REVIEW CONFIGURATION</span>
                  <h2 id="editor-title">
                    {draft.id ? "Edit profile" : "Create a profile"}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close editor"
                  disabled={!!busy}
                  onClick={() => setDraft(null)}
                >
                  <X />
                </button>
              </header>
              <div className="modal-body">
                {error && (
                  <div className="alert error" role="alert">
                    {error}
                  </div>
                )}
                <div className="form-row">
                  <label>
                    Profile name
                    <input
                      autoFocus
                      required
                      maxLength={120}
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                      placeholder="e.g. Senior Product Designer"
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={draft.category}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          category: e.target.value as Profile["category"],
                        })
                      }
                    >
                      {["Resume", "Document", "Image", "Custom"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Input label
                  <input
                    required
                    maxLength={60}
                    value={draft.input_label}
                    onChange={(e) =>
                      setDraft({ ...draft, input_label: e.target.value })
                    }
                    placeholder="Resume, document, proposal…"
                  />
                </label>
                <label>
                  {draft.category === "Resume"
                    ? "Job description"
                    : "Profile description"}
                  <textarea
                    required
                    maxLength={20000}
                    rows={5}
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                    placeholder="Describe the purpose and requirements for this review."
                  />
                </label>
                <p className="field-hint">
                  Accepted input: PDF with selectable text. Image extraction is
                  not enabled yet.
                </p>
                <div className="editor-criteria-title">
                  <h3>Review criteria</h3>
                  <span>
                    Higher weights have more effect on the overall score.
                  </span>
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
                              criteria: draft.criteria.map((x, j) =>
                                j === i ? { ...x, name: e.target.value } : x,
                              ),
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
                                j === i
                                  ? { ...x, weight: Number(e.target.value) }
                                  : x,
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
                          setDraft({
                            ...draft,
                            criteria: draft.criteria.filter((_, j) => j !== i),
                          })
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
                              j === i
                                ? { ...x, description: e.target.value }
                                : x,
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
                    setDraft({
                      ...draft,
                      criteria: [
                        ...draft.criteria,
                        { name: "", description: "", weight: 1 },
                      ],
                    })
                  }
                >
                  <Plus size={15} />
                  Add criterion
                </button>
              </div>
              <footer>
                <button
                  type="button"
                  className="secondary"
                  disabled={!!busy}
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </button>
                <button className="primary" disabled={!!busy}>
                  {busy === "save" ? "Saving…" : "Save profile"}
                  <Check size={16} />
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
      {deleteId && (
        <div className="modal-backdrop">
          <section
            className="modal confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Delete this profile?</h2>
            <p>The profile and its criteria will be removed.</p>
            <div>
              <button className="secondary" onClick={() => setDeleteId("")}>
                Cancel
              </button>
              <button
                className="primary danger"
                disabled={!!busy}
                onClick={deleteProfile}
              >
                Delete profile
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
