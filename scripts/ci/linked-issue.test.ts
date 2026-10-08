import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkLinkedIssue } from './linked-issue.mjs';

const script = fileURLToPath(new URL('./linked-issue.mjs', import.meta.url));

// Runs the script as the CI / linked issue job does, with the pull request in the environment.
function run(pullRequestEnv: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    env: { PATH: process.env.PATH, ...pullRequestEnv },
    encoding: 'utf8',
  });
}

// A pull request from a branch in this repository by a person, with the given body.
function pullRequest(body: string) {
  return { body, author: 'a-contributor', headRef: 'ci/gate-on-pull-requests', fromFork: false };
}

describe('CI / linked issue', () => {
  it('passes a pull request whose body has Closes #N', () => {
    expect(checkLinkedIssue(pullRequest('Closes #196')).ok).toBe(true);
    expect(checkLinkedIssue(pullRequest('Runs the gate.\n\ncloses #7\n')).ok).toBe(true);
  });

  // GitHub links and closes the issue for each of its closing keywords, also across repositories.
  it('passes the other GitHub closing keywords and an issue in another repository', () => {
    const bodies = [
      'close #3',
      'Closed #3',
      'Fix #12',
      'Fixes #12',
      'fixed: #12',
      'Resolve #4',
      'resolves #4',
      'Resolved northMES/northmes#196',
    ];

    for (const body of bodies) {
      expect(checkLinkedIssue(pullRequest(body)).ok, body).toBe(true);
    }
  });

  it('passes a Renovate pull request without Closes #N', () => {
    const renovate = {
      ...pullRequest('Updates vitest.'),
      author: 'renovate[bot]',
      headRef: 'renovate/vitest-5.x',
    };

    expect(checkLinkedIssue(renovate).ok).toBe(true);
  });

  // release-please opens the release pull request from its branch in this repository.
  it('passes a release pull request without Closes #N', () => {
    for (const headRef of [
      'release-please--branches--main',
      'release-please--branches--main--components--northmes',
    ]) {
      expect(checkLinkedIssue({ ...pullRequest('Releases 0.2.0.'), headRef }).ok, headRef).toBe(
        true,
      );
    }
  });

  // Anyone can name a branch in a fork after release-please's branch.
  it('fails a pull request from a fork branch named like the release branch without Closes #N', () => {
    const fromFork = {
      ...pullRequest('Releases 0.2.0.'),
      headRef: 'release-please--branches--main',
      fromFork: true,
    };

    expect(checkLinkedIssue(fromFork).ok).toBe(false);
  });

  it('fails a pull request whose body has no Closes #N, saying how to link one', () => {
    for (const body of ['', 'Adds the gate.', 'Closes #N', 'Part of #196.', 'This encloses #12.']) {
      const result = checkLinkedIssue(pullRequest(body));

      expect(result.ok, body).toBe(false);
      expect(result.message, body).toContain('Closes #N');
    }
  });

  it('the entry point reads the pull request from the environment and fails it with an annotation', () => {
    const releaseBranch = {
      PR_AUTHOR: 'a-contributor',
      PR_HEAD_REF: 'release-please--branches--main',
    };

    const fromFork = run({ ...releaseBranch, PR_FROM_FORK: 'true', PR_BODY: 'Adds the gate.' });
    const linked = run({ ...releaseBranch, PR_FROM_FORK: 'true', PR_BODY: 'Closes #196' });
    const release = run({ ...releaseBranch, PR_FROM_FORK: 'false', PR_BODY: '' });

    expect(fromFork.status).toBe(1);
    expect(fromFork.stdout).toMatch(/^::error::The pull request body links no issue\./);
    expect(linked.status).toBe(0);
    expect(linked.stdout).toBe('');
    expect(release.status).toBe(0);
  });
});
