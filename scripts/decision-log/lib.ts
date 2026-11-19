// Decision log tooling: each pending decision is one file in docs/decision-log/
// holding a single table row; `npm run decision-log -- --fold` appends them to
// docs/DECISION-LOG.md on main. See that file's "How to keep this file".
//
// Plain TypeScript with no runtime dependencies (Node runs it directly).

/** The one list of decision kinds. DECISION-LOG.md describes them; keep both in step. */
export const KINDS = ['Product', 'Design', 'Engineering', 'Process', 'Deferred', 'Reversed'] as const;
export type Kind = (typeof KINDS)[number];

export const FILENAME_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*\.md$/;

/** Files in docs/decision-log/ that are not entries. */
export const NON_ENTRY_FILES = new Set(['README.md']);

export interface Entry {
  file: string;
  date: string;
  kind: Kind;
  decision: string;
  ref: string;
  /** The row exactly as written, trimmed. */
  row: string;
}

export class EntryError extends Error {
  constructor(file: string, problem: string) {
    super(`${file}: ${problem}`);
    this.name = 'EntryError';
  }
}

export function isValidFilename(name: string): boolean {
  return FILENAME_RE.test(name);
}

/** Splits a table row on unescaped pipes, dropping the empty edges outside the leading and trailing `|`. */
function cells(row: string): string[] {
  return row
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
}

export function parseEntry(file: string, content: string): Entry {
  if (!isValidFilename(file)) {
    throw new EntryError(file, 'filename must look like YYYY-MM-DD-short-name.md (lowercase, hyphenated)');
  }
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) throw new EntryError(file, 'file is empty; it must hold exactly one table row');
  if (lines.length > 1) throw new EntryError(file, `expected exactly one non-blank line, found ${lines.length}`);

  const row = lines[0].trim();
  if (!row.startsWith('|') || !row.endsWith('|')) {
    throw new EntryError(file, 'the row must start and end with "|"');
  }
  const parts = cells(row);
  if (parts.length !== 4) {
    throw new EntryError(file, `expected 4 cells (Date | Kind | Decision | Ref), found ${parts.length}`);
  }
  const [date, kind, decision, ref] = parts;
  const fileDate = file.slice(0, 10);
  if (date !== fileDate) {
    throw new EntryError(file, `Date cell "${date}" does not match the filename date ${fileDate}`);
  }
  if (!(KINDS as readonly string[]).includes(kind)) {
    throw new EntryError(file, `Kind "${kind}" is not one of: ${KINDS.join(', ')}`);
  }
  if (!decision) throw new EntryError(file, 'Decision cell is empty');
  if (!ref) throw new EntryError(file, 'Ref cell is empty; name the file and section that holds the why');

  return { file, date, kind: kind as Kind, decision, ref, row };
}

/** Filename order: the date prefix first, then the name. Plain string order gives exactly that. */
export function sortByFilename<T extends string | { file: string }>(items: T[]): T[] {
  const key = (x: T) => (typeof x === 'string' ? x : x.file);
  return [...items].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/**
 * Appends rows to the end of the table under the `## Log` heading.
 * Throws if there is no such heading or no table under it.
 */
export function appendRows(markdown: string, rows: string[], heading = '## Log'): string {
  if (!rows.length) return markdown;
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) throw new Error(`No "${heading}" heading found`);

  let i = start + 1;
  while (i < lines.length && !lines[i].trimStart().startsWith('|')) {
    if (lines[i].startsWith('## ')) break;
    i++;
  }
  if (i >= lines.length || !lines[i].trimStart().startsWith('|')) {
    throw new Error(`No table found under "${heading}"`);
  }
  let last = i;
  while (last + 1 < lines.length && lines[last + 1].trimStart().startsWith('|')) last++;

  lines.splice(last + 1, 0, ...rows);
  return lines.join('\n');
}
