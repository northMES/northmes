// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkPrDocs, parseDocsPaths } from './pr-docs.mjs';

const script = fileURLToPath(new URL('./pr-docs.mjs', import.meta.url));

// A mapping in the shape of .github/docs-paths: a pattern, then its pages or none yet.
const docsPaths = `# The surfaces and their pages
/apps/backend/src/http/ apps/docs/api.mdx apps/docs/install.mdx
/packages/sdk/ none yet
/modules/core/ none yet
/modules/core/contracts/ none yet
/apps/backend/src/boot/config-file.ts none yet
`;

// The template's Docs section as a pull request gets it, with only the template's comment.
const templateComment =
  '<!-- ADR 0088: the pages under apps/docs this change updates, or "none" with a reason. -->';

function body(docs: string | undefined) {
  const section = docs === undefined ? '' : `## Docs\n\n${docs}\n\n`;
  return `## What changes\nAdds the check.\n\nCloses #842\n\n## Security\nNone: the script reads the body.\n\n${section}## Validation impact\nNone.\n`;
}

// A pull request from a branch in this repository by a person, with the given Docs section and
// changed files.
function pullRequest(docs: string | undefined, paths: string[] = ['apps/web/src/app.tsx']) {
  return {
    body: body(docs),
    author: 'a-contributor',
    headRef: 'ci/pr-docs',
    fromFork: false,
    changes: paths.map((path) => ({ status: 'M', path })),
    docsPaths,
  };
}

const repositories: string[] = [];

afterEach(() => {
  for (const repository of repositories.splice(0)) rmSync(repository, { recursive: true });
});

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
}

function write(repository: string, path: string, content: string) {
  mkdirSync(dirname(join(repository, path)), { recursive: true });
  writeFileSync(join(repository, path), content);
}

// A repository with .github/docs-paths, a base commit and a pull request commit on top, as CI checks
// out the pull request's merge commit with its first parent, the base branch.
function repositoryWith(change: (repository: string) => void) {
  const repository = mkdtempSync(join(tmpdir(), 'pr-docs-'));
  repositories.push(repository);
  git(repository, 'init', '--quiet');
  write(repository, '.github/docs-paths', docsPaths);
  write(repository, 'packages/sdk/src/index.ts', 'export const a = 1;\n');
  git(repository, 'add', '--all');
  git(repository, '-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-qm', 'base');
  change(repository);
  git(repository, 'add', '--all');
  git(repository, '-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-qm', 'pr');
  return repository;
}

// Runs the script as the PR / pr docs job does, with the pull request in the environment.
function run(repository: string, pullRequestEnv: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    cwd: repository,
    env: { PATH: process.env.PATH, ...pullRequestEnv },
    encoding: 'utf8',
  });
}

describe('PR / pr docs', () => {
  it('ADR0088 a body without a Docs section fails', () => {
    const result = checkPrDocs(pullRequest(undefined));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/## Docs/);
  });

  it('ADR0088 a body whose Docs section is empty or holds only the template comment fails', () => {
    expect(checkPrDocs(pullRequest('')).ok).toBe(false);
    expect(checkPrDocs(pullRequest(templateComment)).ok).toBe(false);
    expect(checkPrDocs({ ...pullRequest(undefined), body: 'Closes #1\n\n## Docs' }).ok).toBe(false);
  });

  it('ADR0088 a Docs section that says none without a reason fails', () => {
    for (const none of ['None', 'none.', 'N/A', '- None', '- **None**', '_none_', 'None:']) {
      expect(checkPrDocs(pullRequest(none)).ok, none).toBe(false);
    }
  });

  it('ADR0088 none with a reason passes when the pull request touches no mapped surface', () => {
    const notes = [
      'None: the change edits a screen, which the use guides describe in the docs task of the epic.',
      `${templateComment}\nNone, because the pull request changes a test only.`,
    ];

    for (const note of notes) {
      expect(
        checkPrDocs(pullRequest(note, ['apps/web/src/app.tsx', 'e2e/app.spec.ts'])).ok,
        note,
      ).toBe(true);
    }
  });

  it('ADR0088 a diff that touches a mapped surface with a none that does not name it fails, and the message names the surface', () => {
    const result = checkPrDocs(
      pullRequest('None: the behaviour is unchanged.', [
        'packages/sdk/src/index.ts',
        'apps/web/src/app.tsx',
      ]),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('packages/sdk/');
    expect(result.message).not.toContain('apps/web');
  });

  it('ADR0088 a none that names one of two touched surfaces fails and names the other', () => {
    const result = checkPrDocs(
      pullRequest('None: packages/sdk/ only gets a new type, which the schema describes.', [
        'packages/sdk/src/index.ts',
        'apps/backend/src/http/public-api/public-api.module.ts',
      ]),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('apps/backend/src/http/');
    expect(result.message).not.toContain('packages/sdk/');
  });

  it('ADR0088 a none whose reason names the touched surface, with or without its slash, or by a changed file, passes', () => {
    const reasons = [
      'None yet for packages/sdk/: the surface has no page (ADR 0088).',
      'None: packages/sdk only renames an internal type.',
      'None: Packages/SDK only renames an internal type.',
      'None: packages/sdk/src/index.ts only renames an internal type.',
    ];

    for (const reason of reasons) {
      expect(checkPrDocs(pullRequest(reason, ['packages/sdk/src/index.ts'])).ok, reason).toBe(true);
    }
    expect(
      checkPrDocs(
        pullRequest('None: apps/backend/src/boot/config-file.ts gets a comment only.', [
          'apps/backend/src/boot/config-file.ts',
        ]),
      ).ok,
    ).toBe(true);
  });

  // The contracts of a module lie inside the module, so one name covers both surfaces.
  it('ADR0088 naming a nested surface names the surface it lies in', () => {
    const result = checkPrDocs(
      pullRequest(
        'None: modules/core/contracts/ exports one more type that the schema describes.',
        ['modules/core/contracts/src/index.ts'],
      ),
    );

    expect(result.ok).toBe(true);
  });

  it('ADR0088 a deleted or renamed file under a mapped surface touches it', () => {
    const changes = [
      { status: 'D', path: 'packages/sdk/src/old.ts' },
      { status: 'R100', path: 'packages/sdk/src/new.ts', from: 'packages/sdk/src/old-name.ts' },
    ];
    const result = checkPrDocs({ ...pullRequest('None: nothing changed.'), changes });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('packages/sdk/');
  });

  // A file moved out of a surface changes that surface too: the SDK loses an export.
  it('ADR0088 a file renamed out of a mapped surface touches the surface it came from', () => {
    const changes = [
      {
        status: 'R090',
        path: 'apps/backend/src/http/problem.ts',
        from: 'packages/sdk/src/rest/problem.ts',
      },
    ];
    const result = checkPrDocs({
      ...pullRequest('None: apps/backend/src/http/ gains a helper moved in from the SDK.'),
      changes,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('packages/sdk/');
    expect(result.message).not.toContain('apps/backend/src/http/');
    expect(
      checkPrDocs({
        ...pullRequest('None: packages/sdk/src/rest/problem.ts moves to apps/backend/src/http/.'),
        changes,
      }).ok,
    ).toBe(true);
  });

  // packages/sdk-extras is not packages/sdk: the name ends where the surface's path ends.
  it('ADR0088 a surface is named by its whole path, not by a longer path that starts the same', () => {
    const result = checkPrDocs(
      pullRequest('None: packages/sdk-extras only gets a comment.', ['packages/sdk/src/index.ts']),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('packages/sdk/');
  });

  it('ADR0088 a Docs section that names changed pages passes when the pull request changes a page under apps/docs', () => {
    const result = checkPrDocs(
      pullRequest('apps/docs/api.mdx: the limits table gets the new cost.', [
        'apps/backend/src/http/public-api/public-api.module.ts',
        'apps/docs/api.mdx',
      ]),
    );

    expect(result.ok).toBe(true);
  });

  // ADR 0088: a change under docs/ (an ADR, a plan file) describes a decision, not the product.
  it('ADR0088 a change under docs/ alone is not a docs change', () => {
    const claimed = checkPrDocs(
      pullRequest('docs/adr/0088-developer-documentation.md describes the new surface.', [
        'packages/sdk/src/index.ts',
        'docs/adr/0088-developer-documentation.md',
      ]),
    );
    const adrOnly = checkPrDocs(
      pullRequest('None: an ADR only, which is no page.', ['docs/adr/0089-something.md']),
    );

    expect(claimed.ok).toBe(false);
    expect(claimed.message).toMatch(/apps\/docs/);
    expect(claimed.message).toMatch(/docs\//);
    expect(adrOnly.ok).toBe(true);
  });

  it('ADR0088 a Docs section that names changed pages fails when no page under apps/docs changed', () => {
    const result = checkPrDocs(
      pullRequest('The README of packages/sdk describes the new export.', [
        'packages/sdk/README.md',
      ]),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/apps\/docs/);
  });

  // The message says both ways out, because a section that declines in other words ("No page
  // changes: ...") lands here too.
  it('ADR0088 a Docs section that neither starts with none nor comes with a page change is told both ways out', () => {
    const result = checkPrDocs(pullRequest('No page changes: the type is internal.'));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/start.*"None"/i);
    expect(result.message).toMatch(/apps\/docs/);
  });

  it('ADR0088 none in code or emphasis marks still says none', () => {
    const notes = [
      '`None`: an internal type.',
      '**None**: an internal type.',
      '_None_, an internal type.',
    ];

    for (const none of notes) {
      expect(checkPrDocs(pullRequest(none)).ok, none).toBe(true);
    }
  });

  // GitHub renders a fenced block as code, so a heading in it is no section.
  it('ADR0088 a Docs heading inside a fenced code block is no section', () => {
    const fenced = 'Closes #1\n\n```md\n## Docs\nNone: docs only.\n```\n';

    expect(checkPrDocs({ ...pullRequest(undefined), body: fenced }).ok).toBe(false);
  });

  // Renovate and release-please write their own bodies, as PR / pr security allows.
  it('ADR0088 a Renovate or release-please pull request passes without the section', () => {
    const base = { ...pullRequest(undefined, ['packages/sdk/package.json']), body: 'Updates pg.' };

    expect(checkPrDocs({ ...base, author: 'renovate[bot]' }).ok).toBe(true);
    expect(checkPrDocs({ ...base, headRef: 'release-please--branches--main' }).ok).toBe(true);
    expect(
      checkPrDocs({ ...base, headRef: 'release-please--branches--main', fromFork: true }).ok,
    ).toBe(false);
  });

  it('ADR0088 parseDocsPaths reads a pattern and its pages or none yet, and skips comments and blank lines', () => {
    const entries = parseDocsPaths(docsPaths);

    expect(entries.map(({ pattern, pages }) => [pattern, pages])).toEqual([
      ['/apps/backend/src/http/', ['apps/docs/api.mdx', 'apps/docs/install.mdx']],
      ['/packages/sdk/', []],
      ['/modules/core/', []],
      ['/modules/core/contracts/', []],
      ['/apps/backend/src/boot/config-file.ts', []],
    ]);
    expect(entries[0]?.surface).toBe('apps/backend/src/http/');
    expect(entries[0]?.matcher.test('apps/backend/src/http/public-api/openapi.controller.ts')).toBe(
      true,
    );
    expect(entries[0]?.matcher.test('apps/backend/src/graphql/server.ts')).toBe(false);
    expect(entries[4]?.matcher.test('apps/backend/src/boot/config-file.ts')).toBe(true);
    expect(entries[4]?.matcher.test('apps/backend/src/boot/config-file.test.ts')).toBe(false);
  });

  // An entry without pages, a page outside apps/docs or a pattern the gate would not read would let
  // a change through unchecked, so the parser refuses them.
  it('ADR0088 parseDocsPaths refuses an entry without pages, a page outside apps/docs and a pattern with ! or [', () => {
    for (const line of [
      '/packages/sdk/',
      '/packages/sdk/ docs/adr/0088.md',
      '/packages/sdk/ README.md',
      '!/packages/sdk/ none yet',
      '/packages/[ab]/ none yet',
    ]) {
      expect(() => parseDocsPaths(line), line).toThrow(/docs-paths/);
    }
  });

  it('ADR0088 the script reads the changed files and .github/docs-paths from the checkout, fails with an error annotation, and a missing PR_FROM_FORK counts as a fork', () => {
    const repository = repositoryWith((cwd) => {
      write(cwd, 'packages/sdk/src/index.ts', 'export const a = 2;\n');
    });
    const env = { PR_AUTHOR: 'a-contributor', PR_HEAD_REF: 'ci/pr-docs', PR_FROM_FORK: 'false' };
    const failed = run(repository, { ...env, PR_BODY: body('None: nothing to document.') });
    const passed = run(repository, {
      ...env,
      PR_BODY: body('None yet for packages/sdk/: the surface has no page.'),
    });
    const fork = run(repository, {
      PR_BODY: 'Release 1.2.0',
      PR_AUTHOR: 'a-contributor',
      PR_HEAD_REF: 'release-please--branches--main',
    });

    expect(failed.status).toBe(1);
    expect(failed.stdout).toMatch(/^::error::.*packages\/sdk\//);
    expect(passed.status, passed.stdout + passed.stderr).toBe(0);
    expect(fork.status).toBe(1);
  });
});
