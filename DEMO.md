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

Expect a high priority score, a Hot tier, and `immediate_sdr_outreach`.
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

They come back ranked: the first lead hot, the second somewhere in the middle
with a nurture route, the third disqualified. Click any row to expand the full
breakdown, or **Export CSV** to take the queue away.

## What to point at

- **The scoring is not the model's opinion of "priority".** TypeSafe answers
  the individual questions; the weighted score (ICP fit 40%, industry 20%,
  maturity 15%, intent 25%) and the Hot/Warm/Cold cut are computed in
  `backend/lead_gen.py`, where you can see and change them.
- **Low confidence is surfaced, not hidden.** A lead whose intent or routing
  confidence falls below 0.5 is flagged for review rather than presented as a
  clean answer.
- **One request per lead.** Four question types come back in a single
  `system_one` call — visible under Request details.
- **Editable ICP.** Change a criterion weight or a routing destination in the
  editor and re-score the same queue to watch the ranking move.
