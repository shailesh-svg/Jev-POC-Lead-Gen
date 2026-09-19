import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  FileText,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import "./style.css";
import { api } from "./api";
import { PdfClassification } from "./PdfClassification";
import { LeadGeneration } from "./LeadGeneration";
import { Modal } from "./Modal";
import { PageHeading, Topbar } from "./PageHeader";
import { ProfileEditor } from "./ProfileEditor";
import { ProfilesTab } from "./ProfilesTab";
import { SettingsTab } from "./SettingsTab";
import { Sidebar } from "./Sidebar";
import { stripKeys } from "./rows";
import { useModalKeys } from "./useModalKeys";
import {
  blank,
  toDraft,
  type Criterion,
  type Profile,
  type ProfileDraft,
} from "./profileTypes";
import {
  PromptSettings,
  RequestDetails,
  type ApiRequest,
} from "./PromptDetails";

type Result = {
  requests?: ApiRequest[];
  score: number;
  profile_name: string;
  model: string;
  criteria: (Criterion & { score: number; status: string })[];
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
    [draft, setDraft] = useState<ProfileDraft | null>(null),
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
    Promise.all([
      refresh(),
      api("/profile-templates").then(setMoreTemplates),
    ]).catch((e) => setError(e.message));
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
        body: JSON.stringify({ ...draft, criteria: stripKeys(draft.criteria) }),
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
  async function saveKey(key: string) {
    setBusy("key");
    setError("");
    try {
      await api("/settings", {
        method: "PUT",
        body: JSON.stringify({ api_key: key }),
      });
      await refresh();
      setNotice("API key saved. You can now run a review.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy("");
    }
  }
  async function removeKey() {
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
  }
  function navigate(p: string) {
    setPage(p);
    setError("");
    setNotice("");
  }
  return (
    <div className="shell">
      <Sidebar
        page={page}
        profileCount={profiles.length}
        configured={configured}
        navigate={navigate}
      />
      <div className="main">
        <Topbar page={page} />
        <main>
          <PageHeading
            page={page}
            action={
              page === "review" || page === "leads" ? (
                <span className="badge">
                  <Sparkles size={13} /> Powered by TypeSafe
                </span>
              ) : page === "profiles" ? (
                <button
                  className="primary"
                  onClick={() => setDraft(toDraft(blank()))}
                >
                  <Plus size={16} />
                  New profile
                </button>
              ) : null
            }
          />
          {error && !draft && !deleteId && (
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
                    profile ? setDraft(toDraft(profile)) : navigate("profiles")
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
            <ProfilesTab
              profiles={profiles}
              moreTemplates={moreTemplates}
              setDraft={setDraft}
              onUse={(p) => {
                setSelected(p.id);
                invalidate();
                navigate("review");
              }}
              onDelete={setDeleteId}
            />
          )}
          {page === "settings" && (
            <SettingsTab
              configured={configured}
              envKey={envKey}
              busy={busy}
              onSave={saveKey}
              onRemove={removeKey}
            />
          )}
          {page === "settings" && <PromptSettings />}
        </main>
        <footer className="app-footer">
          <span>
            align workbench.{" "}
            <span>Clarity for every document and every lead.</span>
          </span>
          <span>
            Made with TypeSafe AI <span className="footer-dot">✦</span>
          </span>
        </footer>
      </div>
      {draft && (
        <ProfileEditor
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          error={error}
          onSubmit={saveProfile}
        />
      )}
      {deleteId && (
        <Modal
          labelledBy="delete-title"
          variant="confirm"
          locked={!!busy}
          onClose={() => setDeleteId("")}
        >
          <h2 id="delete-title">Delete this profile?</h2>
          <p>The profile and its criteria will be removed.</p>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <div>
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() => setDeleteId("")}
            >
              Cancel
            </button>
            <button
              className="primary danger"
              disabled={!!busy}
              onClick={deleteProfile}
            >
              {busy === "delete" ? "Deleting…" : "Delete profile"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
