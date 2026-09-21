# Demo: score and route a queue of leads

Five minutes, start to finish. You need a TypeSafe API key.

```sh
./start
```

The app opens at http://127.0.0.1:8000. Go to **Settings**, paste your API key,
then open the **Lead generation** tab.

## 1. Pick an ICP

The tab ships with two templates. Click **Enterprise DevOps Platform** under
"Start with a useful ICP template", then **Save ICP profile**.

It sells CI/CD and observability tooling to engineering orgs above 50
engineers, and scores four criteria: decision-maker access, a technical pain
point, team size, and existing tooling. Routing is one of
`immediate_sdr_outreach`, `nurture_sequence`, or `disqualify`.

## 2. Score one lead

Paste this into the lead box and press **Score lead**:

```text
Priya Raghavan, VP Engineering at Northwind Logistics (about 180 engineers)
wrote in through the contact form: "Our Jenkins setup takes 40 minutes per
build and our deploys fail about twice a week. We have budget approved for a
platform this quarter and are comparing two vendors. Can we see a demo next
week?"
```

It comes back in about a second: **priority 94, Hot, `immediate_sdr_outreach`**
at 99% routing confidence, with ICP fit 97% across all four criteria.

Open **Request details** to see the single `system_one` call that produced it:
one Noul question per ICP criterion, three Score questions, one Choice.

## 3. Score a queue

Replace the box with all three leads below. The `---` lines separate them.
Press **Score 3 leads**.

```text
Priya Raghavan, VP Engineering at Northwind Logistics (about 180 engineers)
wrote in through the contact form: "Our Jenkins setup takes 40 minutes per
build and our deploys fail about twice a week. We have budget approved for a
platform this quarter and are comparing two vendors. Can we see a demo next
week?"
---
Tomas Neri downloaded the "State of Platform Engineering" report. Title on the
form: Engineering Manager, Certa Health. LinkedIn shows roughly 60 engineers.
No message, no stated problem, no timeline.
---
Dana Whitfield, owner of Whitfield Landscaping (11 employees), emailed asking
whether we build websites for small businesses and what our hourly rate is.
```

Three leads score in about two seconds. A real run against `jev-1.13.0`:

| Rank | Lead                                      | Tier | Priority | Route                    |
| ---- | ----------------------------------------- | ---- | -------- | ------------------------ |
| 1    | Priya, budget approved, comparing vendors | Hot  | 94       | `immediate_sdr_outreach` |
| 2    | Tomas, report download, no message        | Warm | 41–43    | `nurture_sequence`       |
| 3    | Dana, landscaping, wants a website        | Cold | 4        | `disqualify`             |

Click any row to expand the full breakdown, or **Export CSV** to take the queue
away.

Scores move by a point or two between runs on identical input, so treat them as
bands (Hot / Warm / Cold), not as exact figures.

## What to point at

- **The scoring is not the model's opinion of "priority".** TypeSafe answers
  the individual questions; the weighted score (ICP fit 40%, industry 20%,
  maturity 15%, intent 25%) and the Hot/Warm/Cold cut are computed in
  `backend/lead_gen.py`, where you can see and change them.
- **Low confidence is surfaced, not hidden, with the reason attached.** Tomas's
  lead is flagged "Company maturity confidence 0%" — the model placed him on the
  maturity scale while signalling it had nothing to go on, and that level feeds
  15% of his score. Routing or intent confidence below 50% flags a lead too.
- **Watch the honest uncertainty.** Priya's industry confidence sits around 45%:
  Northwind _Logistics_ with 180 engineers genuinely is a borderline match for
  "core target: software company". The rubric is doing its job.
- **One request per lead.** Four question types come back in a single
  `system_one` call — visible under Request details.
- **Editable ICP.** Change a criterion weight or a routing destination in the
  editor and re-score the same queue to watch the ranking move.
