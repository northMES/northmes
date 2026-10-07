import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface AdrFile {
  name: string;
  number: number;
  title: string;
  status: string;
  release: string;
  needsConfirmation: string;
}

interface AdrSource {
  name: string;
  text: string;
}

interface IndexRow {
  number: number;
  title: string;
  target: string;
  status: string;
  release: string;
  needsConfirmation: string;
}

const adrFolder = fileURLToPath(new URL('../../docs/adr/', import.meta.url));

// The number in an ADR file name, such as 2 in 0002-split-modules.md. A name that is not an ADR file
// name, such as a path or a file with another extension, has none.
function adrFileNumber(name: string): number | undefined {
  const digits = /^(\d{4})-.+\.md$/.exec(name)?.[1];
  return digits === undefined ? undefined : Number.parseInt(digits, 10);
}

// The parsed front matter fields of an ADR file and the text after them. A file with no front matter
// block has no fields.
function splitFrontMatter(text: string): { fields: Record<string, unknown>; body: string } {
  const [, frontMatter = '', body = ''] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text) ?? [];
  return { fields: (parse(frontMatter) ?? {}) as Record<string, unknown>, body };
}

type FrontMatter = { fields: Record<string, unknown>; body: string } | { problem: string };

// The fields of an ADR file and the text after them, or the problem that makes the front matter
// unreadable. Only the front matter block has to be LF: a CRLF body is fine.
function parseFrontMatter(text: string): FrontMatter {
  const block = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(text)?.[0] ?? '';
  if (block.includes('\r')) {
    return { problem: 'the front matter has CRLF line endings, expected LF' };
  }
  return splitFrontMatter(text);
}

// The test helpers read the same facts a person copies into the index: the first heading and the
// front matter of each ADR file.
function readAdrFiles(): AdrFile[] {
  return readdirSync(adrFolder)
    .sort()
    .flatMap((name) => {
      const number = adrFileNumber(name);
      if (number === undefined) {
        return [];
      }
      const { fields, body } = splitFrontMatter(readFileSync(`${adrFolder}${name}`, 'utf8'));
      return {
        name,
        number,
        title: /^# (.+)$/m.exec(body)?.[1] ?? '',
        status: String(fields.status ?? ''),
        release: String(fields.release ?? ''),
        needsConfirmation: String(fields['needs-confirmation'] ?? ''),
      };
    });
}

// The raw text of each ADR file, for the checks that read the front matter themselves.
function readAdrSources(): AdrSource[] {
  return readdirSync(adrFolder)
    .sort()
    .filter((name) => adrFileNumber(name) !== undefined)
    .map((name) => ({ name, text: readFileSync(`${adrFolder}${name}`, 'utf8') }));
}

// An index row is `| 0001 | [Title](0001-file.md) | status | release | needs confirmation |`.
function parseIndexRow(line: string): IndexRow | undefined {
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  const [number = '', link = '', status = '', release = '', needsConfirmation = ''] = cells;
  const match = /^\[(.+)\]\((.+)\)$/.exec(link);
  if (cells.length !== 5 || !/^\d{4}$/.test(number) || !match) {
    return undefined;
  }
  return {
    number: Number.parseInt(number, 10),
    title: match[1] ?? '',
    target: match[2] ?? '',
    status,
    release,
    needsConfirmation,
  };
}

function parseIndexRows(markdown: string): IndexRow[] {
  return markdown.split('\n').flatMap((line) => parseIndexRow(line) ?? []);
}

// The cells that the index copies from a file, with the name each one has in a problem message.
const copiedCells = [
  ['title', 'title'],
  ['status', 'status'],
  ['release', 'release'],
  ['needs-confirmation', 'needsConfirmation'],
] as const;

function indexProblems(files: AdrFile[], rows: IndexRow[]): string[] {
  const fileProblems = files.flatMap((file) => {
    const row = rows.find((candidate) => candidate.number === file.number);
    const unindexed =
      row?.target === file.name
        ? []
        : [
            `${file.name}: no row numbered ${file.name.slice(0, 4)} in the index links to this file`,
          ];
    const drifted = row
      ? copiedCells
          .filter(([, key]) => row[key] !== file[key])
          .map(
            ([cell, key]) =>
              `${file.name.slice(0, 4)}: ${cell} is "${row[key]}" in the index and "${file[key]}" in the file`,
          )
      : [];
    return [...unindexed, ...drifted];
  });
  const rowProblems = rows
    .filter((row) => !files.some((file) => file.name === row.target))
    .map((row) => `${row.target}: the index links to a file that does not exist`);

  return [...fileProblems, ...rowProblems];
}

// A table row that starts with a four-digit number is meant as an index row. If it does not parse,
// parseIndexRows drops it, so it needs its own problem.
function malformedRowProblems(markdown: string): string[] {
  return markdown.split('\n').flatMap((line) => {
    const number = /^\|\s*(\d{4})\b/.exec(line)?.[1];
    return number && !parseIndexRow(line)
      ? [`${number}: the index has a row that is not five cells with a linked title`]
      : [];
  });
}

function padNumber(number: number): string {
  return String(number).padStart(4, '0');
}

// The items that share their number with another item, grouped by that number.
function sharedNumbers<T extends { number: number }>(items: T[]): [number, T[]][] {
  return [...new Set(items.map((item) => item.number))]
    .map((number): [number, T[]] => [number, items.filter((item) => item.number === number)])
    .filter(([, group]) => group.length > 1);
}

// The ADR numbers run 0001, 0002, ... with no gap, no number twice and none below 0001. A missing
// 0001 is a gap too.
function numberProblems(files: AdrFile[]): string[] {
  const belowFirst = files
    .filter((file) => file.number < 1)
    .map((file) => `${file.name}: the number is below 0001 (numbers run contiguously from 0001)`);
  const highest = Math.max(0, ...files.map((file) => file.number));
  const gaps = Array.from({ length: highest }, (_, index) => index + 1)
    .filter((number) => !files.some((file) => file.number === number))
    .map(
      (number) =>
        `${padNumber(number)}: no ADR file has this number (numbers run contiguously from 0001)`,
    );
  const shared = sharedNumbers(files).map(
    ([number, group]) =>
      `${padNumber(number)}: ${group.map((file) => file.name).join(', ')} share this number`,
  );

  return [...belowFirst, ...gaps, ...shared];
}

// Each number has one row in the index, and a row links to the file with its own number.
function rowNumberProblems(rows: IndexRow[]): string[] {
  const shared = sharedNumbers(rows).map(
    ([number, group]) =>
      `${padNumber(number)}: the index has two rows with this number (${group.map((row) => row.target).join(', ')})`,
  );
  const mismatched = rows.flatMap((row) => {
    const linked = adrFileNumber(row.target);
    return linked === row.number
      ? []
      : [
          `${padNumber(row.number)}: the row links to ${row.target}, whose number is ${linked === undefined ? 'missing' : padNumber(linked)}`,
        ];
  });

  return [...shared, ...mismatched];
}

// The fields that every ADR names in its front matter.
const frontMatterFields = [
  'status',
  'date',
  'decision-makers',
  'consulted',
  'informed',
  'release',
  'needs-confirmation',
] as const;

// A key with no value parses to null. For needs-confirmation that is the empty value the template
// allows, and for every other field it is no value at all.
function isMissing(field: string, value: unknown): boolean {
  return value === undefined || (value === null && field !== 'needs-confirmation');
}

// A YYYY-MM-DD string that names a day on the calendar. 2026-02-30 does not, and Date.UTC rolls it
// over to 2026-03-02.
function isRealDay(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

interface FieldRule {
  expected: string;
  allows: (value: unknown) => boolean;
}

const nameRule: FieldRule = {
  expected: 'a non-empty string',
  allows: (value) => typeof value === 'string' && value.trim() !== '',
};

const frontMatterRules: Record<(typeof frontMatterFields)[number], FieldRule> = {
  status: {
    expected: 'proposed, accepted, rejected, deprecated or superseded by ADR-NNNN',
    allows: (value) =>
      typeof value === 'string' &&
      /^(proposed|accepted|rejected|deprecated|superseded by ADR-\d{4})$/.test(value),
  },
  date: { expected: 'a real day as YYYY-MM-DD', allows: isRealDay },
  'decision-makers': nameRule,
  consulted: nameRule,
  informed: nameRule,
  // Unquoted, YAML reads 1 as a number, so the release must be a string.
  release: {
    expected: 'the string "1", "later" or "vision"',
    allows: (value) => value === '1' || value === 'later' || value === 'vision',
  },
  'needs-confirmation': {
    expected: 'a string, possibly empty',
    allows: (value) => value === null || typeof value === 'string',
  },
};

const maintainer = 'Krister Johansson';

// Each ADR names every front matter field, with a value that the template allows. An accepted ADR
// names the maintainer as its decision-maker.
function frontMatterProblems(sources: AdrSource[]): string[] {
  return sources.flatMap(({ name, text }) => {
    const parsed = parseFrontMatter(text);
    if ('problem' in parsed) {
      return [`${name}: ${parsed.problem}`];
    }
    const { fields } = parsed;
    return frontMatterFields.flatMap((field) => {
      const value = fields[field];
      if (isMissing(field, value)) {
        return [`${name}: ${field} is missing`];
      }
      const rule = frontMatterRules[field];
      if (!rule.allows(value)) {
        return [`${name}: ${field} is ${JSON.stringify(value)}, expected ${rule.expected}`];
      }
      // The value passed its own rule, so it is a string here.
      return field === 'decision-makers' && fields.status === 'accepted' && value !== maintainer
        ? [`${name}: ${field} is ${JSON.stringify(value)}, an accepted ADR names ${maintainer}`]
        : [];
    });
  });
}

function rowOf(file: AdrFile): IndexRow {
  const { name, ...cells } = file;
  return { ...cells, target: name };
}

// An ADR file with the given number and a slug that is unique to it.
function fileNumbered(number: number): AdrFile {
  const prefix = padNumber(number);
  return {
    name: `${prefix}-decision.md`,
    number,
    title: `Decision ${prefix}`,
    status: 'proposed',
    release: '1',
    needsConfirmation: '',
  };
}

// The raw YAML of each front matter field in a complete ADR. A test replaces or drops single lines.
const completeFrontMatter: Record<string, string> = {
  status: '"proposed"',
  date: '2026-10-05',
  'decision-makers': 'Krister Johansson',
  consulted: 'internal research notes',
  informed: 'contributors and coding agents',
  release: '"1"',
  'needs-confirmation': '""',
};

// An ADR source whose front matter is the complete one, with the given raw YAML values in place of
// the complete ones. A field set to undefined has no line.
function adrSource(
  changes: Record<string, string | undefined> = {},
  name = '0001-decision.md',
): AdrSource {
  const lines = Object.entries({ ...completeFrontMatter, ...changes }).flatMap(([field, yaml]) =>
    yaml === undefined ? [] : [`${field}: ${yaml}`],
  );
  return { name, text: `---\n${lines.join('\n')}\n---\n\n# Decision\n` };
}

describe('adr index', () => {
  const files: AdrFile[] = [
    {
      name: '0001-record-decisions.md',
      number: 1,
      title: 'Record decisions',
      status: 'accepted',
      release: '1',
      needsConfirmation: '',
    },
    {
      name: '0002-split-modules.md',
      number: 2,
      title: 'Split modules',
      status: 'proposed',
      release: 'later',
      needsConfirmation: 'maintainer (the split)',
    },
  ];
  const rows = files.map(rowOf);

  it('every docs/adr/NNNN-*.md file is in the index with the same title and status', () => {
    expect(indexProblems(files, rows)).toEqual([]);

    // One row differs from its file in one cell. Each cell must report its own problem.
    const drifts: { cell: string; change: Partial<IndexRow> }[] = [
      { cell: 'title', change: { title: 'Split the modules' } },
      { cell: 'status', change: { status: 'accepted' } },
      { cell: 'release', change: { release: '1' } },
      { cell: 'needs-confirmation', change: { needsConfirmation: '' } },
    ];
    for (const { cell, change } of drifts) {
      const drifted = rows.map((row) => (row.number === 2 ? { ...row, ...change } : row));

      expect
        .soft(indexProblems(files, drifted), cell)
        .toEqual([expect.stringContaining(`0002: ${cell}`)]);
    }

    const adrFiles = readAdrFiles();
    const index = parseIndexRows(readFileSync(`${adrFolder}README.md`, 'utf8'));
    expect(adrFiles, 'docs/adr files').not.toHaveLength(0);
    expect(index, 'docs/adr/README.md rows').not.toHaveLength(0);
    expect(indexProblems(adrFiles, index)).toEqual([]);
  });

  it('adr.test.ts fails when an ADR file is renamed without updating the index', () => {
    // Same number, same cells, new slug: the row still links to the old name.
    const renamed = files.map((file) =>
      file.number === 2 ? { ...file, name: '0002-split-the-modules.md' } : file,
    );
    // A new file whose row nobody added.
    const added: AdrFile[] = [
      ...files,
      {
        name: '0003-new-decision.md',
        number: 3,
        title: 'New decision',
        status: 'proposed',
        release: '1',
        needsConfirmation: '',
      },
    ];

    expect
      .soft(indexProblems(renamed, rows))
      .toEqual(expect.arrayContaining([expect.stringContaining('0002-split-the-modules.md')]));
    expect
      .soft(indexProblems(added, rows))
      .toEqual(expect.arrayContaining([expect.stringContaining('0003-new-decision.md')]));
  });

  it('each index row links to the file with its own number', () => {
    // Each row keeps its number and cells, but the two rows trade link targets. Every file is
    // linked by some row and every link has a file, so only the pairing by number shows the mix-up.
    const [first, second] = rows;
    const swapped = [
      { ...first, target: second?.target },
      { ...second, target: first?.target },
    ] as IndexRow[];

    expect
      .soft(indexProblems(files, swapped))
      .toEqual([
        expect.stringContaining('0001-record-decisions.md'),
        expect.stringContaining('0002-split-modules.md'),
      ]);
  });

  it('the index lists no file that does not exist', () => {
    // A row for a file nobody wrote, and a row left behind after a file was deleted.
    const invented: IndexRow[] = [
      ...rows,
      {
        number: 3,
        title: 'Invented decision',
        target: '0003-invented-decision.md',
        status: 'proposed',
        release: '1',
        needsConfirmation: '',
      },
    ];
    const deleted = files.filter((file) => file.number !== 2);

    expect
      .soft(indexProblems(files, invented))
      .toEqual([expect.stringContaining('0003-invented-decision.md')]);
    expect
      .soft(indexProblems(deleted, rows))
      .toEqual([expect.stringContaining('0002-split-modules.md')]);

    const index = parseIndexRows(readFileSync(`${adrFolder}README.md`, 'utf8'));
    expect(indexProblems(readAdrFiles(), index)).toEqual([]);
  });

  it('numbers run contiguously from 0001', () => {
    expect(numberProblems(files)).toEqual([]);

    // 0003 is missing between 0002 and 0004.
    expect
      .soft(numberProblems([1, 2, 4].map(fileNumbered)))
      .toEqual([expect.stringContaining('0003')]);
    // The numbers start at 0002, so 0001 is missing.
    expect
      .soft(numberProblems([2, 3].map(fileNumbered)))
      .toEqual([expect.stringContaining('0001')]);

    const adrFiles = readAdrFiles();
    expect(adrFiles, 'docs/adr files').not.toHaveLength(0);
    expect(numberProblems(adrFiles)).toEqual([]);
  });

  it('no two ADR files share a number', () => {
    // Numbers 1, 2, 2 have no gap, so only the shared number shows.
    const shared: AdrFile[] = [...files, { ...fileNumbered(2), name: '0002-other-split.md' }];

    const problems = numberProblems(shared);
    expect.soft(problems).toEqual([expect.stringContaining('0002-split-modules.md')]);
    expect.soft(problems.join('\n')).toContain('0002-other-split.md');

    expect(numberProblems(readAdrFiles())).toEqual([]);
  });

  it('no ADR file is numbered below 0001', () => {
    // Numbers 0, 1, 2 have no gap above 0001, so only the file numbered 0000 shows.
    expect
      .soft(numberProblems([0, 1, 2].map(fileNumbered)))
      .toEqual([expect.stringContaining('0000-decision.md')]);

    expect(numberProblems(readAdrFiles())).toEqual([]);
  });

  it('the index has no two rows with one number', () => {
    expect(rowNumberProblems(rows)).toEqual([]);

    // A second row numbered 0002 that links to another file with the 0002 prefix.
    const doubled = [...rows, { ...rowOf(fileNumbered(2)), target: '0002-other-split.md' }];

    expect
      .soft(rowNumberProblems(doubled))
      .toEqual([expect.stringContaining('0002: the index has two rows with this number')]);

    const index = parseIndexRows(readFileSync(`${adrFolder}README.md`, 'utf8'));
    expect(index, 'docs/adr/README.md rows').not.toHaveLength(0);
    expect(rowNumberProblems(index)).toEqual([]);
  });

  it("each index row's number equals the number in the file name it links to", () => {
    expect(rowNumberProblems(rows)).toEqual([]);

    // The fixture has no row 0003, so this row is unique by number and only the file name is wrong.
    const mismatched = [...rows, { ...rowOf(fileNumbered(3)), target: '0001-record-decisions.md' }];
    const problems = rowNumberProblems(mismatched);

    expect.soft(problems).toEqual([expect.stringContaining('0003')]);
    expect.soft(problems.join('\n')).toContain('0001-record-decisions.md');

    const index = parseIndexRows(readFileSync(`${adrFolder}README.md`, 'utf8'));
    expect(index, 'docs/adr/README.md rows').not.toHaveLength(0);
    expect(rowNumberProblems(index)).toEqual([]);
  });

  it('the index has no row that starts with a number and does not parse', () => {
    const markdown = [
      '| Number | Title | Status | Release | Needs confirmation |',
      '|---|---|---|---|---|',
      '| 0001 | [Record decisions](0001-record-decisions.md) | accepted | 1 | |',
      // The row for an existing file lost its last cell.
      '| 0002 | [Split modules](0002-split-modules.md) | proposed | later |',
      // The title has no link, and no file stands behind the row.
      '| 0003 | Invented decision | proposed | 1 | |',
    ].join('\n');

    expect
      .soft(malformedRowProblems(markdown))
      .toEqual([expect.stringContaining('0002'), expect.stringContaining('0003')]);

    expect(malformedRowProblems(readFileSync(`${adrFolder}README.md`, 'utf8'))).toEqual([]);
  });
});

describe('adr front matter', () => {
  it('every ADR has the front matter fields', () => {
    expect(frontMatterProblems([adrSource()])).toEqual([]);

    // Each field dropped in turn is reported with the file and the field.
    for (const field of Object.keys(completeFrontMatter)) {
      expect
        .soft(frontMatterProblems([adrSource({ [field]: undefined })]), field)
        .toEqual([`0001-decision.md: ${field} is missing`]);
    }

    // A file with no front matter block lacks every field, and the problems name the file they
    // belong to.
    const bare = { name: '0002-bare.md', text: '# Bare\n\nNo front matter here.\n' };
    expect
      .soft(frontMatterProblems([adrSource(), bare]))
      .toEqual(
        Object.keys(completeFrontMatter).map((field) => `0002-bare.md: ${field} is missing`),
      );

    const sources = readAdrSources();
    expect(sources, 'docs/adr files').not.toHaveLength(0);
    expect(frontMatterProblems(sources)).toEqual([]);
  });

  it('a bare needs-confirmation is empty, and a bare status is missing', () => {
    // YAML parses a key with no value to null. For needs-confirmation that is the empty value the
    // template allows, and for every other field it is no value at all.
    expect.soft(frontMatterProblems([adrSource({ 'needs-confirmation': '' })])).toEqual([]);
    expect
      .soft(frontMatterProblems([adrSource({ status: '' })]))
      .toEqual(['0001-decision.md: status is missing']);
  });

  it('every ADR front matter value is in the allowed set', () => {
    // Raw YAML values that the template allows. A bare word, a quoted string and a plain scalar
    // with spaces all parse to strings.
    const allowed: [string, string][] = [
      ['status', 'proposed'],
      ['status', '"accepted"'],
      ['status', '"rejected"'],
      ['status', '"deprecated"'],
      ['status', '"superseded by ADR-0042"'],
      ['date', '2024-02-29'],
      ['release', '"later"'],
      ['release', '"vision"'],
      ['needs-confirmation', 'maintainer (the split)'],
      ['consulted', 'internal research notes 16, 25, 28 and 30'],
    ];
    for (const [field, yaml] of allowed) {
      expect
        .soft(frontMatterProblems([adrSource({ [field]: yaml })]), `${field}: ${yaml}`)
        .toEqual([]);
    }

    // Raw YAML values outside the allowed set. Each one is reported once, with the file and field.
    const names = ['decision-makers', 'consulted', 'informed'];
    const notAllowed: [string, string][] = [
      ['status', '"done"'],
      ['status', '"Accepted"'],
      ['status', '"superseded by ADR-12"'],
      ['date', '2026-02-30'],
      ['date', '05/10/2026'],
      ['date', '20261005'],
      // Unquoted, YAML reads the release as the number 1.
      ['release', '1'],
      ['release', '"2"'],
      ['needs-confirmation', '[maintainer]'],
      ['needs-confirmation', '7'],
      ...names.flatMap((field): [string, string][] =>
        ['""', '"   "', '[Krister Johansson]', '3'].map((yaml) => [field, yaml]),
      ),
    ];
    for (const [field, yaml] of notAllowed) {
      expect
        .soft(frontMatterProblems([adrSource({ [field]: yaml })]), `${field}: ${yaml}`)
        .toEqual([
          expect.stringMatching(new RegExp(`^0001-decision\\.md: ${field} is .+, expected `)),
        ]);
    }

    expect(frontMatterProblems(readAdrSources())).toEqual([]);
  });

  it('an accepted ADR names Krister Johansson as the decision-maker', () => {
    const planned = 'proposed by the planning session, to be confirmed by Krister Johansson';

    // The complete ADR names Krister Johansson, plain or quoted.
    expect.soft(frontMatterProblems([adrSource({ status: '"accepted"' })])).toEqual([]);
    expect
      .soft(
        frontMatterProblems([
          adrSource({ status: '"accepted"', 'decision-makers': '"Krister Johansson"' }),
        ]),
      )
      .toEqual([]);

    // The planning session's wording is not a decision-maker once the ADR is accepted.
    expect
      .soft(frontMatterProblems([adrSource({ status: '"accepted"', 'decision-makers': planned })]))
      .toEqual([expect.stringMatching(/^0001-decision\.md: decision-makers is ".+", .*Krister/)]);

    // A proposed ADR may still carry that wording, so the rule applies to accepted ADRs only.
    expect.soft(frontMatterProblems([adrSource({ 'decision-makers': planned })])).toEqual([]);

    const accepted = readAdrSources().filter(({ text }) => /^status: "?accepted"?$/m.test(text));
    expect(accepted, 'accepted docs/adr files').not.toHaveLength(0);
    expect(frontMatterProblems(accepted)).toEqual([]);
  });

  it('an ADR with CRLF line endings is reported by file name', () => {
    const good = adrSource({}, '0002-good.md');
    const crlf = { ...adrSource(), text: adrSource().text.replaceAll('\n', '\r\n') };

    // The CRLF file is reported once, as a whole, and not as seven missing fields.
    expect
      .soft(frontMatterProblems([crlf, good]))
      .toEqual([expect.stringMatching(/^0001-decision\.md: .*CRLF line endings/)]);

    // Only the front matter has to be LF. A CRLF body behind an LF front matter is not reported.
    const crlfBody = {
      name: '0003-crlf-body.md',
      text: `${adrSource().text}One line.\r\nAnother line.\r\n`,
    };
    expect.soft(frontMatterProblems([crlfBody])).toEqual([]);
  });

  it('an ADR whose front matter is not valid YAML is reported by file name', () => {
    const good = adrSource({}, '0002-good.md');
    const unclosed = adrSource({ status: '[accepted' });

    // The file is reported once, with the parser's own message and not only the check's prefix.
    // The unclosed list swallows the lines below it, so no field is reported missing as well.
    expect
      .soft(frontMatterProblems([unclosed, good]))
      .toEqual([
        expect.stringMatching(
          /^0001-decision\.md: .*not valid YAML.*Flow sequence in block collection must be sufficiently indented and end with a \]/s,
        ),
      ]);
  });
});
