// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The check behind Risk / risk gate (ADR 0086). It sorts a pull request into a low or a high tier by
// how much harm a wrong merge would do.

import { appendFileSync } from 'node:fs';
import { errorAnnotation } from './annotation.mjs';
import { section } from './pull-request.mjs';

// ADR 0051 rule 18: the validation impacts that change what the system records, protects or
// computes. A person judges whether its validation still holds.
const highImpacts = /^(?:records|security|calculation|data migration)$/;

// The machine user that agent sessions open pull requests as (ADR 0084), by GitHub user id, which a
// rename does not change.
export const agent = 345317483; // northmes-agent

// The maintainer, whose approval of the head commit lets a high pull request pass.
export const maintainer = 24939000; // Krister-Johansson

// The review states that replace an earlier one; a comment leaves an approval standing.
const deciding = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);

// A Conventional Commit title marked as a breaking change: ! right before the colon.
const breakingTitle = /^\w+(?:\([^()\s]+\))?!: /;

function escapeRegExp(text) {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/**
 * A matcher for one pattern of .github/risk-paths, read as .gitignore and CODEOWNERS read theirs: a
 * leading slash or a slash inside anchors the pattern at the root, a pattern with no slash matches
 * at any depth, * and ? stay within one folder, ** crosses folders, and a pattern that names a
 * folder covers everything below it.
 * @param {string} pattern
 * @returns {RegExp}
 */
function pathMatcher(pattern) {
  const folderOnly = pattern.endsWith('/');
  const trimmed = pattern.replace(/^\//, '').replace(/\/$/, '');
  const anchored = pattern.startsWith('/') || trimmed.includes('/');
  let source = '';
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (trimmed.startsWith('**/', index)) {
      source += '(?:.*/)?';
      index += 2;
    } else if (trimmed.startsWith('**', index)) {
      source += '.*';
      index += 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += escapeRegExp(char ?? '');
    }
  }
  const prefix = anchored ? '^' : '^(?:.*/)?';
  const below = folderOnly ? '/.*' : '(?:/.*)?';
  return new RegExp(`${prefix}${source}${below}$`);
}

/** The matchers of .github/risk-paths: one pattern a line, # for a comment. */
function riskPathMatchers(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map(pathMatcher);
}

/**
 * The first line of the Validation impact section, and the impacts it names before any
 * explanation: "UI only, records: ..." names UI only and records.
 */
function validationImpact(body) {
  const text = section(body, 'Validation impact')?.split(/\r?\n/)[0]?.trim();
  if (!text) return undefined;
  const values = text
    .split(/[:(]/)[0]
    .split(/,| and /)
    .map((value) => value.replace(/[.*_`]/g, '').trim().toLowerCase());
  return { text, values };
}

/** The tier the Blast radius section declares on its `Tier: low` or `Tier: high` line. */
function declaredTier(body) {
  const text = section(body, 'Blast radius') ?? '';
  const tier = /^tier:\s*[*_`]*(low|high)[*_`]*\s*$/im.exec(text)?.[1];
  return tier?.toLowerCase();
}

/** Whether the maintainer's latest deciding review approves the head commit. */
function maintainerApproved(reviews, headSha) {
  const latest = reviews
    .filter(({ userId, state }) => userId === maintainer && deciding.has(state))
    .at(-1);
  return latest?.state === 'APPROVED' && latest.commitId === headSha;
}

/**
 * The tier of a pull request and the reasons that made it high.
 * @param {{ riskPaths: string, files: readonly string[], body: string, title: string, authorId: number, reviews: readonly { userId: number, state: string, commitId: string }[], headSha: string }} pull
 * @returns {{ tier: 'low' | 'high', reasons: string[], ok: boolean }}
 */
export function assessRisk({ riskPaths, files, body, title, authorId, reviews, headSha }) {
  const matchers = riskPathMatchers(riskPaths);
  const reasons = files
    .filter((file) => matchers.some((matcher) => matcher.test(file)))
    .map((file) => `changes the high-risk path ${file}`);
  const impact = validationImpact(body);
  if (impact === undefined) {
    reasons.push('has no Validation impact section');
  } else if (impact.values.some((value) => highImpacts.test(value))) {
    reasons.push(`has the validation impact ${impact.text}`);
  }
  const declared = declaredTier(body);
  if (declared === undefined) {
    reasons.push('declares no tier in a Blast radius section');
  } else if (declared === 'high') {
    reasons.push('declares a high blast radius');
  }
  if (breakingTitle.test(title)) {
    reasons.push('marks a breaking change in its title');
  }
  if (authorId !== agent) {
    reasons.push('was not opened by northmes-agent');
  }
  const tier = reasons.length === 0 ? 'low' : 'high';
  const ok = tier === 'low' || maintainerApproved(reviews, headSha);
  return { tier, reasons, ok };
}

// GitHub lists 100 files or reviews per page, and at most 3000 files of a pull request.
const perPage = 100;
const listedFiles = 3000;

/**
 * Reads the pull request, its files and reviews through GitHub's REST API, and .github/risk-paths
 * from the default branch, so a pull request cannot change the paths that judge it.
 * @param {{
 *   fetch: (url: string, init: { headers: Record<string, string> }) => Promise<Response>,
 *   apiUrl: string,
 *   repository: string,
 *   token: string,
 *   pullNumber: number,
 * }} options
 * @returns {Promise<{ tier: 'low' | 'high', reasons: string[], ok: boolean }>}
 */
export async function checkRisk({ fetch, apiUrl, repository, token, pullNumber }) {
  async function get(path, accept = 'application/vnd.github+json') {
    const response = await fetch(`${apiUrl}/${path}`, {
      headers: {
        accept,
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub answered ${response.status} to GET /${path}`);
    }
    return response.text();
  }

  async function list(path) {
    const items = [];
    for (let page = 1; ; page += 1) {
      const listed = JSON.parse(await get(`${path}?per_page=${perPage}&page=${page}`));
      items.push(...listed);
      if (listed.length < perPage) return items;
    }
  }

  const pull = JSON.parse(await get(`repos/${repository}/pulls/${pullNumber}`));
  const riskPaths = await get(
    `repos/${repository}/contents/.github/risk-paths?ref=${encodeURIComponent(pull.base.repo.default_branch)}`,
    'application/vnd.github.raw+json',
  );
  const files = (await list(`repos/${repository}/pulls/${pullNumber}/files`)).flatMap(
    ({ filename, previous_filename }) => (previous_filename ? [filename, previous_filename] : [filename]),
  );
  const reviews = (await list(`repos/${repository}/pulls/${pullNumber}/reviews`)).map(
    ({ user, state, commit_id }) => ({ userId: user?.id, state, commitId: commit_id }),
  );

  const result = assessRisk({
    riskPaths,
    files,
    body: pull.body ?? '',
    title: pull.title,
    authorId: pull.user.id,
    reviews,
    headSha: pull.head.sha,
  });
  if (pull.changed_files > listedFiles) {
    result.reasons.push('changes more files than GitHub lists');
    return { ...result, tier: 'high', ok: maintainerApproved(reviews, pull.head.sha) };
  }
  return result;
}

/** The job summary: the tier and why. */
export function summary({ tier, reasons, ok }) {
  const lines = [`Risk tier: **${tier}**`, ''];
  for (const reason of reasons) lines.push(`- The pull request ${reason}.`);
  if (tier === 'high') {
    lines.push(
      '',
      ok
        ? 'The maintainer approved the head commit.'
        : 'A high pull request merges after the maintainer approves its head commit (ADR 0086).',
    );
  }
  return `${lines.join('\n')}\n`;
}

// The job passes the pull request number through the environment, never inside the run script. The
// workflow downloads this file and the ones it imports from the default branch, so a pull request
// cannot change the check that judges it.
if (import.meta.main) {
  const result = await checkRisk({
    fetch,
    apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com',
    repository: process.env.GITHUB_REPOSITORY ?? '',
    token: process.env.GITHUB_TOKEN ?? '',
    pullNumber: Number(process.env.PR_NUMBER),
  });
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tier=${result.tier}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(result));
  if (!result.ok) {
    console.log(
      errorAnnotation(
        `This pull request is high risk: it ${result.reasons.join('; it ')}. It merges after the maintainer approves its head commit (ADR 0086).`,
      ),
    );
    process.exitCode = 1;
  }
}
