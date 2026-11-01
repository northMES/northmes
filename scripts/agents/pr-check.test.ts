// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkPullRequest, report } from './pr-check.mjs';

const script = fileURLToPath(new URL('./pr-check.mjs', import.meta.url));

const riskPaths = ['/.github/', '/CLAUDE.md'].join('\n');
const docsPaths = '/apps/backend/src/graphql/ apps/docs/api.mdx';

const body = [
  '## What changes',
  'The board lists its rows by page.',
  '## Security',
  'None: the change reads rows the user may already see, through the same permission check.',
  '## Docs',
  'None: the diff touches no surface that .github/docs-paths maps.',
  '## Validation impact',
  'none',
  '## Blast radius',
  'A wrong page size shows fewer rows; a revert undoes it.',
  '',
  'Tier: low',
  '## Checks',
  'pnpm check',
  '',
  'Closes #976',
].join('\n');

const title = 'feat(planning): the board lists its rows by page';
const changes = [
  { status: 'M', path: 'apps/web/src/modules/planning/board.tsx' },
  { status: 'M', path: 'apps/web/test/modules/planning/board.test.tsx' },
];

/** The body without one section: its heading and the lines up to the next heading. */
function without(heading: string): string {
  return body.replace(new RegExp(`## ${heading}\\n(?:(?!## ).*\\n?)*`), '');
}

describe('#976 the pre-open check runs the pull request checks and the risk gate on the local branch', () => {
  it('#976 a complete body on an ordinary change passes every check and would be low', () => {
    expect(checkPullRequest({ title, body, changes, riskPaths, docsPaths })).toEqual({
      problems: [],
      tier: 'low',
      reasons: [],
    });
  });

  it('#976 a missing Validation impact section is a problem of the risk gate, because the body can avoid it', () => {
    const result = checkPullRequest({
      title,
      body: without('Validation impact'),
      changes,
      riskPaths,
      docsPaths,
    });

    expect(result.tier).toBe('high');
    expect(result.reasons).toEqual(['has no Validation impact section']);
    expect(result.problems.map(({ check }) => check)).toEqual(['risk gate']);
    expect(result.problems[0]?.message).toContain('has no Validation impact section');
  });

  it('#976 a Validation impact written as prose the gate cannot read is a problem, and one that names records is not', () => {
    const prose = body.replace(
      '\nnone\n',
      '\nThe web move model refuses one more case. No server-side validation changes.\n',
    );
    const records = body.replace('\nnone\n', '\nrecords: the order list keeps one more column.\n');

    const unreadable = checkPullRequest({ title, body: prose, changes, riskPaths, docsPaths });
    const earned = checkPullRequest({ title, body: records, changes, riskPaths, docsPaths });

    expect(unreadable.reasons).toEqual([
      'has the validation impact The web move model refuses one more case. No server-side validation changes.',
    ]);
    expect(unreadable.problems.map(({ check }) => check)).toEqual(['risk gate']);
    expect(earned.tier).toBe('high');
    expect(earned.reasons).toEqual([
      'has the validation impact records: the order list keeps one more column.',
    ]);
    expect(earned.problems).toEqual([]);
  });

  it('#976 a Validation impact of UI only with a reason after a colon is low, as the gate reads it', () => {
    const result = checkPullRequest({
      title,
      body: body.replace('\nnone\n', '\nUI only: the column order changes.\n'),
      changes,
      riskPaths,
      docsPaths,
    });

    expect(result).toEqual({ problems: [], tier: 'low', reasons: [] });
  });

  it('#976 a Blast radius section without a Tier line is a problem of the risk gate', () => {
    const result = checkPullRequest({
      title,
      body: body.replace('\nTier: low\n', '\n'),
      changes,
      riskPaths,
      docsPaths,
    });

    expect(result.reasons).toEqual(['declares no tier in a Blast radius section']);
    expect(result.problems.map(({ check }) => check)).toEqual(['risk gate']);
  });

  it('#976 a change to a risk path is high for that file, which is no problem to fix', () => {
    const result = checkPullRequest({
      title,
      body,
      changes: [...changes, { status: 'M', path: 'CLAUDE.md' }],
      riskPaths,
      docsPaths,
    });

    expect(result.tier).toBe('high');
    expect(result.reasons).toEqual(['changes the high-risk path CLAUDE.md']);
    expect(result.problems).toEqual([]);
  });

  it('#976 a file renamed out of a risk path counts under its old path too, and once in the count of changed files', () => {
    const result = checkPullRequest({
      title,
      body,
      changes: [{ status: 'R100', path: 'docs/agents.md', from: 'CLAUDE.md' }],
      riskPaths,
      docsPaths,
    });

    expect(result.reasons).toEqual(['changes the high-risk path CLAUDE.md']);
  });

  it('#976 a missing Security section and a title that is no Conventional Commit are problems that name their check', () => {
    const result = checkPullRequest({
      title: 'Board rows by page',
      body: without('Security'),
      changes,
      riskPaths,
      docsPaths,
    });

    expect(result.problems.map(({ check }) => check)).toEqual(['pr title', 'pr security']);
    expect(result.problems[1]?.message).toContain('## Security');
  });

  it('#976 a Docs section that says none on a mapped surface without naming it is a problem', () => {
    const result = checkPullRequest({
      title,
      body,
      changes: [...changes, { status: 'M', path: 'apps/backend/src/graphql/schema.ts' }],
      riskPaths,
      docsPaths,
    });

    expect(result.problems.map(({ check }) => check)).toEqual(['pr docs']);
    expect(result.problems[0]?.message).toContain('apps/backend/src/graphql/');
  });

  it('#976 a feat that changes source and no test is a problem', () => {
    const result = checkPullRequest({
      title,
      body,
      changes: [changes[0] as never],
      riskPaths,
      docsPaths,
    });

    expect(result.problems.map(({ check }) => check)).toEqual(['pr tests']);
  });

  it('#976 the report lists each problem with its check, then the tier with its reasons', () => {
    expect(
      report({
        problems: [
          { check: 'pr security', message: 'The pull request body has no ## Security section.' },
        ],
        tier: 'high',
        reasons: ['has no Validation impact section'],
      }),
    ).toBe(
      [
        'pr security: The pull request body has no ## Security section.',
        'Risk / risk gate would make this pull request, opened by northmes-agent, high, because it:',
        '- has no Validation impact section',
      ].join('\n'),
    );
    expect(report({ problems: [], tier: 'low', reasons: [] })).toBe(
      'Risk / risk gate would make this pull request, opened by northmes-agent, low.',
    );
  });
});

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

function commit(repository: string, message: string) {
  git(repository, 'add', '--all');
  git(repository, '-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-qm', message);
}

// A repository with a base branch, a branch with one commit on top, and the base moved on after
// the branch point, as origin/main moves while a session works.
function repositoryWith(
  change: (repository: string) => void,
  baseMovesOn?: (repository: string) => void,
) {
  const repository = mkdtempSync(join(tmpdir(), 'pr-check-'));
  repositories.push(repository);
  git(repository, 'init', '--quiet', '--initial-branch=base');
  write(repository, '.github/risk-paths', riskPaths);
  write(repository, '.github/docs-paths', docsPaths);
  write(repository, 'apps/web/src/modules/planning/board.tsx', 'export const a = 1;\n');
  commit(repository, 'base');
  git(repository, 'checkout', '-q', '-b', 'branch');
  change(repository);
  commit(repository, 'branch');
  if (baseMovesOn) {
    git(repository, 'checkout', '-q', 'base');
    baseMovesOn(repository);
    commit(repository, 'base moves on');
    git(repository, 'checkout', '-q', 'branch');
  }
  write(repository, 'body.md', body);
  return repository;
}

function run(repository: string, ...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repository,
    env: { PATH: process.env.PATH },
    encoding: 'utf8',
  });
}

describe('#976 pnpm agent:pr-check reads the branch as the checks and the gate would', () => {
  it('#976 a complete body on a branch that changes source and a test exits 0 and reports low', () => {
    const repository = repositoryWith((repo) => {
      write(repo, 'apps/web/src/modules/planning/board.tsx', 'export const a = 2;\n');
      write(repo, 'apps/web/test/modules/planning/board.test.tsx', 'test\n');
    });

    const result = run(repository, title, 'body.md', 'base');

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      'Risk / risk gate would make this pull request, opened by northmes-agent, low.',
    );
  });

  it('#976 a problem exits 1 with the check named, and the diff is the branch from the merge base, not from the moved base', () => {
    const repository = repositoryWith(
      (repo) => write(repo, 'apps/web/src/modules/planning/board.tsx', 'export const a = 2;\n'),
      (repo) => write(repo, 'apps/web/src/other.ts', 'export const b = 1;\n'),
    );

    const result = run(repository, title, 'body.md', 'base');

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      'pr tests: The feat pull request changes source and no test: apps/web/src/modules/planning/board.tsx.',
    );
    expect(result.stdout).not.toContain('other.ts');
  });

  it('#976 the risk paths are read from the base, so a path main added after the branch point counts and a path the branch adds does not', () => {
    const mainAdded = repositoryWith(
      (repo) => write(repo, 'deploy/x.sh', 'echo\n'),
      (repo) => write(repo, '.github/risk-paths', `${riskPaths}\n/deploy/\n`),
    );
    const branchAdded = repositoryWith((repo) => {
      write(repo, 'deploy/x.sh', 'echo\n');
      write(repo, '.github/risk-paths', `${riskPaths}\n/deploy/\n`);
    });

    const fromMain = run(mainAdded, 'chore: x', 'body.md', 'base');
    const fromBranch = run(branchAdded, 'chore: x', 'body.md', 'base');

    expect(fromMain.status).toBe(0);
    expect(fromMain.stdout).toContain('- changes the high-risk path deploy/x.sh');
    expect(fromBranch.stdout).toContain('- changes the high-risk path .github/risk-paths');
    expect(fromBranch.stdout).not.toContain('deploy/x.sh');
  });

  it("#976 the docs paths are the branch's copy when the branch changes them, as the merge commit carries it", () => {
    const repository = repositoryWith((repo) => {
      write(repo, 'apps/backend/src/http/x.ts', 'export const a = 1;\n');
      write(
        repo,
        '.github/docs-paths',
        `${docsPaths}\n/apps/backend/src/http/ apps/docs/install.mdx\n`,
      );
    });

    const result = run(repository, 'chore: x', 'body.md', 'base');

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('pr docs:');
    expect(result.stdout).toContain('apps/backend/src/http/');
  });

  it('#976 a missing body file or an unknown base exits 2 with a usage line, not a stack', () => {
    const repository = repositoryWith((repo) => write(repo, 'deploy/x.sh', 'echo\n'));

    const noBody = run(repository, title, 'missing.md', 'base');
    const noBase = run(repository, title, 'body.md', 'nowhere');
    const noArgs = run(repository);

    for (const result of [noBody, noBase, noArgs]) {
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('Usage: pnpm agent:pr-check');
      expect(result.stderr).not.toContain('    at ');
    }
  });
});
