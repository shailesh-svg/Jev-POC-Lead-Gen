import { ArrowUpRight, ChevronDown, Layers3 } from "lucide-react";
import { PAGES } from "./pages";

export function Sidebar({
  page,
  profileCount,
  configured,
  navigate,
}: {
  page: string;
  profileCount: number;
  configured: boolean;
  navigate: (page: string) => void;
}) {
  return (
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
        {PAGES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            aria-current={page === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <Icon size={18} />
            {label}
            {id === "profiles" && <span className="count">{profileCount}</span>}
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
  );
}
