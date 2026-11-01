// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The pre-open check of a pull request (#976): `pnpm agent:pr-check <title> <body file> [<base>]`
// runs the rules of PR / pr title, linked issue, pr security, pr docs and pr tests and of Risk /
// risk gate on the local branch, through the functions the CI scripts export, so a session fixes
// a missing section, a Validation impact the gate cannot read or a lost Tier line before the pull
// request opens, instead of earning a high tier it could have avoided. It exits 1 for each of those
// and for a check that would fail, and 0 for a tier the change earns, a risk path or a security
// impact.
//
// Where the local answer can differ from CI's: the changes are the branch's diff from the base
// (`<base>...HEAD`, origin/main unless named), where CI diffs the merge commit from its first
// parent, so a change that main merged identically counts here and not there; the risk paths are
// the base's copy, as the gate reads them from the default branch, and the docs paths are the
// base's copy unless the branch changes them, as CI reads the merge commit's; a base behind
// origin/main gives stale copies, so fetch first; the author is taken as northmes-agent, which
// CI reads from the pull request; the risk gate runs the checkout's scripts/ci, which CI downloads
// from the default branch, and a branch that changes them is high for touching them.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { checkLinkedIssue } from '../ci/linked-issue.mjs';
import { checkPrDocs, docsPathsFile } from '../ci/pr-docs.mjs';
import { checkPrSecurity } from '../ci/pr-security.mjs';
import { checkPrTests } from '../ci/pr-tests.mjs';
import { checkTitle } from '../ci/pr-title.mjs';
import { changedPaths, parseNameStatus, section } from '../ci/pull-request.mjs';
import { agent, assessRisk } from '../ci/risk-gate.mjs';

export const riskPathsFile = '.github/risk-paths';

// The validation impacts ADR 0051 rule 18 names. A first line that names only these earns its
// tier; any other first line is one the gate cannot read.
const impacts = new Set([
  'none',
  'ui only',
  'records',
  'security',
  'calculation',
  'data migration',
]);

/** The values the Validation impact section's first line names, as the gate reads them. */
function impactValues(body) {
  const text = section(body, 'Validation impact')?.split(/\r?\n/)[0]?.trim() ?? '';
  return (text.split(/[:(]/)[0] ?? '')
    .split(',')
    .map((value) => value.replace(/^[-*_\s]+|[.*_`\s]+$/g, '').toLowerCase());
}

/**
 * The reasons of the gate that the body earns by its own mistake, which the session fixes before
 * the pull request opens: a missing Validation impact section, a first line the gate cannot read,
 * and a Blast radius section without a Tier line.
 */
function avoidable(reason, body) {
  if (reason === 'has no Validation impact section') return true;
  if (reason === 'declares no tier in a Blast radius section') return true;
  if (reason.startsWith('has the validation impact ')) {
    return !impactValues(body).every((value) => impacts.has(value));
  }
  return false;
}

/**
 * What the pull request checks and the risk gate would say about a pull request with this title
 * and body, opened by northmes-agent from a branch of the repository with these changes.
 * @param {{ title: string, body: string, changes: readonly { status: string, path: string, from?: string }[], riskPaths: string, docsPaths: string }} pull
 *   the title, the body, the changes as parseNameStatus returns them, and the texts of
 *   .github/risk-paths and .github/docs-paths
 * @returns {{ problems: { check: string, message: string }[], tier: 'low' | 'high', reasons: string[] }}
 *   the problems to fix before the pull request opens, the avoidable reasons of the gate among them,
 *   and the tier with every reason
 */
export function checkPullRequest({ title, body, changes, riskPaths, docsPaths }) {
  const pull = { title, body, author: 'northmes-agent', headRef: 'a-branch', fromFork: false };
  const results = [
    ['pr title', checkTitle(title)],
    ['linked issue', checkLinkedIssue(pull)],
    ['pr security', checkPrSecurity(pull)],
    ['pr docs', checkPrDocs({ ...pull, changes, docsPaths })],
    ['pr tests', checkPrTests({ ...pull, changes })],
  ];
  const problems = results
    .filter(([, result]) => !result.ok)
    .map(([check, result]) => ({ check, message: result.message }));
  const { tier, reasons } = assessRisk({
    riskPaths,
    files: changedPaths(changes),
    changedFiles: changes.length,
    body,
    title,
    authorId: agent,
    reviews: [],
    headSha: '',
  });
  for (const reason of reasons.filter((reason) => avoidable(reason, body))) {
    problems.push({
      check: 'risk gate',
      message: `The pull request ${reason}, which makes it high for a reason the body can avoid: give it a Validation impact section whose first line names none, UI only, records, security, calculation or data migration (ADR 0051 rule 18), and a Blast radius section that ends in a Tier line (ADR 0086).`,
    });
  }
  return { problems, tier, reasons };
}

/** The report as the session reads it: each problem, then the tier and its reasons. */
export function report({ problems, tier, reasons }) {
  const lines = problems.map(({ check, message }) => `${check}: ${message}`);
  lines.push(
    tier === 'low'
      ? 'Risk / risk gate would make this pull request, opened by northmes-agent, low.'
      : `Risk / risk gate would make this pull request, opened by northmes-agent, high, because it:\n${reasons.map((reason) => `- ${reason}`).join('\n')}`,
  );
  return lines.join('\n');
}

/** A file's text at the base. */
function atBase(file, base) {
  return execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' });
}

/**
 * The docs paths as PR / pr docs reads them from the merge commit: the branch's copy when the
 * branch changes the file, and the base's otherwise.
 */
function docsPathsAs(base, changes) {
  const changed = changes.some(
    ({ path, from }) => path === docsPathsFile || from === docsPathsFile,
  );
  return changed ? readFileSync(docsPathsFile, 'utf8') : atBase(docsPathsFile, base);
}

if (import.meta.main) {
  const [title, bodyFile, base = 'origin/main'] = process.argv.slice(2);
  if (!title || !bodyFile) {
    console.error('Usage: pnpm agent:pr-check <title> <body file> [<base>]');
    process.exit(2);
  }
  let result;
  try {
    const changes = parseNameStatus(
      execFileSync('git', ['diff', '-z', '--name-status', '-M', `${base}...HEAD`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
    result = checkPullRequest({
      title,
      body: readFileSync(bodyFile, 'utf8'),
      changes,
      // The gate reads the risk paths from the default branch, whatever the branch does to them.
      riskPaths: atBase(riskPathsFile, base),
      docsPaths: docsPathsAs(base, changes),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not read the pull request: ${message.split('\n')[0]}`);
    console.error('Usage: pnpm agent:pr-check <title> <body file> [<base>]');
    process.exit(2);
  }
  console.log(report(result));
  if (result.problems.length > 0) process.exitCode = 1;
}
