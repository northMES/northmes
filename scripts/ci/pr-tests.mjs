// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The check behind PR / pr tests. NorthMES is built test first (AGENTS.md), so a pull request that
// changes behaviour changes a test too, and a pull request that deletes a test says why. Focused and
// skipped tests are Biome's noFocusedTests and noSkippedTests, so CI / lint refuses them.

import { execFileSync } from 'node:child_process';
import { matchesGlob } from 'node:path';
import { errorAnnotation } from './annotation.mjs';
import {
  commitType,
  givesNoReason,
  isBotPullRequest,
  parseNameStatus,
  section,
} from './pull-request.mjs';

const sourceRoots = ['apps/', 'modules/', 'packages/', 'examples/', 'scripts/'];
const codeFile = /\.(?:[cm]?[jt]sx?|sql|graphql)$/;
const testFile = /\.(?:test|test-d|spec)\.[cm]?[jt]sx?$/;

// The files pnpm gen writes (the outputs of the stages in scripts/gen.mjs, which a test compares
// with this list) and every *.gen.* file. The job installs no dependencies, so it cannot import
// gen.mjs, which loads TypeScript.
export const generatedFiles = Object.freeze([
  'schema/api.graphql',
  'schema/openapi-v1.json',
  'apps/web/src/**/*.graphql.gen.ts',
  'apps/web/public/shared/*.js',
  '**/*.gen.*',
]);

// The Conventional Commit types that change behaviour (scripts/ci/pr-title.mjs lists them all).
const behaviourChanges = ['feat', 'fix', 'security'];

// A test of the project. The skills under .claude are third-party or tooling code that
// skills-lock.json pins, so their tests are neither.
function isProjectTest(path) {
  return testFile.test(path) && !path.startsWith('.claude/');
}

// A source file whose content the pull request changes: code under a source root that is neither a
// test nor generated. A rename with no change to the content (R100) keeps the behaviour.
function isSourceChange({ status, path }) {
  return (
    status !== 'R100' &&
    sourceRoots.some((root) => path.startsWith(root)) &&
    codeFile.test(path) &&
    !testFile.test(path) &&
    !generatedFiles.some((glob) => matchesGlob(path, glob))
  );
}

function paths(changes) {
  return changes.map(({ path }) => path).join(', ');
}

export function checkPrTests({ title, body, author, headRef, fromFork, changes }) {
  if (isBotPullRequest({ author, headRef, fromFork })) return { ok: true, message: '' };
  const type = commitType(title);
  const deleted = changes.filter(({ status, path }) => status === 'D' && isProjectTest(path));
  // A revert takes its tests out with the change it reverts.
  if (
    deleted.length > 0 &&
    type !== 'revert' &&
    givesNoReason(section(body, 'Removed tests') ?? '')
  ) {
    return {
      ok: false,
      message: `The pull request deletes tests: ${paths(deleted)}. Say why each one goes under a ## Removed tests section in the pull request body.`,
    };
  }
  if (!behaviourChanges.includes(type)) return { ok: true, message: '' };
  const source = changes.filter(isSourceChange);
  // A deleted test or one moved without a change to its content (R100) shows no new behaviour.
  const tests = changes.filter(
    ({ status, path }) => status !== 'D' && status !== 'R100' && isProjectTest(path),
  );
  if (source.length > 0 && tests.length === 0) {
    return {
      ok: false,
      message: `The ${type} pull request changes source and no test: ${paths(source)}. Add or change the test that shows the new behaviour, or give the title a type that keeps behaviour, such as refactor or chore.`,
    };
  }
  return { ok: true, message: '' };
}

// CI checks out the pull request's merge commit, whose first parent is the base branch, so HEAD^1
// to HEAD is the pull request's change. The job passes the pull request through the environment,
// never inside the run script, so a title or body cannot inject shell code. A missing PR_FROM_FORK
// counts as a fork, which grants no exemption.
if (import.meta.main) {
  const changes = parseNameStatus(
    execFileSync('git', ['diff', '-z', '--name-status', '-M', 'HEAD^1', 'HEAD'], {
      encoding: 'utf8',
    }),
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
