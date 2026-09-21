import { MIN_LEAD_CHARACTERS } from "./leadFormat";

export type ParsedLead = { id: number; text: string };

let counter = 0;
const nextId = () => ++counter;

const lead = (text: string): ParsedLead => ({
  id: nextId(),
  text: text.trim(),
});

/** A line that exists only to separate leads: ---, ===, ***, or a row of dots. */
const SEPARATOR_LINE = /^\s*([-=*_.])\1{2,}\s*$/;
/** A line that opens a new item: "1.", "1)", "- ", "• ", "L001 |", "#3". */
const ITEM_START =
  /^\s*(?:[-*•]\s+|\d{1,3}[.)]\s+|#\d+\s+|[A-Z]{1,4}\d{2,6}\b\s*[|:\-–]?\s+)/;

function rows(text: string) {
  return text.split(/\r?\n/);
}

/** Split one delimited line, honouring "quoted, fields". */
function splitDelimited(line: string, delimiter: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

/** Spreadsheet paste or CSV file: every row is a lead, a header row is dropped. */
function fromTable(lines: string[]): ParsedLead[] | null {
  for (const delimiter of ["\t", ","]) {
    const counts = lines.map((l) => splitDelimited(l, delimiter).length);
    const columns = counts[0];
    // Tabs mean a table. Commas do not: prose is full of them, so a comma
    // table has to look like one — three or more columns, every row the same.
    const minimum = delimiter === "\t" ? 2 : 3;
    const consistent = columns >= minimum && counts.every((c) => c === columns);
    if (!consistent) continue;
    const table = lines.map((l) => splitDelimited(l, delimiter));
    const header = table[0].every(
      (cell) => cell.length > 0 && cell.length < 30 && !/[.!?]$/.test(cell),
    );
    const body = header && table.length > 1 ? table.slice(1) : table;
    const leads = body
      .map((cells) => cells.filter(Boolean).join(" · "))
      .filter((text) => text.length > 0)
      .map(lead);
    if (leads.length > 1) return leads;
  }
  return null;
}

/** Separator lines the user typed themselves, still honoured but never required. */
function fromSeparators(lines: string[]): ParsedLead[] | null {
  if (!lines.some((l) => SEPARATOR_LINE.test(l))) return null;
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (SEPARATOR_LINE.test(line)) {
      blocks.push(current.join("\n"));
      current = [];
    } else current.push(line);
  }
  blocks.push(current.join("\n"));
  const leads = blocks
    .map((b) => b.trim())
    .filter(Boolean)
    .map(lead);
  return leads.length > 1 ? leads : null;
}

/** A numbered, bulleted or ID-prefixed list: each marker opens a lead. */
function fromList(lines: string[]): ParsedLead[] | null {
  const starts = lines.filter((l) => ITEM_START.test(l)).length;
  if (starts < 2) return null;
  const blocks: string[][] = [];
  for (const line of lines) {
    if (ITEM_START.test(line) || blocks.length === 0) blocks.push([line]);
    else blocks[blocks.length - 1].push(line);
  }
  const leads = blocks
    .map((b) => b.join("\n").replace(ITEM_START, "").trim())
    .filter(Boolean)
    .map(lead);
  return leads.length > 1 ? leads : null;
}

/**
 * Blank-line blocks, only when every block is long enough to be a lead on its
 * own. One lead written in paragraphs must not come back as three leads.
 */
function fromBlankLines(text: string): ParsedLead[] | null {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length < 2) return null;
  if (blocks.some((b) => b.length < MIN_LEAD_CHARACTERS * 4)) return null;
  return blocks.map(lead);
}

/**
 * Work out where each lead starts, without asking the user to mark them.
 * Every strategy is a guess, so the caller shows the result for correction.
 */
export function parseLeads(raw: string): ParsedLead[] {
  const text = raw.trim();
  if (!text) return [];
  const lines = rows(text).filter((l) => l.trim().length > 0);
  const found =
    fromSeparators(rows(text)) ??
    fromTable(lines) ??
    fromList(lines) ??
    fromBlankLines(text);
  return found ?? [lead(text)];
}
