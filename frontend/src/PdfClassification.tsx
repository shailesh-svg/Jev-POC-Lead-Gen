import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  LoaderCircle,
  Trash2,
  RefreshCw,
  Download,
} from "lucide-react";
import { api } from "./api";
import { RequestDetails, type ApiRequest } from "./PromptDetails";
type Result = {
  label: string;
  category: string;
  confidence: number;
  probabilities: Record<string, number>;
  needs_review: boolean;
  requests: ApiRequest[];
};
type Item = {
  id: string;
  file: File;
  status: "queued" | "running" | "done" | "error";
  result?: Result;
  error?: string;
};
type Category = { id: string; label: string; description: string };
const MAX_FILES = 30,
  MAX_TOTAL = 100 * 1024 * 1024;
export function PdfClassification({
  configured,
  openSettings,
}: {
  configured: boolean;
  openSettings: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [running, setRunning] = useState(false),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    runLock = useRef(false);
  useEffect(() => {
    api("/classification/categories")
      .then(setCategories)
      .catch((e) => setError(e.message));
  }, []);
  function add(files: FileList | File[] | null) {
    if (!files || runLock.current) return;
    setError("");
    const incoming = Array.from(files);
    if (items.length + incoming.length > MAX_FILES) {
      setError(
        "Add up to 30 PDFs per batch. Remove files or clear the list first.",
      );
      return;
    }
    if (
      [...items.map((i) => i.file), ...incoming].reduce(
        (sum, f) => sum + f.size,
        0,
      ) > MAX_TOTAL
    ) {
      setError("Keep the total batch size below 100 MB.");
      return;
    }
    setItems((old) => [
      ...old,
      ...incoming.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: (!file.name.toLowerCase().endsWith(".pdf") ||
        file.size > 10 * 1024 * 1024
          ? "error"
          : "queued") as Item["status"],
        error: !file.name.toLowerCase().endsWith(".pdf")
          ? "Only PDF files are supported."
          : file.size > 10 * 1024 * 1024
            ? "This file exceeds 10 MB."
            : undefined,
      })),
    ]);
  }
  function patch(id: string, change: Partial<Item>) {
    setItems((old) =>
      old.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  }
  async function run(selected: Item[]) {
    if (runLock.current || !selected.length || !configured) return;
    runLock.current = true;
    setRunning(true);
    setError("");
    let next = 0;
    async function worker() {
      while (next < selected.length) {
        const item = selected[next++];
        patch(item.id, {
          status: "running",
          error: undefined,
          result: undefined,
        });
        try {
          const data = new FormData();
          data.append("file", item.file);
          const result = await api("/classification", {
            method: "POST",
            body: data,
          });
          patch(item.id, { status: "done", result });
        } catch (e) {
          patch(item.id, { status: "error", error: (e as Error).message });
        }
      }
    }
    try {
      await Promise.all(
        Array.from({ length: Math.min(3, selected.length) }, () => worker()),
      );
    } finally {
      runLock.current = false;
      setRunning(false);
    }
  }
  function exportResults() {
    const data = items.map((i) => ({
      filename: i.file.name,
      status: i.status,
      category: i.result?.category ?? null,
      label: i.result?.label ?? null,
      confidence: i.result?.confidence ?? null,
      needs_review: i.result?.needs_review ?? null,
      probabilities: i.result?.probabilities ?? null,
      error: i.error ?? null,
    }));
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "pdf-classifications.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const done = items.filter((i) => i.status === "done").length,
    failed = items.filter((i) => i.status === "error").length,
    queued = items.filter((i) => i.status === "queued");
  return (
    <>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="input-body">
          <input
            hidden
            ref={input}
            multiple
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            className={"dropzone batch-drop " + (drag ? "drag" : "")}
            disabled={running}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!running) setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              add(e.dataTransfer.files);
            }}
          >
            <span className="upload-icon">
              <Upload />
            </span>
            <strong>Drop your PDFs here</strong>
            <span>Choose several files at once, or add more to the list</span>
            <small>Up to 30 files · 10 MB per file · 100 MB per batch</small>
          </button>
          <div className="batch-toolbar">
            <div aria-live="polite">
              <b>{items.length} files</b>
              <span>
                {done} classified · {failed} failed
                {running ? " · Processing…" : ""}
              </span>
            </div>
            <button
              className="secondary"
              disabled={running || !items.length}
              onClick={() => {
                setItems([]);
                setError("");
              }}
            >
              Clear list
            </button>
            <button
              className="secondary"
              disabled={running || !done}
              onClick={exportResults}
            >
              <Download size={15} />
              Export results
            </button>
            <button
              className="primary"
              disabled={running || !queued.length || !configured}
              onClick={() => run(queued)}
            >
              {running ? (
                <>
                  <LoaderCircle className="spin" size={16} />
                  Classifying…
                </>
              ) : (
                <>Classify {queued.length || ""} PDFs</>
              )}
            </button>
          </div>
          {!configured && (
            <button className="setup-link" onClick={openSettings}>
              Add your TypeSafe API key in Settings to classify PDFs
            </button>
          )}
          <p className="field-hint">
            Each PDF is read with pypdf and sent separately to TypeSafe. Three
            files can process at once. Scanned PDFs need selectable text. Files
            and results are not saved.
          </p>
        </div>
      </section>
      {items.length > 0 && (
        <section className="panel classification-list">
          <div className="panel-heading">
            <h2>Classification results</h2>
            <span className="small-pill">One result per PDF</span>
          </div>
          {items.map((item) => (
            <article className="classification-row" key={item.id}>
              <div className="classification-main">
                <FileText size={21} />
                <div className="classification-file">
                  <b>{item.file.name}</b>
                  <small>{(item.file.size / 1024 / 1024).toFixed(2)} MB</small>
                </div>
                <div className="classification-status">
                  {item.status === "done" ? (
                    <>
                      <span
                        className={
                          "badge " + (item.result?.needs_review ? "" : "green")
                        }
                      >
                        {item.result?.label}
                      </span>
                      <small>
                        {Math.round((item.result?.confidence || 0) * 100)}%
                        model confidence
                        {item.result?.needs_review ? " · Needs review" : ""}
                      </small>
                    </>
                  ) : item.status === "running" ? (
                    <span>
                      <LoaderCircle size={15} className="spin" /> Reading and
                      classifying…
                    </span>
                  ) : item.status === "error" ? (
                    <span className="failed-label">Failed</span>
                  ) : (
                    <span className="small-pill">Queued</span>
                  )}
                </div>
                {item.status === "error" && (
                  <button
                    className="text-button"
                    disabled={
                      running ||
                      !configured ||
                      !item.file.name.toLowerCase().endsWith(".pdf") ||
                      item.file.size > 10 * 1024 * 1024
                    }
                    onClick={() => run([item])}
                  >
                    <RefreshCw size={14} />
                    Retry
                  </button>
                )}
                <button
                  aria-label={"Remove " + item.file.name}
                  disabled={running}
                  onClick={() =>
                    setItems((old) => old.filter((i) => i.id !== item.id))
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {item.error && (
                <p className="classification-error" role="alert">
                  {item.error}
                </p>
              )}
              {item.result && (
                <details className="classification-detail">
                  <summary>View category probabilities and request</summary>
                  <p className="field-hint">
                    Confidence describes the model’s answer, not a guarantee of
                    correctness. Review ambiguous and mixed documents.
                  </p>
                  <div className="probability-list">
                    {Object.entries(item.result.probabilities)
                      .sort((a, b) => b[1] - a[1])
                      .map(([id, value]) => (
                        <div key={id}>
                          <span>
                            {categories.find((c) => c.id === id)?.label || id}
                          </span>
                          <meter min={0} max={1} value={value} />
                          <b>{Math.round(value * 100)}%</b>
                        </div>
                      ))}
                  </div>
                  <RequestDetails requests={item.result.requests} />
                </details>
              )}
            </article>
          ))}
        </section>
      )}
      <details className="panel category-guide">
        <summary>Supported categories ({categories.length})</summary>
        <div className="category-grid">
          {categories.map((c) => (
            <div key={c.id}>
              <b>{c.label}</b>
              <p>{c.description}</p>
            </div>
          ))}
        </div>
      </details>
    </>
  );
}
