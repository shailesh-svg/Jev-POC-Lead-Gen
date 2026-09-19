import { describe, expect, it } from "vitest";
import { leadLabel, splitLeads, toCsv } from "./leadFormat";
import type { LeadBatch, LeadResult } from "./leadTypes";

const result = (over: Partial<LeadResult> = {}): LeadResult => ({
  icp_fit: 86,
  criteria: [],
  industry_fit: { level: "Core target", score: 2, confidence: 0.9 },
  company_maturity: { level: "Enterprise", score: 3, confidence: 0.85 },
  purchase_intent: { level: "Ready to buy", score: 3, confidence: 0.8 },
  priority: 82,
  tier: "Hot",
  route: "immediate_sdr_outreach",
  route_description: "Route to an SDR now.",
  route_confidence: 0.9,
  needs_review: false,
  profile_name: "DevOps Platform",
  ...over,
});

describe("splitLeads", () => {
  it("returns one lead when no separator is present", () => {
    expect(splitLeads("  A single inbound message.  ")).toEqual([
      "A single inbound message.",
    ]);
  });

  it("splits on a line of three or more dashes and drops empties", () => {
    const text = "First lead\n---\nSecond lead\n------\n\n   \n-----\nThird";
    expect(splitLeads(text)).toEqual(["First lead", "Second lead", "Third"]);
  });

  it("leaves dashes that are part of a sentence alone", () => {
    expect(splitLeads("Acme — a 200-person fintech - evaluating now")).toEqual([
      "Acme — a 200-person fintech - evaluating now",
    ]);
  });

  it("returns nothing for blank input", () => {
    expect(splitLeads("\n\n   \n")).toEqual([]);
  });
});

describe("leadLabel", () => {
  it("uses the first line", () => {
    expect(leadLabel("Acme Corp\nVP Engineering asked about pricing", 0)).toBe(
      "Acme Corp",
    );
  });

  it("truncates a long first line", () => {
    const label = leadLabel("x".repeat(200), 0);
    expect(label).toHaveLength(70);
    expect(label.endsWith("…")).toBe(true);
  });

  it("falls back to the position when the lead is empty", () => {
    expect(leadLabel("   ", 3)).toBe("Lead 4");
  });
});

describe("toCsv", () => {
  const batch: LeadBatch = {
    scored: 1,
    failed: 1,
    leads: [
      { index: 1, result: result() },
      { index: 0, error: "TypeSafe could not score this lead." },
    ],
  };
  const texts = ['A lead with a "quoted" name', "Acme Corp"];

  it("writes a header and one row per lead, ranked in batch order", () => {
    const rows = toCsv(batch, texts).split("\n");
    expect(rows).toHaveLength(3);
    expect(rows[0].startsWith('"rank","lead","priority"')).toBe(true);
    expect(rows[1]).toContain('"1","Acme Corp","82","Hot"');
    expect(rows[1]).toContain('"immediate sdr outreach"');
    expect(rows[2]).toContain('"2","A lead with a ""quoted"" name"');
  });

  it("leaves score columns empty for a failed lead and keeps its message", () => {
    const failed = toCsv(batch, texts).split("\n")[2];
    expect(failed).toContain('"","","","","","","","",');
    expect(failed.endsWith('"TypeSafe could not score this lead."')).toBe(true);
  });
});
