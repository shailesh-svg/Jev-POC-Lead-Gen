import {
  ArrowRight,
  BriefcaseBusiness,
  FileText,
  Layers3,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  toDraft,
  templates,
  type Profile,
  type ProfileDraft,
} from "./profileTypes";

export function ProfilesTab({
  profiles,
  moreTemplates,
  setDraft,
  onUse,
  onDelete,
}: {
  profiles: Profile[];
  moreTemplates: Profile[];
  setDraft: (draft: ProfileDraft) => void;
  onUse: (profile: Profile) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="template-banner">
        <div>
          <h3>Start with a useful template</h3>
          <p>Use a starting point, then adjust the criteria to your needs.</p>
        </div>
        <button
          className="secondary"
          onClick={() => setDraft(toDraft(templates.Resume))}
        >
          <BriefcaseBusiness size={16} /> Resume review
        </button>
        <button
          className="secondary"
          onClick={() => setDraft(toDraft(templates.Document))}
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
            if (template) setDraft({ ...toDraft(template), id: "" });
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
              <button className="text-button" onClick={() => onUse(p)}>
                Use profile <ArrowRight size={15} />
              </button>
              <button
                aria-label={"Edit " + p.name}
                onClick={() => setDraft(toDraft(p))}
              >
                <Pencil size={16} />
              </button>
              <button
                aria-label={"Delete " + p.name}
                onClick={() => onDelete(p.id)}
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
          <p>Choose a template above or create a profile from scratch.</p>
        </div>
      )}
    </>
  );
}
