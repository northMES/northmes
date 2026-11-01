// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The step behind PR / pull request (ADR 0093): the pull request the run is about, read through
// GitHub's REST API and written to the job's outputs, so the pull request checks read the same
// fields on a pull_request event and on a merge_group event, whose payload has no pull request.
// A merge_group event names the pull request in its queue branch, gh-readonly-queue/<base>/pr-<n>-<sha>.

import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { errorAnnotation } from './annotation.mjs';
import { eventPullNumber } from './pull-request.mjs';

/**
 * The fields the pull request checks read, from GitHub's view of the pull request. The base commit
 * is the one the run's checkout is built on: in a merge group that is the group's parent commit on
 * the latest main, not the base the pull request recorded when it was opened, so a diff against it
 * holds the pull request's change alone.
 * @param {{ number: number, title: string, body: string | null, user: { login: string }, head: { ref: string, repo: { fork: boolean } | null }, base: { sha: string } }} pull
 * @param {{ mergeGroupBaseSha?: string }} event
 * @returns {Record<string, string>}
 */
export function pullRequestOutputs(pull, { mergeGroupBaseSha } = {}) {
  return {
    number: String(pull.number),
    title: pull.title,
    body: pull.body ?? '',
    author: pull.user.login,
    head_ref: pull.head.ref,
    // A deleted fork leaves no repository; a pull request without one is treated as from a fork.
    from_fork: String(pull.head.repo?.fork ?? true),
    base_sha: mergeGroupBaseSha || pull.base.sha,
  };
}

/**
 * The outputs as GITHUB_OUTPUT takes them: `name=value` for a one-line value, and a heredoc with a
 * random delimiter for a value with a line break, which a body cannot guess.
 * @param {Record<string, string>} outputs
 * @param {() => string} delimiter
 */
export function outputLines(outputs, delimiter = () => randomBytes(16).toString('hex')) {
  return Object.entries(outputs)
    .map(([name, value]) => {
      if (!/[\r\n]/.test(value)) return `${name}=${value}\n`;
      const mark = `EOF_${delimiter()}`;
      return `${name}<<${mark}\n${value}\n${mark}\n`;
    })
    .join('');
}

/**
 * Reads the pull request through GitHub's REST API.
 * @param {{ fetch: typeof fetch, apiUrl: string, repository: string, token: string, pullNumber: number, mergeGroupBaseSha?: string }} options
 */
export async function readPullRequest({
  fetch,
  apiUrl,
  repository,
  token,
  pullNumber,
  mergeGroupBaseSha,
}) {
  const response = await fetch(`${apiUrl}/repos/${repository}/pulls/${pullNumber}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new Error(
      `GitHub answered ${response.status} to GET /repos/${repository}/pulls/${pullNumber}`,
    );
  }
  return pullRequestOutputs(await response.json(), { mergeGroupBaseSha });
}

// The job passes the event's values through the environment, never inside the run script. Any
// error fails the job with its message, so a check that cannot find its pull request never passes.
if (import.meta.main) {
  try {
    const pullNumber = eventPullNumber({
      number: process.env.PR_NUMBER,
      queueRef: process.env.MERGE_GROUP_HEAD_REF,
    });
    if (pullNumber === undefined) {
      throw new Error('neither PR_NUMBER nor MERGE_GROUP_HEAD_REF names a pull request');
    }
    const outputs = await readPullRequest({
      fetch,
      apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com',
      repository: process.env.GITHUB_REPOSITORY ?? '',
      token: process.env.GITHUB_TOKEN ?? '',
      pullNumber,
      mergeGroupBaseSha: process.env.MERGE_GROUP_BASE_SHA,
    });
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, outputLines(outputs));
    }
    console.log(`The run is about #${outputs.number}: ${outputs.title}`);
  } catch (error) {
    console.log(errorAnnotation(`The run could not find its pull request: ${error}`));
    process.exitCode = 1;
  }
}
