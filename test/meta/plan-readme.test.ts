import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { describe, expect, it } from 'vitest';
import { linkedPath, markdownLines, root, trackedFiles } from './docs.ts';

// The lines under a `## ` heading, up to the next one outside a code fence. Fenced lines stay in,
// because the roadmap keeps the ledger header in a fence.
function sectionLines(markdown: string, heading: string): string[] {
  const lines = markdownLines(markdown);
  const start = lines.findIndex((line) => !line.fenced && line.text === `## ${heading}`);
  if (start === -1) {
    return [];
  }
  const next = lines.findIndex(
    (line, index) => index > start && !line.fenced && line.text.startsWith('## '),
  );
  return lines.slice(start + 1, next === -1 ? undefined : next).map((line) => line.text);
}

// Each run of table lines is a table of rows of trimmed cells. The separator row is left out.
function tablesIn(lines: string[]): string[][][] {
  const tables: string[][][] = [];
  let current: string[][] | undefined;
  for (const line of lines) {
    if (!line.startsWith('|')) {
      current = undefined;
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) {
      continue;
    }
    if (!current) {
      current = [];
      tables.push(current);
    }
    current.push(cells);
  }
  return tables;
}

// Compares two tables row by row, keyed on the first cell.
function tableDrift(label: string, readme: string[][], roadmap: string[][]): string[] {
  const first = (row: string[]) => row[0] ?? '';
  const readmeKeys = readme.map(first);
  const roadmapKeys = roadmap.map(first);
  const problems = [
    ...roadmap
      .filter((row) => !readmeKeys.includes(first(row)))
      .map((row) => `${label}: "${first(row)}" is in 14-roadmap.md and missing from README.md`),
    ...readme
      .filter((row) => !roadmapKeys.includes(first(row)))
      .map((row) => `${label}: "${first(row)}" is in README.md and not in 14-roadmap.md`),
    ...readme
      .filter((row) => {
        const other = roadmap.find((candidate) => first(candidate) === first(row));
        return other && JSON.stringify(other) !== JSON.stringify(row);
      })
      .map((row) => `${label}: "${first(row)}" differs between README.md and 14-roadmap.md`),
  ];
  const shared = (keys: string[], other: string[]) => keys.filter((key) => other.includes(key));
  const sameOrder =
    JSON.stringify(shared(readmeKeys, roadmapKeys)) ===
    JSON.stringify(shared(roadmapKeys, readmeKeys));
  return problems.length > 0 || sameOrder
    ? problems
    : [`${label}: README.md lists them in another order than 14-roadmap.md`];
}

// The ledger header is the table that starts with Week ending and has more than the two columns of
// the column legend.
function ledgerHeader(lines: string[]): string[] | undefined {
  return tablesIn(lines)
    .map((table) => table[0] ?? [])
    .find((header) => header[0] === 'Week ending' && header.length > 2);
}

// Each item reads `- [ ] [0004][adr-0004] title`: the label shows the number, and the reference
// picks the link definition that the rendered link follows.
function checklistItems(markdown: string): { number: string; reference: string }[] {
  return sectionLines(markdown, 'ADRs needed by M0').flatMap((line) => {
    const match = /^- \[[ x]\] \[(\d{4})\]\[adr-(\d{4})\]/.exec(line);
    return match ? [{ number: match[1] ?? '', reference: match[2] ?? '' }] : [];
  });
}

// The ADRs that the M0 row of the milestones table links, each once.
function milestoneNumbers(markdown: string): string[] {
  const row = sectionLines(markdown, 'Milestones under option B').find((line) =>
    line.startsWith('| M0 |'),
  );
  const numbers = [...(row ?? '').matchAll(/\]\(\.\.\/adr\/(\d{4})-/g)].map(
    ([, number = '']) => number,
  );
  return [...new Set(numbers)];
}

function checklistLinkProblems(readme: string, numbers: string[], tracked: Set<string>): string[] {
  return numbers.flatMap((number) => {
    const target = new RegExp(`^\\[adr-${number}\\]:[ \\t]*(\\S+)`, 'm').exec(readme)?.[1];
    if (target === undefined) {
      return [`M0 checklist: ADR ${number} has no [adr-${number}] link definition in README.md`];
    }
    const path = linkedPath('docs/plan/README.md', target) ?? target;
    if (!tracked.has(path)) {
      return [`M0 checklist: ADR ${number} links to ${path}, which is not tracked`];
    }
    if (!/^docs\/adr\/\d{4}-[^/]+\.md$/.test(path)) {
      return [
        `M0 checklist: ADR ${number} links to ${path}, which is not a Markdown ADR under docs/adr`,
      ];
    }
    return posix.basename(path).startsWith(`${number}-`)
      ? []
      : [`M0 checklist: ADR ${number} links to ${path}, a file with another number`];
  });
}

// The persona list and the epic order. The README keeps the first two columns of the roadmap's
// epic table: the epic and its title.
function personaAndEpicDrift(readme: string, roadmap: string): string[] {
  const firstTable = (markdown: string, heading: string) =>
    tablesIn(sectionLines(markdown, heading))[0]?.map((row) => row.slice(0, 2));
  const checks = [
    { label: 'personas', readmeHeading: 'Personas', roadmapHeading: 'Personas' },
    {
      label: 'epic order',
      readmeHeading: 'Epic order',
      roadmapHeading: 'Epics in dependency order',
    },
  ];
  return checks.flatMap(({ label, readmeHeading, roadmapHeading }) => {
    const own = firstTable(readme, readmeHeading);
    const theirs = firstTable(roadmap, roadmapHeading);
    return own && theirs
      ? tableDrift(label, own, theirs)
      : [`${label}: ${own ? '14-roadmap.md' : 'README.md'} has no table`];
  });
}

function ledgerHeaderDrift(readme: string, roadmap: string): string[] {
  const own = ledgerHeader(sectionLines(readme, 'Weekly ledger'));
  const theirs = ledgerHeader(sectionLines(roadmap, 'The weekly ledger row'));
  if (!own || !theirs) {
    return [`ledger header: ${own ? '14-roadmap.md' : 'README.md'} has no ledger table`];
  }
  return own.join(' | ') === theirs.join(' | ')
    ? []
    : [
        `ledger header: README.md has "${own.join(' | ')}" and 14-roadmap.md has "${theirs.join(' | ')}"`,
      ];
}

function checklistDrift(readme: string, roadmap: string, tracked: Set<string>): string[] {
  const all = checklistItems(readme);
  // An ADR listed twice could carry two states. It is reported once, and its first item stands for
  // it in the checks below.
  const numbers = all.map(({ number }) => number);
  const items = all.filter(({ number }, index) => numbers.indexOf(number) === index);
  const listed = items.map(({ number }) => number);
  const required = milestoneNumbers(roadmap);
  return [
    ...listed
      .filter((number) => numbers.lastIndexOf(number) !== numbers.indexOf(number))
      .map(
        (number) => `M0 checklist: ADR ${number} is listed more than once in README.md's checklist`,
      ),
    ...required
      .filter((number) => !listed.includes(number))
      .map(
        (number) =>
          `M0 checklist: ADR ${number} is in the M0 row of 14-roadmap.md and missing from README.md's checklist`,
      ),
    ...listed
      .filter((number) => !required.includes(number))
      .map(
        (number) =>
          `M0 checklist: ADR ${number} is in README.md's checklist and not in the M0 row of 14-roadmap.md`,
      ),
    ...items
      .filter(({ number, reference }) => number !== reference)
      .map(
        ({ number, reference }) =>
          `M0 checklist: item [${number}] references [adr-${reference}] and not [adr-${number}]`,
      ),
    ...checklistLinkProblems(readme, listed, tracked),
  ];
}

// The README is the source for the persona list, the epic order, the ledger header and the M0
// checklist, and the roadmap repeats them for the session that shapes issues. Both must agree.
function readmeDrift(readme: string, roadmap: string, tracked: Set<string>): string[] {
  return [
    ...personaAndEpicDrift(readme, roadmap),
    ...ledgerHeaderDrift(readme, roadmap),
    ...checklistDrift(readme, roadmap, tracked),
  ];
}

// Replaces text in a fixture, and fails when the text is not there, so that a case cannot pass by
// changing nothing.
function change(text: string, from: string, to: string): string {
  if (!text.includes(from)) {
    throw new Error(`the fixture does not contain ${JSON.stringify(from)}`);
  }
  return text.replace(from, to);
}

describe('plan README', () => {
  it('docs/plan/README.md holds the ledger header, persona table, epic order and M0 ADR checklist that 14-roadmap.md states', () => {
    const roadmap = [
      '# Roadmap',
      '',
      '## Personas',
      '',
      '| Persona | Who |',
      '|---|---|',
      '| Planner | Plans orders. |',
      '| Operator | Reports at a station. |',
      '',
      '## Milestones under option B',
      '',
      '| Checkpoint | Date | What must hold | What it decides |',
      '|---|---|---|---|',
      '| Day 1 | Thu 2026-10-15 | Sent. | |',
      '| M0 | Fri 2026-10-30 | Accepted: [0029](../adr/0029-drafts.md), [0004](../adr/0004-tooling.md) and [0003](../adr/0003-module.md). | Decisions. |',
      '',
      '## The weekly ledger row',
      '',
      '| Column | Meaning |',
      '|---|---|',
      "| Week ending | The Friday's date. |",
      '',
      '```markdown',
      '| Week ending | Working days | Merged tasks | Notes |',
      '|---|---|---|---|',
      '```',
      '',
      '## Epics in dependency order',
      '',
      '| Epic | Title | Estimate | Depends on |',
      '|---|---|---|---|',
      '| E00 | repo: Make the repository ready | Not estimated | none |',
      '| E01 | platform: Settle the first decisions | About 7 | E00-S05 |',
      '',
      '### E00 repo: Make the repository ready',
      '',
      '```markdown',
      '## Goal',
      '| Week ending | A brief holds this table, which is not the ledger |',
      '```',
    ].join('\n');
    const readme = [
      '# NorthMES plan',
      '',
      '## Personas',
      '',
      '| Persona | Who |',
      '|---|---|',
      '| Planner | Plans orders. |',
      '| Operator | Reports at a station. |',
      '',
      '## Weekly ledger',
      '',
      '| Week ending | Working days | Merged tasks | Notes |',
      '|---|---|---|---|',
      '| 2026-10-16 | | | |',
      '',
      '## Epic order',
      '',
      '| Epic | Title |',
      '|---|---|',
      '| E00 | repo: Make the repository ready |',
      '| E01 | platform: Settle the first decisions |',
      '',
      '## ADRs needed by M0',
      '',
      'E02 needs:',
      '',
      '- [ ] [0003][adr-0003] module package (proposed)',
      '- [x] [0004][adr-0004] tooling (accepted)',
      '',
      'E03 needs:',
      '',
      '- [ ] [0029][adr-0029] drafts (accepted; needs-confirmation: product owner)',
      '',
      '[adr-0003]: ../adr/0003-module.md',
      '[adr-0004]: ../adr/0004-tooling.md',
      '[adr-0029]: ../adr/0029-drafts.md',
    ].join('\n');
    const adrs = new Set([
      'docs/adr/0003-module.md',
      'docs/adr/0004-tooling.md',
      'docs/adr/0029-drafts.md',
      'docs/adr/0099-invented.md',
      // Tracked files that are not Markdown ADRs under docs/adr, and carry an ADR's number.
      'docs/plan/0004-not-an-adr.md',
      'docs/adr/0004-notes.txt',
    ]);

    expect(readmeDrift(readme, roadmap, adrs)).toEqual([]);

    // Each case changes the README in one place and must report exactly that drift.
    const cases: { name: string; readme: string; problems: string[] }[] = [
      {
        name: 'a persona row that differs',
        readme: change(readme, 'Reports at a station.', 'Reports elsewhere.'),
        problems: ['personas: "Operator" differs between README.md and 14-roadmap.md'],
      },
      {
        name: 'a persona that is missing',
        readme: change(readme, '| Operator | Reports at a station. |\n', ''),
        problems: ['personas: "Operator" is in 14-roadmap.md and missing from README.md'],
      },
      {
        name: 'a persona that the roadmap does not have',
        readme: change(readme, '| Planner |', '| Visitor | Looks around. |\n| Planner |'),
        problems: ['personas: "Visitor" is in README.md and not in 14-roadmap.md'],
      },
      {
        name: 'an epic that is missing',
        readme: change(readme, '| E01 | platform: Settle the first decisions |\n', ''),
        problems: ['epic order: "E01" is in 14-roadmap.md and missing from README.md'],
      },
      {
        name: 'an epic with another title',
        readme: change(readme, 'Settle the first decisions', 'Settle decisions'),
        problems: ['epic order: "E01" differs between README.md and 14-roadmap.md'],
      },
      {
        name: 'epics in another order',
        readme: change(
          readme,
          '| E00 | repo: Make the repository ready |\n| E01 | platform: Settle the first decisions |',
          '| E01 | platform: Settle the first decisions |\n| E00 | repo: Make the repository ready |',
        ),
        problems: ['epic order: README.md lists them in another order than 14-roadmap.md'],
      },
      {
        // Without its separator row Markdown renders the lines as text, not as a table.
        name: 'a persona table without its separator row',
        readme: change(readme, '| Persona | Who |\n|---|---|\n', '| Persona | Who |\n'),
        problems: ['personas: README.md has no table'],
      },
      {
        name: 'an epic table whose separator row is not the second row',
        readme: change(readme, '| Epic | Title |\n|---|---|\n', '| Epic | Title |\n\n|---|---|\n'),
        problems: ['epic order: README.md has no table'],
      },
      {
        name: 'a ledger table without its separator row',
        readme: change(
          readme,
          '| Week ending | Working days | Merged tasks | Notes |\n|---|---|---|---|\n',
          '| Week ending | Working days | Merged tasks | Notes |\n',
        ),
        problems: ['ledger header: README.md has no ledger table'],
      },
      {
        name: 'a ledger header with a column less',
        readme: change(readme, '| Working days | Merged tasks |', '| Working days |'),
        problems: [
          'ledger header: README.md has "Week ending | Working days | Notes" and 14-roadmap.md has "Week ending | Working days | Merged tasks | Notes"',
        ],
      },
      {
        name: 'a checklist that lacks an ADR from the M0 row',
        readme: change(readme, '- [x] [0004][adr-0004] tooling (accepted)\n', ''),
        problems: [
          "M0 checklist: ADR 0004 is in the M0 row of 14-roadmap.md and missing from README.md's checklist",
        ],
      },
      {
        name: 'a checklist with an ADR that the M0 row does not have',
        readme: change(
          readme,
          '\n[adr-0003]',
          '- [ ] [0099][adr-0099] invented\n\n[adr-0099]: ../adr/0099-invented.md\n[adr-0003]',
        ),
        problems: [
          "M0 checklist: ADR 0099 is in README.md's checklist and not in the M0 row of 14-roadmap.md",
        ],
      },
      {
        name: 'a checklist item without a link definition',
        readme: change(readme, '[adr-0004]: ../adr/0004-tooling.md\n', ''),
        problems: ['M0 checklist: ADR 0004 has no [adr-0004] link definition in README.md'],
      },
      {
        name: 'a checklist link to a file that is not tracked',
        readme: change(readme, '0004-tooling.md', '0004-gone.md'),
        problems: ['M0 checklist: ADR 0004 links to docs/adr/0004-gone.md, which is not tracked'],
      },
      {
        name: 'a checklist link to the file of another ADR',
        readme: change(
          readme,
          '[adr-0004]: ../adr/0004-tooling.md',
          '[adr-0004]: ../adr/0003-module.md',
        ),
        problems: [
          'M0 checklist: ADR 0004 links to docs/adr/0003-module.md, a file with another number',
        ],
      },
      {
        name: 'a checklist link to a tracked file outside docs/adr',
        readme: change(
          readme,
          '[adr-0004]: ../adr/0004-tooling.md',
          '[adr-0004]: 0004-not-an-adr.md',
        ),
        problems: [
          'M0 checklist: ADR 0004 links to docs/plan/0004-not-an-adr.md, which is not a Markdown ADR under docs/adr',
        ],
      },
      {
        name: 'a checklist link to a tracked file in docs/adr that is not Markdown',
        readme: change(
          readme,
          '[adr-0004]: ../adr/0004-tooling.md',
          '[adr-0004]: ../adr/0004-notes.txt',
        ),
        problems: [
          'M0 checklist: ADR 0004 links to docs/adr/0004-notes.txt, which is not a Markdown ADR under docs/adr',
        ],
      },
      {
        name: 'a checklist item whose reference carries the number of another ADR',
        readme: change(readme, '[0004][adr-0004]', '[0004][adr-0003]'),
        problems: ['M0 checklist: item [0004] references [adr-0003] and not [adr-0004]'],
      },
      {
        name: 'a checklist item whose reference has no definition',
        readme: change(readme, '[0004][adr-0004]', '[0004][adr-0099]'),
        problems: ['M0 checklist: item [0004] references [adr-0099] and not [adr-0004]'],
      },
    ];
    for (const { name, readme: drifted, problems } of cases) {
      expect.soft(readmeDrift(drifted, roadmap, adrs), name).toEqual(problems);
    }

    // The roadmap's tables need their separator rows too.
    expect(
      readmeDrift(
        readme,
        change(roadmap, '| Persona | Who |\n|---|---|\n', '| Persona | Who |\n'),
        adrs,
      ),
    ).toEqual(['personas: 14-roadmap.md has no table']);

    // An ADR listed twice in the checklist is reported once, however the two items differ, and its
    // link problems are not repeated.
    expect(
      readmeDrift(
        change(
          readme,
          '- [x] [0004][adr-0004] tooling (accepted)',
          '- [x] [0004][adr-0004] tooling (accepted)\n- [ ] [0004][adr-0004] tooling again',
        ),
        roadmap,
        adrs,
      ),
    ).toEqual(["M0 checklist: ADR 0004 is listed more than once in README.md's checklist"]);
    expect(
      readmeDrift(
        change(
          change(readme, '0004-tooling.md', '0004-gone.md'),
          '- [x] [0004][adr-0004] tooling (accepted)',
          '- [x] [0004][adr-0004] tooling (accepted)\n- [x] [0004][adr-0004] tooling again',
        ),
        roadmap,
        adrs,
      ),
    ).toEqual([
      "M0 checklist: ADR 0004 is listed more than once in README.md's checklist",
      'M0 checklist: ADR 0004 links to docs/adr/0004-gone.md, which is not tracked',
    ]);

    // An ADR that the M0 row links twice is reported once.
    expect(
      readmeDrift(
        change(readme, '- [ ] [0003][adr-0003] module package (proposed)\n', ''),
        change(
          roadmap,
          'and [0003](../adr/0003-module.md).',
          'and [0003](../adr/0003-module.md), again [0003](../adr/0003-module.md).',
        ),
        adrs,
      ),
    ).toEqual([
      "M0 checklist: ADR 0003 is in the M0 row of 14-roadmap.md and missing from README.md's checklist",
    ]);

    // A README that lost its sections reports each one, instead of passing for lack of rows.
    expect(readmeDrift('# NorthMES plan\n', roadmap, adrs)).toEqual([
      'personas: README.md has no table',
      'epic order: README.md has no table',
      'ledger header: README.md has no ledger table',
      "M0 checklist: ADR 0029 is in the M0 row of 14-roadmap.md and missing from README.md's checklist",
      "M0 checklist: ADR 0004 is in the M0 row of 14-roadmap.md and missing from README.md's checklist",
      "M0 checklist: ADR 0003 is in the M0 row of 14-roadmap.md and missing from README.md's checklist",
    ]);

    expect(
      readmeDrift(
        readFileSync(join(root, 'docs/plan/README.md'), 'utf8'),
        readFileSync(join(root, 'docs/plan/14-roadmap.md'), 'utf8'),
        trackedFiles(),
      ),
    ).toEqual([]);
  });
});
