import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, matchesGlob, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface MarkdownFile {
  path: string;
  content: string;
}

const root = fileURLToPath(new URL('../../', import.meta.url));

// The documents that must stay self-contained, because run agents read only tracked files.
const documentGlobs = ['docs/plan/*.md', 'docs/adr/*.md', 'docs/agents/**/*.md', 'GLOSSARY.md'];

// The files that tell an agent where things are. They may name a path that a later task creates.
const agentFileGlobs = ['AGENTS.md', 'CLAUDE.md', 'docs/agents/**/*.md'];

interface PlannedPath {
  path: string;
  // The plan id of the task that creates the path, such as E02-S08 or E00-S01-T02.
  task: string;
}

// Paths that the agent files name before they exist, each with the task in docs/plan that creates
// it. An entry stays until someone removes it, also after its task merges.
const plannedPaths: PlannedPath[] = [
  { path: 'packages', task: 'E00-S02-T01' },
  { path: 'packages/testing', task: 'E00-S02-T01' },
  { path: 'scripts/handoff/tests-changed.mjs', task: 'E00-S06-T01' },
  // release-please writes the file in its first release pull request.
  { path: 'CHANGELOG.md', task: 'E01-S03-T02' },
  { path: 'modules', task: 'E02-S01-T01' },
  { path: 'examples', task: 'E02-S01-T01' },
  { path: 'packages/sdk', task: 'E02-S01-T01' },
  { path: 'packages/contracts', task: 'E02-S01-T01' },
  { path: 'packages/web-sdk', task: 'E02-S01-T01' },
  { path: 'packages/web-build', task: 'E02-S01-T01' },
  { path: '.claude/launch.json', task: 'E02-S08-T05' },
  { path: 'packages/ui', task: 'E04-S01' },
  { path: 'modules/ai/server/model-call.ts', task: 'E13-S01' },
  { path: 'apps/docs/reference', task: 'E19-S02' },
];

// `git ls-files`, not the file system: a link to a file that is not committed resolves here and
// breaks for everyone else.
function trackedFiles(): Set<string> {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`);
  }
  return new Set(result.stdout.split('\0').filter(Boolean));
}

function readMarkdown(tracked: Set<string>, globs = documentGlobs): MarkdownFile[] {
  return [...tracked]
    .filter((path) => globs.some((glob) => matchesGlob(path, glob)))
    .sort()
    .map((path) => ({ path, content: readFileSync(join(root, path), 'utf8') }));
}

interface Line {
  text: string;
  // True for the lines of a fenced code block, fence lines included.
  fenced: boolean;
}

// A fence closes on a line of the same character that is at least as long as the line that
// opened it.
function markdownLines(markdown: string): Line[] {
  let open: { char: string; length: number } | undefined;
  return markdown.split('\n').map((text) => {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    const char = marker?.[1]?.charAt(0) ?? '';
    const length = marker?.[1]?.length ?? 0;
    if (!open) {
      open = marker ? { char, length } : undefined;
      return { text, fenced: Boolean(marker) };
    }
    if (char === open.char && length >= open.length && marker?.[2]?.trim() === '') {
      open = undefined;
    }
    return { text, fenced: true };
  });
}

function withoutFences(markdown: string): string {
  return markdownLines(markdown)
    .filter((line) => !line.fenced)
    .map((line) => line.text)
    .join('\n');
}

// A code span is a run of backticks, text without a blank line, and a run of the same length.
const codeSpan = /(`+)((?:(?!\n[ \t]*\n)[\s\S])*?)(?<!`)\1(?!`)/g;

function withoutCode(markdown: string): string {
  return withoutFences(markdown).replace(codeSpan, '');
}

const inlineLink =
  /\[(?:[^\]\\]|\\.)*\]\(\s*(<[^>\n]*>|(?:[^\s()]|\([^\s()]*\))*)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
const linkDefinition = /^ {0,3}\[[^\]\n]+\]:[ \t]*(<[^>\n]*>|\S+)/gm;

// The targets of inline links, images and reference definitions, in that order.
function linkTargets(markdown: string): string[] {
  const text = withoutCode(markdown);
  return [...text.matchAll(inlineLink), ...text.matchAll(linkDefinition)].map(([, target = '']) =>
    target.replace(/^<(.*)>$/, '$1'),
  );
}

// The repository path a link points at, or undefined for an external URL, a link within the page
// or an empty link. A link out of the repository gives a path that starts with `..`.
function linkedPath(from: string, target: string): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
    return undefined;
  }
  const [withoutQuery = ''] = target.split(/[?#]/);
  if (withoutQuery === '') {
    return undefined;
  }
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    // Not valid percent-encoding: take the text as written.
  }
  const joined = decoded.startsWith('/')
    ? decoded.slice(1)
    : posix.join(posix.dirname(from), decoded);
  return posix.normalize(joined).replace(/\/+$/, '');
}

// A directory exists when a tracked file sits below it.
function exists(path: string, tracked: Set<string>): boolean {
  return (
    path === '.' || tracked.has(path) || [...tracked].some((file) => file.startsWith(`${path}/`))
  );
}

// The links of a file that point into the repository, as written and as a repository path.
function repoLinks(file: MarkdownFile): { target: string; path: string }[] {
  return linkTargets(file.content).flatMap((target) => {
    const path = linkedPath(file.path, target);
    return path === undefined ? [] : [{ target, path }];
  });
}

function linkProblems(files: MarkdownFile[], tracked: Set<string>): string[] {
  return files.flatMap((file) =>
    repoLinks(file)
      .filter(({ path }) => !exists(path, tracked))
      .map(({ target }) => `${file.path}: "${target}" does not resolve to a tracked file`),
  );
}

// docs/research is gitignored: internal notes live in a private companion repository and are cited
// by number, so a link to the folder would be dead for every other reader and run agent.
function researchLinkProblems(files: MarkdownFile[]): string[] {
  return files.flatMap((file) =>
    repoLinks(file)
      .filter(({ path }) => path === 'docs/research' || path.startsWith('docs/research/'))
      .map(({ target }) => `${file.path}: "${target}" links into docs/research`),
  );
}

// A backticked token names a repository path when it has no glob or placeholder character and
// either ends in a file extension the repository uses or starts in one of its top-level folders.
// That keeps names such as `northmes/northmes`, `sql.raw` and `pnpm check` out.
const knownExtension = /\.(?:md|json|mjs|ts|yaml|yml|sh|graphql)$/;
const topLevelFolder =
  /^(?:apps|packages|modules|scripts|infra|test|e2e|examples|docs|\.github|\.claude|schema)\//;

function backtickedRepoPaths(markdown: string): string[] {
  const paths = [...withoutFences(markdown).matchAll(codeSpan)]
    .map(([, , body = '']) => body.trim())
    .filter(
      (token) =>
        !/[\s*?[\]{}<>]/.test(token) &&
        !token.startsWith('node_modules/') &&
        (knownExtension.test(token) || topLevelFolder.test(token)),
    )
    .map((token) => token.replace(/\/+$/, ''));
  return [...new Set(paths)];
}

// A planned entry names one path. If it covered what lies below it, `packages` would excuse every
// path under packages/ and the list would check nothing.
function pathProblems(
  files: MarkdownFile[],
  tracked: Set<string>,
  planned: PlannedPath[],
): string[] {
  return files.flatMap((file) =>
    backtickedRepoPaths(file.content)
      .filter((path) => !exists(path, tracked) && !planned.some((entry) => entry.path === path))
      .map(
        (path) =>
          `${file.path}: \`${path}\` is not in the repository and not on the planned-paths list`,
      ),
  );
}

const taskId = /^E\d{2}-S\d{2}(?:-T\d{2})?$/;

function plannedPathProblems(planned: PlannedPath[], planFiles: MarkdownFile[]): string[] {
  return planned.flatMap(({ path, task }) => {
    if (task === '') {
      return [`${path}: names no task`];
    }
    if (!taskId.test(task)) {
      return [`${path}: task "${task}" is not of the form E00-S01 or E00-S01-T02`];
    }
    // A task id ends where a `-` follows: E04-S01 is not the heading of E04-S01-T01.
    const heading = new RegExp(`^#{4,5} ${task}\\b(?!-)`, 'm');
    if (planFiles.some((file) => heading.test(file.content))) {
      return [];
    }
    const mentioned = planFiles.some((file) => new RegExp(`\\b${task}\\b`).test(file.content));
    return [
      mentioned
        ? `${path}: task "${task}" appears in docs/plan but has no heading there`
        : `${path}: task "${task}" appears in no docs/plan file`,
    ];
  });
}

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

function checklistNumbers(markdown: string): string[] {
  return sectionLines(markdown, 'ADRs needed by M0').flatMap((line) => {
    const number = /^- \[[ x]\] \[(\d{4})\]\[adr-\d{4}\]/.exec(line)?.[1];
    return number ? [number] : [];
  });
}

// The ADRs that the M0 row of the milestones table links.
function milestoneNumbers(markdown: string): string[] {
  const row = sectionLines(markdown, 'Milestones under option B').find((line) =>
    line.startsWith('| M0 |'),
  );
  return [...(row ?? '').matchAll(/\]\(\.\.\/adr\/(\d{4})-/g)].map(([, number = '']) => number);
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
  const listed = checklistNumbers(readme);
  const required = milestoneNumbers(roadmap);
  return [
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

function doc(path: string, ...lines: string[]): MarkdownFile {
  return { path, content: `${lines.join('\n')}\n` };
}

// Replaces text in a fixture, and fails when the text is not there, so that a case cannot pass by
// changing nothing.
function change(text: string, from: string, to: string): string {
  if (!text.includes(from)) {
    throw new Error(`the fixture does not contain ${JSON.stringify(from)}`);
  }
  return text.replace(from, to);
}

describe('doc links', () => {
  // The tracked files that the invented documents below may link to.
  const tracked = new Set([
    'GLOSSARY.md',
    'docs/adr/0001-record-decisions.md',
    'docs/plan/README.md',
    'docs/plan/14-roadmap.md',
    'docs/agents/handoff/README.md',
  ]);

  it('every relative link in docs/plan, docs/adr, docs/agents and GLOSSARY.md resolves', () => {
    const resolving = doc(
      'docs/plan/README.md',
      'Terms follow [the glossary](../../GLOSSARY.md) and [ADR 1][adr-1].',
      'The [roadmap](14-roadmap.md#milestones "Milestones") and [its query](14-roadmap.md?x=1).',
      'The [handoff folder](../agents/handoff/) and [the same without a slash](../agents/handoff).',
      'An image: ![diagram](../agents/handoff/README.md).',
      'Skipped: [site](https://example.com/missing), [mail](mailto:a@example.com), [here](#top).',
      'Skipped: `[in code](missing.md)` and the fence below.',
      '',
      '```markdown',
      '[in a fence](missing.md)',
      '```',
      '',
      '[adr-1]: ../adr/0001-record-decisions.md',
    );

    expect(linkProblems([resolving], tracked)).toEqual([]);

    const dead = doc(
      'docs/plan/README.md',
      'A dead [inline link](missing.md), a [folder with no tracked file](../design/),',
      'a [link out of the repository](../../../outside.md) and [a dead reference][gone].',
      '',
      '[gone]: ../adr/0099-gone.md',
    );

    expect(linkProblems([dead], tracked)).toEqual([
      'docs/plan/README.md: "missing.md" does not resolve to a tracked file',
      'docs/plan/README.md: "../design/" does not resolve to a tracked file',
      'docs/plan/README.md: "../../../outside.md" does not resolve to a tracked file',
      'docs/plan/README.md: "../adr/0099-gone.md" does not resolve to a tracked file',
    ]);

    // A link is relative to the file that holds it, and GLOSSARY.md sits in the root.
    const fromRoot = doc('GLOSSARY.md', '[an ADR](docs/adr/0001-record-decisions.md)');
    const fromAdr = doc('docs/adr/0001-record-decisions.md', '[the plan](../plan/README.md)');
    const wrongBase = doc('docs/adr/0001-record-decisions.md', '[the plan](docs/plan/README.md)');

    expect(linkProblems([fromRoot, fromAdr], tracked)).toEqual([]);
    expect(linkProblems([wrongBase], tracked)).toEqual([
      'docs/adr/0001-record-decisions.md: "docs/plan/README.md" does not resolve to a tracked file',
    ]);

    const files = readMarkdown(trackedFiles());
    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining(['GLOSSARY.md', 'docs/plan/README.md', 'docs/agents/domain.md']),
    );
    expect(linkProblems(files, trackedFiles())).toEqual([]);
  });

  it('no file in docs/plan, docs/adr, docs/agents or GLOSSARY.md links into the gitignored docs/research folder', () => {
    const linking = [
      doc(
        'docs/plan/07-production-planning.md',
        'See [the note](../research/note.md) and [the estimate][r].',
        '',
        '[r]: ../research/05-board.md#estimate',
      ),
      doc('docs/adr/0001-record-decisions.md', 'See [the folder](../research/).'),
      doc('docs/agents/handoff/README.md', 'See [a note](../../research/handoff.md).'),
      doc('GLOSSARY.md', 'See [a note](docs/research/glossary-note.md).'),
    ];

    expect(researchLinkProblems(linking)).toEqual([
      'docs/plan/07-production-planning.md: "../research/note.md" links into docs/research',
      'docs/plan/07-production-planning.md: "../research/05-board.md#estimate" links into docs/research',
      'docs/adr/0001-record-decisions.md: "../research/" links into docs/research',
      'docs/agents/handoff/README.md: "../../research/handoff.md" links into docs/research',
      'GLOSSARY.md: "docs/research/glossary-note.md" links into docs/research',
    ]);

    const clean = [
      doc(
        'docs/plan/README.md',
        'Internal research is cited as "internal research note 05", and `docs/research` is ignored.',
        'The folder docs/research is named in plain text. A [roadmap](14-roadmap.md), a',
        '[file that only sounds alike](../adr/research.md) and an',
        '[external page](https://example.com/docs/research/x.md) are fine.',
      ),
    ];

    expect(researchLinkProblems(clean)).toEqual([]);
    expect(researchLinkProblems(readMarkdown(trackedFiles()))).toEqual([]);
  });

  it('backticked repository paths are told apart from globs, commands and names', () => {
    const markdown = [
      'Paths: `docs/adr/template.md`, `.coderabbit.yaml`, `AGENTS.md`, `packages/testing`,',
      '`apps/docs/reference`, `modules/` and `docs/plan/` (a trailing slash is dropped).',
      'Twice: `packages/testing` again, and ``scripts/gen.mjs`` in a longer span.',
      'Not paths: `schema/*.graphql`, `modules/*/contracts`, `docs/adr/<name>.md`, `node_modules/x/y.md`,',
      '`northmes/northmes`, `sql.raw`, `github.reviewers_timeout`, `@northmes/source`, `pnpm check`',
      'and `test:`.',
      '',
      '```sh',
      'cat `docs/plan/in-a-fence.md`',
      '```',
    ].join('\n');

    expect(backtickedRepoPaths(markdown)).toEqual([
      'docs/adr/template.md',
      '.coderabbit.yaml',
      'AGENTS.md',
      'packages/testing',
      'apps/docs/reference',
      'modules',
      'docs/plan',
      'scripts/gen.mjs',
    ]);
  });

  it('every backticked repository path in AGENTS.md, CLAUDE.md and docs/agents exists or is on the planned-paths list', () => {
    const planned: PlannedPath[] = [{ path: 'apps/docs/reference', task: 'E19-S02' }];
    const named = doc(
      'docs/agents/domain.md',
      'Tracked: `GLOSSARY.md` and `docs/plan/README.md`. A folder with tracked files: `docs/adr`.',
      'Planned: `apps/docs/reference`.',
    );
    const typo = doc(
      'AGENTS.md',
      'Wrong: `docs/plan/READNE.md`, a `scripts/missing.mjs` and a `packages/sdk` that nobody planned.',
      'An entry names one path, so what lies below a planned folder needs its own: `apps/docs/reference/index.md`.',
      'Not paths: `pnpm check` and `schema/*.graphql`.',
      '',
      '```sh',
      'cat `docs/plan/in-a-fence.md`',
      '```',
    );

    expect(pathProblems([named], tracked, planned)).toEqual([]);
    expect(pathProblems([typo], tracked, planned)).toEqual([
      'AGENTS.md: `docs/plan/READNE.md` is not in the repository and not on the planned-paths list',
      'AGENTS.md: `scripts/missing.mjs` is not in the repository and not on the planned-paths list',
      'AGENTS.md: `packages/sdk` is not in the repository and not on the planned-paths list',
      'AGENTS.md: `apps/docs/reference/index.md` is not in the repository and not on the planned-paths list',
    ]);
    // A path stops being planned when the list drops it: the same file now reports it.
    expect(pathProblems([named], tracked, [])).toEqual([
      'docs/agents/domain.md: `apps/docs/reference` is not in the repository and not on the planned-paths list',
    ]);

    const agentFiles = readMarkdown(trackedFiles(), agentFileGlobs);
    expect(agentFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(['AGENTS.md', 'CLAUDE.md', 'docs/agents/domain.md']),
    );
    expect(pathProblems(agentFiles, trackedFiles(), plannedPaths)).toEqual([]);
  });

  it('every planned path names a task that docs/plan defines', () => {
    const plan = [
      doc(
        'docs/plan/14-roadmap.md',
        '##### E00-S01-T02 repo: Add pnpm check and the root scripts',
        '#### E19-S02 docs: Generate the configuration reference',
      ),
      doc('docs/plan/E02-walking-skeleton.md', '##### E02-S08-T05, #257 repo: Run the app'),
    ];
    const defined: PlannedPath[] = [
      { path: 'a-task.md', task: 'E00-S01-T02' },
      { path: 'a-story.md', task: 'E19-S02' },
      { path: 'a-numbered-task.md', task: 'E02-S08-T05' },
    ];
    const undefinedTasks: PlannedPath[] = [
      { path: 'no-task.md', task: '' },
      { path: 'an-epic.md', task: 'E19' },
      { path: 'prose.md', task: 'the docs epic' },
      { path: 'unknown-story.md', task: 'E99-S01' },
      // The plan has E00-S01-T02 but not this task.
      { path: 'unknown-task.md', task: 'E00-S01-T09' },
    ];

    expect(plannedPathProblems(defined, plan)).toEqual([]);
    expect(plannedPathProblems(undefinedTasks, plan)).toEqual([
      'no-task.md: names no task',
      'an-epic.md: task "E19" is not of the form E00-S01 or E00-S01-T02',
      'prose.md: task "the docs epic" is not of the form E00-S01 or E00-S01-T02',
      'unknown-story.md: task "E99-S01" appears in no docs/plan file',
      'unknown-task.md: task "E00-S01-T09" appears in no docs/plan file',
    ]);

    const planFiles = readMarkdown(trackedFiles(), ['docs/plan/*.md']);
    expect(planFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(['docs/plan/14-roadmap.md', 'docs/plan/E02-walking-skeleton.md']),
    );
    expect(plannedPathProblems(plannedPaths, planFiles)).toEqual([]);
  });

  it('a planned path names a task by its heading in docs/plan, not by a longer id or a mention', () => {
    const plan = [
      doc(
        'docs/plan/14-roadmap.md',
        '#### E19-S02 docs: Generate the configuration reference',
        '##### E04-S01-T01 ui: Design the tokens, contrast and component states (D1)',
        '##### E02-S08-T05, #257 repo: Run the app',
        'Blocked by E04-S01 and E13-S01, see the story E04-S01 above.',
      ),
    ];
    const headings: PlannedPath[] = [
      { path: 'a-story.md', task: 'E19-S02' },
      { path: 'a-task.md', task: 'E04-S01-T01' },
      { path: 'a-numbered-task.md', task: 'E02-S08-T05' },
    ];
    const noHeading: PlannedPath[] = [
      // Only the task E04-S01-T01 has a heading, and `\bE04-S01\b` matches inside its id.
      { path: 'the-story-of-a-task.md', task: 'E04-S01' },
      { path: 'a-mention.md', task: 'E13-S01' },
    ];

    expect(plannedPathProblems(headings, plan)).toEqual([]);
    expect(plannedPathProblems(noHeading, plan)).toEqual([
      'the-story-of-a-task.md: task "E04-S01" appears in docs/plan but has no heading there',
      'a-mention.md: task "E13-S01" appears in docs/plan but has no heading there',
    ]);
  });

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
    ];
    for (const { name, readme: drifted, problems } of cases) {
      expect.soft(readmeDrift(drifted, roadmap, adrs), name).toEqual(problems);
    }

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
