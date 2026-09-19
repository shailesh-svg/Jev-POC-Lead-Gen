import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { pageCopy } from "./pages";

export function Topbar({ page }: { page: string }) {
  return (
    <header className="topbar">
      <span>
        Workspace <span className="slash">/</span> <b>{pageCopy(page).label}</b>
      </span>
      <span className="top-note">
        <ShieldCheck size={14} /> Built for thoughtful decisions
      </span>
    </header>
  );
}

/** Page heading; `action` is whatever sits to the right of the title. */
export function PageHeading({
  page,
  action,
}: {
  page: string;
  action?: ReactNode;
}) {
  const copy = pageCopy(page);
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{copy.eyebrow}</div>
        <h1>{copy.title}</h1>
        <p>{copy.blurb}</p>
      </div>
      {action}
    </div>
  );
}
