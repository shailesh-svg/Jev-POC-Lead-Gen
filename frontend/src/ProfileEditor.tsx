import { Check, Plus, Trash2, X } from "lucide-react";
import { Modal } from "./Modal";
import { rowKey } from "./rows";
import type { Profile, ProfileDraft } from "./profileTypes";

export function ProfileEditor({
  draft,
  setDraft,
  busy,
  error,
  onSubmit,
}: {
  draft: ProfileDraft;
  setDraft: (draft: ProfileDraft | null) => void;
  busy: string;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Modal
      labelledBy="editor-title"
      locked={!!busy}
      onClose={() => setDraft(null)}
    >
      <form onSubmit={onSubmit}>
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
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
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
            Accepted input: PDF with selectable text. Image extraction is not
            enabled yet.
          </p>
          <div className="editor-criteria-title">
            <h3>Review criteria</h3>
            <span>Higher weights have more effect on the overall score.</span>
          </div>
          {draft.criteria.map((c, i) => (
            <div className="criterion-editor" key={c._k}>
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
              setDraft({
                ...draft,
                criteria: [
                  ...draft.criteria,
                  { name: "", description: "", weight: 1, _k: rowKey() },
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
    </Modal>
  );
}
