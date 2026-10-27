// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { stages } from '../gen.mjs';
import { checkPrTests, generatedFiles } from './pr-tests.mjs';
import { parseNameStatus } from './pull-request.mjs';

const script = fileURLToPath(new URL('./pr-tests.mjs', import.meta.url));

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

// A repository with a base commit and a pull request commit on top, as CI checks out the pull
// request's merge commit with its first parent, the base branch.
function repositoryWith(base: Record<string, string>, change: (repository: string) => void) {
  const repository = mkdtempSync(join(tmpdir(), 'pr-tests-'));
  repositories.push(repository);
  git(repository, 'init', '--quiet');
  for (const [path, content] of Object.entries(base)) write(repository, path, content);
  git(repository, 'add', '--all');
  git(repository, '-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-qm', 'base');
  change(repository);
  git(repository, 'add', '--all');
  git(repository, '-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-qm', 'pr');
  return repository;
}

// Runs the script as the PR / pr tests job does, with the pull request in the environment.
function run(repository: string, title: string, body = '') {
  return spawnSync(process.execPath, [script], {
    cwd: repository,
    env: {
      PATH: process.env.PATH,
      PR_TITLE: title,
      PR_BODY: body,
      PR_AUTHOR: 'a-contributor',
      PR_HEAD_REF: 'feat/orders',
      PR_FROM_FORK: 'false',
    },
    encoding: 'utf8',
  });
}

// A pull request from a branch in this repository by a person, with the given title and changes.
function pullRequest(title: string, changes: { status: string; path: string }[], body = '') {
  return { title, body, author: 'a-contributor', headRef: 'feat/orders', fromFork: false, changes };
}

describe('PR / pr tests', () => {
  it('a feat pull request that changes source and no test fails', () => {
    const result = checkPrTests(
      pullRequest('feat(planning): split a run', [
        { status: 'M', path: 'modules/planning/core/run.ts' },
      ]),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('modules/planning/core/run.ts');
  });

  // A refactor, chore or build change keeps the behaviour, so the tests it already has stay.
  it('a pull request of another type that changes source and no test passes', () => {
    const changes = [{ status: 'M', path: 'modules/planning/core/run.ts' }];

    for (const title of ['refactor(planning): name the run', 'chore: bump a tool', 'perf: cache']) {
      expect(checkPrTests(pullRequest(title, changes)).ok, title).toBe(true);
    }
    expect(checkPrTests(pullRequest('fix(core)!: refuse a blocked user', changes)).ok).toBe(false);
    // A change to a control starts with its security test (AGENTS.md).
    expect(checkPrTests(pullRequest('security(core): mask the error', changes)).ok).toBe(false);
  });

  it('a feat pull request that changes a unit, integration, type or end-to-end test passes', () => {
    const source = { status: 'M', path: 'modules/planning/core/run.ts' };
    const tests = [
      'modules/planning/core/run.test.ts',
      'modules/planning/infrastructure/runs.int.test.ts',
      'apps/web/src/modules/planning/screens/runs/runs.test.tsx',
      'packages/sdk/src/commands.test-d.ts',
      'e2e/planning/runs.spec.ts',
    ];

    for (const path of tests) {
      const result = checkPrTests(
        pullRequest('feat(planning): split a run', [source, { status: 'A', path }]),
      );
      expect(result.ok, path).toBe(true);
    }
  });

  // Generated files follow from their source, a pure rename keeps the content, and files outside
  // the code (styles, manifests, docs) have no unit test to change.
  it('a feat pull request whose only changes are generated files, pure renames or non-code files passes', () => {
    const changes = [
      { status: 'M', path: 'apps/web/src/modules/core/screens/articles/articles.graphql.gen.ts' },
      { status: 'R100', path: 'modules/planning/core/runs.ts' },
      { status: 'M', path: 'packages/ui/src/tokens.css' },
      { status: 'M', path: 'modules/planning/package.json' },
      { status: 'M', path: 'modules/planning/README.md' },
    ];

    expect(checkPrTests(pullRequest('feat(planning): split a run', changes)).ok).toBe(true);
  });

  // Deleting a test is how a change could pass the gate without meeting it, so the pull request
  // says why each test went.
  it('a pull request that deletes a test file fails unless its body has a Removed tests section with a reason', () => {
    const changes = [{ status: 'D', path: 'modules/planning/core/run.test.ts' }];
    const reason = '## What changes\nDrops runs.\n\n## Removed tests\nThe run module is gone.\n';

    const bare = checkPrTests(pullRequest('chore: drop runs', changes));
    expect(bare.ok).toBe(false);
    expect(bare.message).toContain('modules/planning/core/run.test.ts');
    expect(bare.message).toContain('## Removed tests');
    expect(checkPrTests(pullRequest('chore: drop runs', changes, '## Removed tests\n\n')).ok).toBe(
      false,
    );
    expect(checkPrTests(pullRequest('chore: drop runs', changes, reason)).ok).toBe(true);
  });

  it('a deleted test does not count as the test change of a feat pull request', () => {
    const changes = [
      { status: 'M', path: 'modules/planning/core/run.ts' },
      { status: 'D', path: 'modules/planning/core/run.test.ts' },
    ];
    const reason = '## Removed tests\nThe old run test covered the removed split.\n';

    expect(checkPrTests(pullRequest('feat(planning): split a run', changes, reason)).ok).toBe(
      false,
    );
  });

  // As PR / pr security exempts them: neither app writes a body section, and their changes are
  // dependency and release files that the license, supply-chain and release checks cover.
  it("Renovate's and release-please's pull requests pass", () => {
    const changes = [
      { status: 'M', path: 'packages/sdk/src/version.ts' },
      { status: 'D', path: 'packages/sdk/src/version.test.ts' },
    ];
    const renovate = {
      ...pullRequest('fix(deps): update dependency kysely', changes),
      author: 'renovate[bot]',
    };
    const release = {
      ...pullRequest('chore(main): release 0.2.0', changes),
      author: 'github-actions[bot]',
      headRef: 'release-please--branches--main',
    };

    expect(checkPrTests(renovate).ok).toBe(true);
    expect(checkPrTests(release).ok).toBe(true);
    expect(checkPrTests({ ...release, fromFork: true }).ok).toBe(false);
  });

  // Moving a test keeps what it tests, so a pure rename is no test change.
  it('a renamed test with unchanged content does not count as the test change of a feat pull request', () => {
    const changes = [
      { status: 'M', path: 'modules/planning/core/run.ts' },
      { status: 'R100', path: 'modules/planning/core/runs.test.ts' },
    ];

    expect(checkPrTests(pullRequest('feat(planning): split a run', changes)).ok).toBe(false);
  });

  // -z keeps every path as git stores it; without it git quotes a path with unusual characters.
  it("reads git's NUL-separated name-status records, a moved file under its new path", () => {
    const output = [
      'M',
      'modules/a.ts',
      'R087',
      'modules/old.test.ts',
      'modules/new.test.ts',
      'D',
      'modules/planning/core/k\u00f6rning.test.ts',
      '',
    ].join('\0');

    expect(parseNameStatus(output)).toEqual([
      { status: 'M', path: 'modules/a.ts' },
      { status: 'R087', path: 'modules/new.test.ts' },
      { status: 'D', path: 'modules/planning/core/k\u00f6rning.test.ts' },
    ]);
  });

  it('the generated files it skips are the outputs of every pnpm gen stage', () => {
    expect([...generatedFiles].sort()).toEqual(
      expect.arrayContaining(stages.flatMap(({ outputs }) => outputs).sort()),
    );
  });

  it('a fix pull request that only regenerates the shared web shims passes', () => {
    const changes = [{ status: 'M', path: 'apps/web/public/shared/apollo-client.js' }];

    expect(checkPrTests(pullRequest('fix(web): share Apollo', changes)).ok).toBe(true);
  });

  // The scripts carry tests next to them, the CI checks among them.
  it('a fix pull request that changes a script and no test fails', () => {
    const changes = [{ status: 'M', path: 'scripts/ci/pr-security.mjs' }];

    expect(checkPrTests(pullRequest('fix(ci): read the section', changes)).ok).toBe(false);
  });

  // "None" gives no reason, as PR / pr security also refuses it.
  it('a Removed tests section that says none without a reason fails', () => {
    const changes = [{ status: 'D', path: 'modules/planning/core/run.test.ts' }];

    for (const none of ['None', 'N/A', '- none.']) {
      const body = `## Removed tests\n${none}\n`;
      expect(checkPrTests(pullRequest('chore: drop runs', changes, body)).ok, none).toBe(false);
    }
  });

  // The skills under .claude are third-party or tooling code, pinned in skills-lock.json.
  it('tests under .claude neither count as a test change nor need a Removed tests section', () => {
    const vendored = '.claude/skills/security-audit/validate-findings.test.cjs';

    expect(
      checkPrTests(pullRequest('chore: update a skill', [{ status: 'D', path: vendored }])).ok,
    ).toBe(true);
    expect(
      checkPrTests(
        pullRequest('feat(planning): split a run', [
          { status: 'M', path: 'modules/planning/core/run.ts' },
          { status: 'M', path: vendored },
        ]),
      ).ok,
    ).toBe(false);
  });

  // A revert takes its tests out with the change it reverts.
  it('a revert pull request may delete tests without a Removed tests section', () => {
    const changes = [{ status: 'D', path: 'modules/planning/core/run.test.ts' }];

    expect(checkPrTests(pullRequest('revert: split a run', changes)).ok).toBe(true);
  });
});

describe('PR / pr tests script', () => {
  it('reads the changes from git and fails a feat pull request without a test change with an error annotation', () => {
    const repository = repositoryWith({ 'modules/planning/core/run.ts': 'export {};\n' }, (dir) =>
      write(dir, 'modules/planning/core/run.ts', 'export const run = 1;\n'),
    );

    const result = run(repository, 'feat(planning): split a run');

    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/^::error::.*modules\/planning\/core\/run\.ts/m);
  });

  it('passes a feat pull request that changes a test', () => {
    const repository = repositoryWith({ 'modules/planning/core/run.ts': 'export {};\n' }, (dir) => {
      write(dir, 'modules/planning/core/run.ts', 'export const run = 1;\n');
      write(dir, 'modules/planning/core/run.test.ts', 'export {};\n');
    });

    const result = run(repository, 'feat(planning): split a run');

    expect(result.stdout).toBe('');
    expect(result.status).toBe(0);
  });

  it('fails a pull request that deletes a test without a Removed tests section', () => {
    const repository = repositoryWith({ 'modules/planning/core/run.test.ts': 'export {};\n' }, (dir) =>
      rmSync(join(dir, 'modules/planning/core/run.test.ts')),
    );

    expect(run(repository, 'chore: drop runs').status).toBe(1);
    expect(run(repository, 'chore: drop runs', '## Removed tests\nRuns are gone.').status).toBe(0);
  });
});
