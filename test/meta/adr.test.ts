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

interface IndexRow {
  number: number;
  title: string;
  target: string;
  status: string;
  release: string;
  needsConfirmation: string;
}

const adrFolder = fileURLToPath(new URL('../../docs/adr/', import.meta.url));

// The test helpers read the same facts a person copies into the index: the first heading and the
// front matter of each ADR file.
function readAdrFiles(): AdrFile[] {
  return readdirSync(adrFolder)
    .filter((name) => /^\d{4}-.+\.md$/.test(name))
    .sort()
    .map((name) => {
      const text = readFileSync(`${adrFolder}${name}`, 'utf8');
      const [, frontMatter = '', body = ''] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text) ?? [];
      const fields = (parse(frontMatter) ?? {}) as Record<string, unknown>;
      return {
        name,
        number: Number.parseInt(name.slice(0, 4), 10),
        title: /^# (.+)$/m.exec(body)?.[1] ?? '',
        status: String(fields.status ?? ''),
        release: String(fields.release ?? ''),
        needsConfirmation: String(fields['needs-confirmation'] ?? ''),
      };
    });
}

// An index row is `| 0001 | [Title](0001-file.md) | status | release | needs confirmation |`.
function parseIndexRows(markdown: string): IndexRow[] {
  return markdown.split('\n').flatMap((line) => {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const [number = '', link = '', status = '', release = '', needsConfirmation = ''] = cells;
    const match = /^\[(.+)\]\((.+)\)$/.exec(link);
    if (cells.length !== 5 || !/^\d{4}$/.test(number) || !match) {
      return [];
    }
    return [
      {
        number: Number.parseInt(number, 10),
        title: match[1] ?? '',
        target: match[2] ?? '',
        status,
        release,
        needsConfirmation,
      },
    ];
  });
}

// The cells that the index copies from a file, with the name each one has in a problem message.
const copiedCells = [
  ['title', 'title'],
  ['status', 'status'],
  ['release', 'release'],
  ['needs-confirmation', 'needsConfirmation'],
] as const;

function indexProblems(files: AdrFile[], rows: IndexRow[]): string[] {
  return files.flatMap((file) => {
    const row = rows.find((candidate) => candidate.number === file.number);
    if (!row) {
      return [];
    }
    return copiedCells
      .filter(([, key]) => row[key] !== file[key])
      .map(
        ([cell, key]) =>
          `${file.name.slice(0, 4)}: ${cell} is "${row[key]}" in the index and "${file[key]}" in the file`,
      );
  });
}

function rowOf(file: AdrFile): IndexRow {
  const { name, ...cells } = file;
  return { ...cells, target: name };
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
});
