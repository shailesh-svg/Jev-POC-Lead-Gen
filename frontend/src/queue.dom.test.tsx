import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeadTable } from "./LeadTable";
import { LeadReview } from "./LeadReview";
import type { LeadBatch, LeadResult } from "./leadTypes";

afterEach(cleanup);

const result = (over: Partial<LeadResult> = {}): LeadResult => ({
  icp_fit: 80,
  criteria: [],
  industry_fit: { level: "Core target", score: 3, confidence: 0.9 },
  company_maturity: { level: "Series A to B", score: 2, confidence: 0.8 },
  purchase_intent: { level: "Actively shipping", score: 2, confidence: 0.9 },
  priority: 74,
  tier: "Hot",
  route: "immediate_outreach",
  route_description: "Send the offer now.",
  route_confidence: 0.95,
  needs_review: false,
  profile_name: "Healthcare AI Evals",
  ...over,
});

const batch: LeadBatch = {
  scored: 3,
  failed: 0,
  leads: [
    { index: 0, result: result() },
    {
      index: 1,
      result: result({
        priority: 48,
        tier: "Cold",
        disqualified: true,
        route: "disqualify",
        needs_review: true,
        review_reasons: ["Company maturity confidence 0%"],
      }),
    },
    {
      index: 2,
      result: result({ priority: 31, tier: "Cold", route: "nurture_pause" }),
    },
  ],
};
const texts = [
  "Penciled — Shawn Shivdat",
  "Opalite Health — Cathleen Kuo",
  "Toothy AI — Johnny Chen",
];

describe("LeadTable", () => {
  const table = (props = {}) =>
    render(
      <LeadTable
        batch={batch}
        texts={texts}
        filter="all"
        onFilter={vi.fn()}
        openId={null}
        onOpen={vi.fn()}
        {...props}
      />,
    );

  it("summarises the queue including disqualified and flagged counts", () => {
    table();
    const summary = document.querySelector(".queue-summary")!.textContent!;
    expect(summary).toContain("3");
    expect(summary).toContain("disqualified");
    expect(summary).toContain("to check");
  });

  it("shows a disqualified lead as disqualified rather than by tier", () => {
    table();
    const badges = [...document.querySelectorAll(".queue-table .badge")].map(
      (b) => b.textContent,
    );
    expect(badges).toEqual(["Hot", "Disqualified", "Cold"]);
  });

  it("filters to a single tier when a chip is active", () => {
    table({ filter: "out" });
    const rows = document.querySelectorAll(".queue-table tbody tr");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Opalite");
  });

  it("reports the lead index when a row is clicked", async () => {
    const onOpen = vi.fn();
    table({ onOpen });
    await userEvent.click(screen.getByText("Toothy AI — Johnny Chen"));
    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it("opens a drawer with the breakdown and the review reason", () => {
    table({ openId: 1 });
    const drawer = document.querySelector(".drawer")!;
    expect(drawer.textContent).toContain("Opalite");
    expect(drawer.textContent).toContain("Company maturity confidence 0%");
    expect(drawer.textContent).toContain("LEAD 2 OF 3");
  });

  it("moves through the queue with the arrow keys", async () => {
    const onOpen = vi.fn();
    table({ openId: 0, onOpen });
    await userEvent.keyboard("{ArrowDown}");
    expect(onOpen).toHaveBeenCalledWith(1);
  });
});

describe("LeadReview", () => {
  const leads = [
    { id: 1, text: "A lead with plenty of detail to score properly." },
    { id: 2, text: "too short" },
  ];
  const review = (props = {}) =>
    render(
      <LeadReview
        leads={leads}
        busy={false}
        canScore
        onChange={vi.fn()}
        onScore={vi.fn()}
        {...props}
      />,
    );

  it("counts what was detected and what cannot be scored", () => {
    review();
    expect(screen.getByText("2 leads detected")).toBeDefined();
    expect(screen.getByText(/1 cannot be scored/)).toBeDefined();
  });

  it("offers to score only the usable leads", () => {
    review();
    expect(screen.getByText(/Score 1 lead/)).toBeDefined();
  });

  it("removes a row without touching the others", async () => {
    const onChange = vi.fn();
    review({ onChange });
    await userEvent.click(screen.getByLabelText("Remove lead 2"));
    expect(onChange).toHaveBeenCalledWith([leads[0]]);
  });

  it("edits a lead in place", async () => {
    const onChange = vi.fn();
    review({ onChange });
    await userEvent.type(screen.getByLabelText("Lead 2 text"), "!");
    expect(onChange.mock.calls[0][0][1].text).toBe("too short!");
  });
});
