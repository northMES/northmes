import { readFileSync } from 'node:fs';
import { join, matchesGlob } from 'node:path';
import { describe, expect, it } from 'vitest';
import { linkedPath, markdownLines, root, trackedFiles } from './docs.ts';

interface MarkdownFile {
  path: string;
  content: string;
}

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

function readMarkdown(tracked: Set<string>, globs = documentGlobs): MarkdownFile[] {
  return [...tracked]
    .filter((path) => globs.some((glob) => matchesGlob(path, glob)))
    .sort()
    .map((path) => ({ path, content: readFileSync(join(root, path), 'utf8') }));
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

function doc(path: string, ...lines: string[]): MarkdownFile {
  return { path, content: `${lines.join('\n')}\n` };
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

  it('a line that opens with three backticks and has a backtick later opens no code fence', () => {
    // CommonMark: the info string of a backtick fence has no backtick, so this is inline code.
    const inline = doc(
      'docs/plan/README.md',
      '```not a fence``` is inline code, and so is ````also not````.',
      '[a dead link after it](missing.md) and `docs/agents/missing.md` in a span.',
    );
    // A tilde fence may carry a backtick in its info string, and a backtick fence still opens.
    const fences = doc(
      'docs/plan/README.md',
      '~~~ sh `x`',
      '[in a tilde fence](hidden.md)',
      '~~~',
      '```sh',
      '[in a backtick fence](hidden.md)',
      '```',
      '[a dead link after the fences](missing.md)',
    );

    expect(linkProblems([inline], tracked)).toEqual([
      'docs/plan/README.md: "missing.md" does not resolve to a tracked file',
    ]);
    expect(backtickedRepoPaths(inline.content)).toEqual(['docs/agents/missing.md']);
    expect(linkProblems([fences], tracked)).toEqual([
      'docs/plan/README.md: "missing.md" does not resolve to a tracked file',
    ]);
  });

  it('a footnote definition is not a link definition', () => {
    const footnotes = doc(
      'docs/plan/README.md',
      'A claim.[^1] And another.[^note]',
      '',
      '[^1]: Some words about the claim, which are not a path.',
      '[^note]: https://example.com/page',
      '[a link definition]: missing.md',
    );

    expect(linkProblems([footnotes], tracked)).toEqual([
      'docs/plan/README.md: "missing.md" does not resolve to a tracked file',
    ]);
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
});
