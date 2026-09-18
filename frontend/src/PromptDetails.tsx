import { useEffect, useState } from "react";
import { api } from "./api";
export type ApiRequest = {
  model: string;
  state: unknown;
  questions: Record<string, unknown>;
};
export function RequestDetails({ requests }: { requests?: ApiRequest[] }) {
  if (!requests?.length) return null;
  return (
    <details className="request-details">
      <summary>View TypeSafe requests ({requests.length})</summary>
      <p>
        These are the exact request bodies sent by the SDK. They include
        document text and omit authentication headers. Retried requests use the
        same body.
      </p>
      {requests.map((request, i) => (
        <details key={i}>
          <summary>
            Call {i + 1} · {Object.keys(request.questions).length} questions ·{" "}
            {request.model}
          </summary>
          <pre>{JSON.stringify(request, null, 2)}</pre>
        </details>
      ))}
    </details>
  );
}
export function PromptSettings() {
  const [prompts, setPrompts] = useState<
      {
        id: string;
        name: string;
        template: string;
        question_type: string;
        substitutions: string;
        state: string;
        choices: string;
      }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    api("/prompts")
      .then(setPrompts)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel prompt-settings">
      <div className="panel-heading">
        <h2>TypeSafe prompts</h2>
        <span className="small-pill">Read only</span>
      </div>
      <div className="input-body">
        <section
          className="primitive-guide"
          aria-labelledby="primitive-guide-title"
        >
          <h3 id="primitive-guide-title">How the prompt types work</h3>
          <p>
            A TypeSafe question asks for one focused judgment about the supplied
            document. This app uses two question types.
          </p>
          <article>
            <h4>
              Noul <span className="small-pill">Used for reviews</span>
            </h4>
            <p>
              Answers a yes/no question. The <code>noul</code> value is the
              probability of yes, from 0 to 1. A value near 0.5 means
              uncertainty, not medium skill. There is no separate confidence
              value.
            </p>
            <p>
              <b>In this app:</b> Each criterion asks whether the document meets
              a stated requirement. We display the probability as a percentage,
              then compute a weighted average. The overall fit is our
              calculation, not a TypeSafe Score answer.
            </p>
            <p>
              <b>Example:</b> Does the resume explicitly state that the
              candidate has shipped a Python service?
            </p>
            <a
              href="https://docs.typesafe.ai/primitives/noul"
              target="_blank"
              rel="noreferrer"
            >
              Noul documentation ↗
            </a>
          </article>
          <article>
            <h4>
              Choice{" "}
              <span className="small-pill">Used for PDF classification</span>
            </h4>
            <p>
              Selects one option from a supplied set. Returns{" "}
              <code>choice</code>, probabilities for the options, and{" "}
              <code>confidence</code>.
            </p>
            <p>
              <b>In this app:</b> Each PDF is assigned a document category,
              including invoices, resumes, project documents, bank and card
              statements, investment and loan statements, financial statements,
              and other financial documents. The current category list appears
              with the classification prompt below. One request is sent per PDF.
            </p>
            <p>
              <b>Example:</b> Is this document an invoice requesting payment or
              a receipt confirming payment?
            </p>
            <a
              href="https://docs.typesafe.ai/primitives/choice"
              target="_blank"
              rel="noreferrer"
            >
              Choice documentation ↗
            </a>
          </article>
          <article>
            <h4>
              Score <span className="small-pill">Not used in this app</span>
            </h4>
            <p>
              Assesses a position on ordered levels that you define. Returns{" "}
              <code>score</code>, the level <code>legend</code>, probabilities,
              and confidence. The score can fall between levels.
            </p>
            <p>
              <b>When it fits:</b> A rubric such as no experience, basic use,
              independent delivery, and expert practice. Use this to assess a
              level, rather than the probability of a yes/no condition.
            </p>
            <a
              href="https://docs.typesafe.ai/primitives/score"
              target="_blank"
              rel="noreferrer"
            >
              Score documentation ↗
            </a>
          </article>
          <h4>What is sent in a request?</h4>
          <p>
            <b>State</b> contains the source document. <b>Instructions</b>{" "}
            contain the question. <b>Criteria</b> define Choice options or Score
            levels; they can also clarify yes/no outcomes for Noul. Question IDs
            connect answers to fields in our code.
          </p>
          <p>
            Questions in one request share the same state but are assessed
            independently. The app combines results after the response.
          </p>
          <a
            href="https://docs.typesafe.ai/primitives"
            target="_blank"
            rel="noreferrer"
          >
            Read the TypeSafe primitives guide ↗
          </a>
        </section>

        <p>
          The backend uses these exact instruction templates. Values in braces
          are replaced for each question. Document text is sent separately as
          state.
        </p>
        {error && <p role="alert">{error}</p>}
        {prompts.map((prompt) => (
          <details key={prompt.id} open={prompt.id === "review"}>
            <summary>
              {prompt.name}{" "}
              <span className="small-pill">{prompt.question_type}</span>
            </summary>
            <pre>{prompt.template}</pre>
            <p>{prompt.substitutions}</p>
            <p>{prompt.state}</p>
            <p>{prompt.choices}</p>
          </details>
        ))}
        <p>
          After a successful review or classification, open “View TypeSafe
          requests” beside the result to see all filled-in instructions,
          choices, and source text.
        </p>
      </div>
    </section>
  );
}
