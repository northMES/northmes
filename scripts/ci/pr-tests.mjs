// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The check behind CI / pr tests. NorthMES is built test first (AGENTS.md), so a pull request that
// changes behaviour changes a test too, and a pull request that deletes a test says why. Focused and
// skipped tests are Biome's noFocusedTests and noSkippedTests, so CI / lint refuses them.

import { execFileSync } from 'node:child_process';
import { errorAnnotation } from './annotation.mjs';
import { section } from './pr-body.mjs';

// Renovate's and release-please's pull requests, as CI / pr security exempts them.
const renovate = 'renovate[bot]';
const releaseBranch = 'release-please--branches--';

const sourceRoots = ['apps/', 'modules/', 'packages/', 'examples/'];
const codeFile = /\.(?:[cm]?[jt]sx?|sql|graphql)$/;
const testFile = /\.(?:test|test-d|spec)\.[cm]?[jt]sx?$/;
const generatedFile = /\.gen\.[^/]+$/;

// The Conventional Commit types that change behaviour (scripts/ci/pr-title.mjs lists them all).
const behaviourChange = /^(?:feat|fix|security)(?:\([^()\s]+\))?!?: /;
const revert = /^revert(?:\([^()\s]+\))?!?: /;

// A source file whose content the pull request changes: code under a workspace root that is
// neither a test nor generated. A rename with no change to the content (R100) keeps the behaviour.
function isSourceChange({ status, path }) {
  return (
    status !== 'R100' &&
    sourceRoots.some((root) => path.startsWith(root)) &&
    codeFile.test(path) &&
    !testFile.test(path) &&
    !generatedFile.test(path)
  );
}

function paths(changes) {
  return changes.map(({ path }) => path).join(', ');
}

export function checkPrTests({ title, body, author, headRef, fromFork, changes }) {
  const release = !fromFork && headRef.startsWith(releaseBranch);
  if (author === renovate || release) return { ok: true, message: '' };
  const deleted = changes.filter(({ status, path }) => status === 'D' && testFile.test(path));
  const removedTests = section(body, 'Removed tests');
  if (deleted.length > 0 && !revert.test(title) && !removedTests) {
    return {
      ok: false,
      message: `The pull request deletes tests: ${paths(deleted)}. Say why each one goes under a ## Removed tests section in the pull request body.`,
    };
  }
  if (!behaviourChange.test(title)) return { ok: true, message: '' };
  const source = changes.filter(isSourceChange);
  // A deleted test or one moved without a change to its content (R100) shows no new behaviour.
  const tests = changes.filter(
    ({ status, path }) => status !== 'D' && status !== 'R100' && testFile.test(path),
  );
  if (source.length > 0 && tests.length === 0) {
    return {
      ok: false,
      message: `The ${title.split(/[(!:]/)[0]} pull request changes source and no test: ${paths(source)}. Add or change the test that shows the new behaviour, or give the title a type that keeps behaviour, such as refactor or chore.`,
    };
  }
  return { ok: true, message: '' };
}

/**
 * The changes of `git diff --name-status -M`, one per line: the status, then the path, or for a
 * rename or copy the old and the new path. A moved file counts under its new path.
 */
export function parseNameStatus(output) {
  return output
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [status, ...files] = line.split('\t');
      return { status, path: files.at(-1) };
    });
}

// CI checks out the pull request's merge commit, whose first parent is the base branch, so HEAD^1
// to HEAD is the pull request's change. The job passes the pull request through the environment,
// never inside the run script, so a title or body cannot inject shell code. A missing PR_FROM_FORK
// counts as a fork, which grants no exemption.
if (import.meta.main) {
  const changes = parseNameStatus(
    execFileSync('git', ['diff', '--name-status', '-M', 'HEAD^1', 'HEAD'], { encoding: 'utf8' }),
  );
  const { ok, message } = checkPrTests({
    title: process.env.PR_TITLE ?? '',
    body: process.env.PR_BODY ?? '',
    author: process.env.PR_AUTHOR ?? '',
    headRef: process.env.PR_HEAD_REF ?? '',
    fromFork: process.env.PR_FROM_FORK !== 'false',
    changes,
  });
  if (!ok) {
    console.log(errorAnnotation(message));
    process.exitCode = 1;
  }
}
