import { describe, expect, it } from "vitest";
import { parseLeads } from "./leadParse";

const texts = (raw: string) => parseLeads(raw).map((l) => l.text);

describe("parseLeads", () => {
  it("treats a single lead written in paragraphs as one lead", () => {
    const raw = `Priya Raghavan, VP Engineering at Northwind Logistics.

Their Jenkins builds take 40 minutes and deploys fail twice a week.

Budget approved this quarter, comparing two vendors.`;
    expect(parseLeads(raw)).toHaveLength(1);
  });

  it("splits blank-line blocks when each block is substantial", () => {
    const block = (name: string) =>
      `${name} is a healthcare AI company shipping an ambient documentation agent to community clinics across several states, with a named founder and a live deployment.`;
    const result = texts(
      [block("Alpha"), block("Beta"), block("Gamma")].join("\n\n"),
    );
    expect(result).toHaveLength(3);
    expect(result[1].startsWith("Beta")).toBe(true);
  });

  it("splits a spreadsheet paste and drops the header row", () => {
    const raw = [
      "Company\tContact\tNotes",
      "Freed\tErez Druk\tAmbient scribe, 26k clinicians",
      "Penciled\tShawn Shivdat\tPT front office, 50 clinics",
    ].join("\n");
    const result = texts(raw);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(
      "Freed · Erez Druk · Ambient scribe, 26k clinicians",
    );
  });

  it("handles a CSV with quoted commas", () => {
    const raw = [
      "company,contact,notes",
      '"Decoda, Inc.",Daniyal Afzal,"AI front desk, scribe, billing"',
      '"Penciled",Shawn Shivdat,"Scheduling, reminders"',
    ].join("\n");
    const result = texts(raw);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("Decoda, Inc.");
    expect(result[0]).toContain("AI front desk, scribe, billing");
  });

  it("splits numbered and bulleted lists, dropping the marker", () => {
    const numbered = texts(
      "1. Freed, ambient scribe\n2. Penciled, PT front office\n3. Toothy, dental billing",
    );
    expect(numbered).toEqual([
      "Freed, ambient scribe",
      "Penciled, PT front office",
      "Toothy, dental billing",
    ]);
    expect(texts("- Alpha health\n- Beta health")).toEqual([
      "Alpha health",
      "Beta health",
    ]);
  });

  it("splits an ID-prefixed list and keeps continuation lines with their lead", () => {
    const raw = `L001 | Freed — Erez Druk, CEO
Ambient scribe used by 26,000 clinicians.
L020 | Penciled — Shawn Shivdat
AI front office for physical therapy.`;
    const result = texts(raw);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("26,000 clinicians");
    expect(result[1].startsWith("Penciled")).toBe(true);
  });

  it("still honours separator lines someone typed themselves", () => {
    expect(
      texts("First lead here\n---\nSecond lead here\n======\nThird"),
    ).toEqual(["First lead here", "Second lead here", "Third"]);
  });

  it("returns nothing for empty input and one lead for a short note", () => {
    expect(parseLeads("   \n  ")).toEqual([]);
    expect(texts("Just one short note")).toEqual(["Just one short note"]);
  });

  it("gives every lead a stable distinct id", () => {
    const parsed = parseLeads("1. alpha\n2. beta");
    expect(new Set(parsed.map((l) => l.id)).size).toBe(2);
  });
});
