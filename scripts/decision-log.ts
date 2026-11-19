// Usage:
//   npm run decision-log            validate pending entries, print their rows and a count
//   npm run decision-log -- --fold  append them to docs/DECISION-LOG.md and delete the files
//                                   (on main, in a commit of its own)

import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EntryError, NON_ENTRY_FILES, appendRows, parseEntry, sortByFilename, type Entry } from './decision-log/lib.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entriesDir = join(root, 'docs', 'decision-log');
const logFile = join(root, 'docs', 'DECISION-LOG.md');

export function loadEntries(dir: string): { entries: Entry[]; errors: string[] } {
  const files = sortByFilename(readdirSync(dir).filter((f) => f.endsWith('.md') && !NON_ENTRY_FILES.has(f)));
  const entries: Entry[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      entries.push(parseEntry(file, readFileSync(join(dir, file), 'utf8')));
    } catch (err) {
      errors.push(err instanceof EntryError ? err.message : `${file}: ${String(err)}`);
    }
  }
  return { entries, errors };
}

function main(argv: string[]) {
  const fold = argv.includes('--fold');
  const { entries, errors } = loadEntries(entriesDir);

  if (errors.length) {
    console.error(`${errors.length} invalid decision-log entr${errors.length === 1 ? 'y' : 'ies'}:`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }

  for (const e of entries) console.log(e.row);
  console.log(`\n${entries.length} pending entr${entries.length === 1 ? 'y' : 'ies'} in docs/decision-log/`);

  if (!fold || !entries.length) return;

  const log = readFileSync(logFile, 'utf8');
  writeFileSync(logFile, appendRows(log, entries.map((e) => e.row)));
  for (const e of entries) unlinkSync(join(entriesDir, e.file));
  console.log(`Folded ${entries.length} into docs/DECISION-LOG.md and deleted their files. Commit this on main by itself.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
