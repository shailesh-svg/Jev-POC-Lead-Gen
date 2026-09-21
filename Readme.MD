# Align Workbench

A local workbench for the [TypeSafe AI](https://typesafe.ai) SDK. Its main tool
is **lead scoring**: paste an inbound lead, and it scores that lead against an
ideal customer profile you define, then picks the next action for it — route to
sales, nurture, or disqualify. The same app also carries two smaller tools,
document review and PDF classification, that share the profile and settings
plumbing.

Everything runs on your machine. One Python server serves both the API and the
built React frontend, and the only outbound calls are to TypeSafe.

These commands are for macOS or Linux.

## Run it

Install Python 3.11 or newer and Node.js 20.19 or newer, then, from the project
folder:

```sh
./start
```

That is the whole thing. It creates the virtualenv, installs both sets of
packages, builds the frontend and opens
[http://127.0.0.1:8000](http://127.0.0.1:8000). The first run takes a couple of
minutes; later runs start in a second and only rebuild the frontend when its
source has changed.

Press `Ctrl+C` to stop. Run `./start` again to pick up where you left off.

```sh
./start --port=8100   # serve somewhere else
./start --rebuild     # force a frontend rebuild
./start --no-open     # do not open the browser
./start --help
```

If the port is busy, `./start` moves to the next free one and tells you which.

## Add your API key

Open **Settings** in the app and paste your TypeSafe API key. It is encrypted on
this computer and is never returned to the browser.

For a repeatable setup, copy `.env.example` to `.env` and put the key there
instead — `./start` loads it, and `.env` is gitignored:

```sh
cp .env.example .env
# then edit .env: TYPESAFE_API_KEY=your-key
```

Settings notes when an environment key is present, and a key pasted in the app
takes precedence over it.

## The tools

### Lead generation

Define an **ICP profile**: who you sell to, the criteria that make a lead a fit
(each weighted 1–10), ordered level descriptions for industry fit, company
maturity and purchase intent, and the routing destinations you want a lead sent
to. A destination can be marked **disqualifying**: when the model routes a lead
there, the lead reads as Disqualified however well it scored on fit, because a
well-funded, perfectly staffed lead you are not allowed to sell to is not a warm
lead. Two templates ship with the app — an enterprise DevOps platform and a
mid-market fintech compliance product — and both are editable in place.

Paste a lead — a company profile, an executive bio, an inbound message — and the
app returns a priority score out of 100, a Hot/Warm/Cold tier, a level and model
confidence for each of the three rubrics, a per-criterion fit breakdown, and one
routing decision with its confidence.

Separate leads with a line of `---` to score up to ten at once. They come back
ranked by priority, each row expandable into the full breakdown, and
`Export CSV` saves the queue. A lead that fails carries its own message rather
than sinking the batch.

[DEMO.md](DEMO.md) walks through both paths with sample leads to paste.

### Document review

Score a PDF against a review profile — a job description and weighted criteria —
and get a percentage per criterion, each read as strong, partial or limited
support, plus one overall weighted score.

### PDF classification

Identify what a PDF is across 20 document types (invoice, receipt, statement of
work, bank statement, payslip and so on), with the probability spread and a
review flag when the top two are close.

## How TypeSafe is used

Each lead is **one `system_one` call** carrying four question types at once:

| Question              | Type     | What it asks                               |
| --------------------- | -------- | ------------------------------------------ |
| One per ICP criterion | `Noul`   | Does the lead satisfy this criterion, 0–1  |
| Industry fit          | `Score`  | Which ordered level fits, with confidence  |
| Company maturity      | `Score`  | Which ordered level fits, with confidence  |
| Purchase intent       | `Score`  | Which ordered level fits, with confidence  |
| Routing               | `Choice` | Which single destination this lead goes to |

The split between model and code is deliberate:

- **TypeSafe answers the questions.** Criterion fit, rubric levels, routing
  choice, and the confidence attached to each.
- **The app computes the verdict.** The priority score is a weighted sum — ICP
  fit 40%, industry 20%, maturity 15%, intent 25% — and the Hot/Warm/Cold cuts
  sit at 70 and 40. A lead is flagged `needs_review`, with the reason shown, when
  intent or routing confidence falls below 0.5, or when a rubric the score
  depends on came back under 0.25 — a level the model effectively guessed at.
  All of it sits
  in plain code in `backend/lead_gen.py`, so the weights and the cuts can change
  without touching a prompt.

Every value coming back from the provider is bounds-checked before it is used
(`backend/validation.py`), an unknown routing destination is rejected, and
provider errors are mapped to safe messages that never carry provider detail
into the browser.

The exact instruction text for every question lives in `backend/prompts.py` as
the single source used by both the SDK calls and the **Settings** tab, which
shows each prompt, its question type, and the state it is sent. After any run,
**Request details** in the results panel shows the serialized request that was
actually sent.

## Repo map

```
backend/
  lead_gen.py      Lead scoring: builds the questions, validates, scores, ranks
  prompts.py       Every instruction sent to TypeSafe, in one place
  validation.py    Bounds checks for provider values
  main.py          FastAPI routes, error mapping, batch concurrency
  models.py        Pydantic shapes for profiles and requests
  storage.py       SQLite profiles + the encrypted API key
  evaluation.py    Document review
  classification.py PDF classification and its 20 categories
  extraction.py    PDF text extraction and its limits
frontend/src/
  LeadGeneration.tsx  Lead tab: ICP editor, queue input, scoring
  LeadResult.tsx      Result breakdown, ranked queue, CSV export
  leadFormat.ts       Lead splitting, labels, CSV, input validation
  main.tsx            App shell and the review tab
start              One-command launcher
DEMO.md            Five-minute walkthrough
```

## Data, privacy and limits

- The server binds to `127.0.0.1` only, rejects requests with an unexpected
  `Host`, and refuses cross-origin writes.
- Your API key is encrypted at rest with Fernet, in a key file created `0600`
  inside a `0700` data directory. It is never sent to the browser; the settings
  endpoint returns only whether a key exists.
- **Lead text, uploaded files and results are never stored.** They are sent to
  TypeSafe for the request and held in the browser tab until you clear it. Only
  your profiles and the encrypted key are written to disk, in
  `backend/data/align.db` (override with `ALIGN_DATA_DIR`).
- Prompts instruct the model to treat submitted content as data, never as
  instructions.
- Limits: a lead is 20–20,000 characters and a queue holds 10, with 3 requests
  in flight; a PDF is at most 10 MB, 50 pages and 60,000 characters of text, and
  must have selectable text (scans are not supported); each request gives up
  after 90 seconds.

## Development

```sh
.venv/bin/python -m pytest      # 39 backend tests
cd frontend && npm test         # 22 frontend tests (vitest + jsdom)
cd frontend && npm run build    # typecheck and bundle
```

Backend tests run against the real `typesafe-sdk` with a mock transport, so they
exercise the true request path without a key or a network call.

While the server is running, FastAPI's interactive API reference is at
[/docs](http://127.0.0.1:8000/docs).

Common changes:

- Scoring weights, tier cuts, review threshold — `backend/lead_gen.py`
- Question wording — `backend/prompts.py`
- Batch size and concurrency — `MAX_BATCH`, `BATCH_CONCURRENCY` in `backend/main.py`
- Seed ICP templates — `backend/lead_profile_templates.json`

## Status

Verified against the live API (`jev-1.13.0`): single and batch scoring, ranking,
CSV export, error handling, and the review flags. A lead scores in about a
second, and a five-lead queue finishes in two.

The rubrics separate leads cleanly — a VP Engineering with approved budget
scores 94 (Hot), a report download with no message 41 (Warm), and an
out-of-ICP enquiry 4 (Cold). Identical input moves a point or two between runs,
so the tiers are the dependable part, not the exact number.

## Running the steps yourself

`./start` does the following, if you would rather run them by hand:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cd frontend && npm ci && npm run build && cd ..
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

After a frontend change, rebuild with `npm run build` in `frontend` and refresh.
