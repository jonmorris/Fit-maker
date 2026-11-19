import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadEntries } from '../decision-log.ts';
import { KINDS, appendRows, isValidFilename, parseEntry, sortByFilename } from './lib.ts';

const ROW = '| 2026-11-19 | Process | Decision log adopted | docs/DECISION-LOG.md → How to keep this file |';

describe('isValidFilename', () => {
  it.each(['2026-11-19-decision-log.md', '2026-01-02-a.md', '2026-01-02-v2-sizes.md'])('accepts %s', (name) => {
    expect(isValidFilename(name)).toBe(true);
  });

  it.each([
    'README.md',
    '2026-1-2-x.md',
    '2026-11-19.md',
    '2026-11-19-Decision.md',
    '2026-11-19-two_words.md',
    '2026-11-19-trailing-.md',
    '2026-11-19--double.md',
    '2026-11-19-x.txt',
  ])('rejects %s', (name) => {
    expect(isValidFilename(name)).toBe(false);
  });
});

describe('parseEntry', () => {
  const file = '2026-11-19-decision-log.md';

  it('parses a valid row', () => {
    expect(parseEntry(file, `\n${ROW}\n\n`)).toEqual({
      file,
      date: '2026-11-19',
      kind: 'Process',
      decision: 'Decision log adopted',
      ref: 'docs/DECISION-LOG.md → How to keep this file',
      row: ROW,
    });
  });

  it('allows escaped pipes inside a cell', () => {
    const e = parseEntry(file, '| 2026-11-19 | Design | Show owned \\| target | README.md → Plan |');
    expect(e.decision).toBe('Show owned \\| target');
  });

  const cases: [string, string, RegExp][] = [
    ['bad filename', 'x', /filename/],
    ['empty file', '  \n\n', /empty/],
    ['two lines', `${ROW}\n${ROW}`, /exactly one non-blank line, found 2/],
    ['no leading pipe', ROW.slice(1), /start and end/],
    ['no trailing pipe', ROW.slice(0, -1), /start and end/],
    ['three cells', '| 2026-11-19 | Process | Only three |', /expected 4 cells.*found 3/],
    ['five cells', '| 2026-11-19 | Process | a | b | c |', /found 5/],
    ['date mismatch', ROW.replace('2026-11-19', '2026-11-18'), /does not match the filename date 2026-11-19/],
    ['unknown kind', ROW.replace('Process', 'Chore'), /Kind "Chore" is not one of/],
    ['empty decision', '| 2026-11-19 | Process |  | ref |', /Decision cell is empty/],
    ['empty ref', '| 2026-11-19 | Process | Something |  |', /Ref cell is empty/],
  ];

  it.each(cases)('rejects %s with a message naming the file', (label, content, message) => {
    const name = label === 'bad filename' ? 'notes.md' : file;
    expect(() => parseEntry(name, content)).toThrow(message);
    expect(() => parseEntry(name, content)).toThrow(new RegExp(`^${name.replace('.', '\\.')}: `));
  });

  it('accepts every kind in the list', () => {
    for (const kind of KINDS) expect(parseEntry(file, ROW.replace('Process', kind)).kind).toBe(kind);
  });
});

describe('sortByFilename', () => {
  it('orders by date, then name', () => {
    expect(sortByFilename(['2026-11-19-b.md', '2026-10-01-z.md', '2026-11-19-a.md'])).toEqual([
      '2026-10-01-z.md',
      '2026-11-19-a.md',
      '2026-11-19-b.md',
    ]);
  });

  it('sorts entries by their file and leaves the input alone', () => {
    const input = [{ file: '2026-02-01-b.md' }, { file: '2026-01-01-a.md' }];
    expect(sortByFilename(input).map((e) => e.file)).toEqual(['2026-01-01-a.md', '2026-02-01-b.md']);
    expect(input[0].file).toBe('2026-02-01-b.md');
  });
});

describe('appendRows', () => {
  const doc = [
    '# Log doc',
    '',
    '## Log',
    '',
    '| Date | Kind | Decision | Ref |',
    '|---|---|---|---|',
    '| 2026-01-01 | Product | First | git history |',
    '',
    '## After',
    '',
    '| Not | this |',
    '',
  ].join('\n');

  it('adds rows after the last row of the Log table, not later tables', () => {
    const out = appendRows(doc, ['| a |', '| b |']).split('\n');
    expect(out.slice(6, 9)).toEqual(['| 2026-01-01 | Product | First | git history |', '| a |', '| b |']);
    expect(out.at(-2)).toBe('| Not | this |');
  });

  it('works when the table is the end of the file', () => {
    const out = appendRows('## Log\n| h |\n|---|', ['| new |']);
    expect(out).toBe('## Log\n| h |\n|---|\n| new |');
  });

  it('is a no-op without rows', () => {
    expect(appendRows(doc, [])).toBe(doc);
  });

  it('throws without a Log heading or table', () => {
    expect(() => appendRows('# Nothing', ['| x |'])).toThrow(/No "## Log" heading/);
    expect(() => appendRows('## Log\n\ntext\n\n## Next\n| t |', ['| x |'])).toThrow(/No table/);
  });
});

describe('loadEntries', () => {
  it('skips README.md and reports every bad file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'decision-log-'));
    writeFileSync(join(dir, 'README.md'), '# not an entry');
    writeFileSync(join(dir, '2026-11-19-b.md'), ROW);
    writeFileSync(join(dir, '2026-11-18-a.md'), ROW);
    writeFileSync(join(dir, 'Bad Name.md'), ROW);
    const { entries, errors } = loadEntries(dir);
    expect(entries.map((e) => e.file)).toEqual(['2026-11-19-b.md']);
    expect(errors).toHaveLength(2);
    expect(errors.join('\n')).toMatch(/Bad Name\.md: filename/);
    expect(errors.join('\n')).toMatch(/2026-11-18-a\.md: Date cell/);
  });
});

describe('docs/decision-log entries in this repo', () => {
  it('are all valid', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'decision-log');
    const { errors } = loadEntries(dir);
    expect(errors).toEqual([]);
  });
});
