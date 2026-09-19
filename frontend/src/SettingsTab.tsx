import { useState } from "react";
import { ArrowUpRight, Check, Settings2, ShieldCheck } from "lucide-react";

export function SettingsTab({
  configured,
  envKey,
  busy,
  onSave,
  onRemove,
}: {
  configured: boolean;
  envKey: boolean;
  busy: string;
  onSave: (key: string) => Promise<boolean>;
  onRemove: () => Promise<void>;
}) {
  const [key, setKey] = useState("");
  return (
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
          if (await onSave(key)) setKey("");
        }}
      >
        <p>
          Use your TypeSafe API key to assess documents against your criteria.
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
          Your key is encrypted on this computer and is never returned to the
          browser. {envKey && "An environment key is also available."}
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
              onClick={onRemove}
            >
              Remove saved key
            </button>
          )}
        </div>
        <a href="https://console.typesafe.ai" target="_blank" rel="noreferrer">
          Get an API key <ArrowUpRight size={13} />
        </a>
      </form>
      <div className="settings-note">
        <ShieldCheck size={20} />
        <p>
          This is a local workspace. Uploaded files and review results are not
          saved. Profiles and settings stay on this computer.
        </p>
      </div>
    </section>
  );
}
