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

// `git ls-files`, not the file system: a link to a file that is not committed resolves here and
// breaks for everyone else.
function trackedFiles(): Set<string> {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`);
  }
  return new Set(result.stdout.split('\0').filter(Boolean));
}

function readDocFiles(tracked: Set<string>): MarkdownFile[] {
  return [...tracked]
    .filter((path) => documentGlobs.some((glob) => matchesGlob(path, glob)))
    .sort()
    .map((path) => ({ path, content: readFileSync(join(root, path), 'utf8') }));
}

// Lines inside a fenced code block are dropped. A fence closes on a line of the same character
// that is at least as long as the line that opened it.
function withoutFences(markdown: string): string {
  let open: { char: string; length: number } | undefined;
  return markdown
    .split('\n')
    .filter((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      const char = marker?.[1]?.charAt(0) ?? '';
      const length = marker?.[1]?.length ?? 0;
      if (!open) {
        open = marker ? { char, length } : undefined;
        return !marker;
      }
      if (char === open.char && length >= open.length && marker?.[2]?.trim() === '') {
        open = undefined;
      }
      return false;
    })
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

function linkProblems(files: MarkdownFile[], tracked: Set<string>): string[] {
  return files.flatMap((file) =>
    linkTargets(file.content).flatMap((target) => {
      const path = linkedPath(file.path, target);
      return path === undefined || exists(path, tracked)
        ? []
        : [`${file.path}: "${target}" does not resolve to a tracked file`];
    }),
  );
}

// docs/research is gitignored: internal notes live in a private companion repository and are cited
// by number, so a link to the folder would be dead for every other reader and run agent.
function researchLinkProblems(files: MarkdownFile[]): string[] {
  return files.flatMap((file) =>
    linkTargets(file.content).flatMap((target) => {
      const path = linkedPath(file.path, target);
      return path === 'docs/research' || path?.startsWith('docs/research/')
        ? [`${file.path}: "${target}" links into docs/research`]
        : [];
    }),
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

    const files = readDocFiles(trackedFiles());
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
    expect(researchLinkProblems(readDocFiles(trackedFiles()))).toEqual([]);
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
});
