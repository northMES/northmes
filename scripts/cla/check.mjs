// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The check behind CI / cla (docs/adr/0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md).
// The pull request author and the author of every commit must have signed the contributor license
// agreement, which .github/cla/signed.json records by GitHub user id. The check reads the pull
// request, its commits and signed.json through GitHub's REST API with the job's read-only token.
// It reads signed.json from the default branch, never from the pull request, so a pull request
// cannot sign for its own author. CI / cla downloads this file from the default branch too and
// runs it without a checkout, so a pull request cannot change the check that judges it.

import { errorAnnotation } from '../ci/annotation.mjs';

// The sentence CLA.md asks a contributor to post as a pull request comment. A test keeps the two
// equal.
export const signSentence =
  'I have read the NorthMES Individual Contributor License Agreement, version 0.1, and I agree to its terms for all my past and future contributions to NorthMES.';

// The accounts that pass without a signature, by GitHub user id, which a rename does not change.
// The maintainer holds the copyright, and Renovate's commits only update dependency versions.
const maintainer = 24939000; // Krister-Johansson
const renovate = 29139614; // renovate[bot]

// release-please opens the release pull request as github-actions[bot] from a branch with this
// prefix in this repository. github-actions[bot] passes only there.
const githubActions = 41898282; // github-actions[bot]
const releaseBranch = 'release-please--branches--';

// GitHub lists 100 commits per page, and at most 250 commits of a pull request.
const commitsPerPage = 100;
const listedCommits = 250;

const agreements = new Set(['individual', 'corporate']);
const signatureKeys = ['agreement', 'date', 'id', 'version'];

/**
 * The GitHub user ids in signed.json. It throws on any other shape, such as an entry with a name
 * or a login in place of the id.
 *
 * @param {string} text
 * @returns {Set<number>}
 */
export function parseSignatures(text) {
  const { signatures } = JSON.parse(text);
  if (!Array.isArray(signatures)) {
    throw new Error('signed.json has no signatures list');
  }
  return new Set(
    signatures.map((signature, index) => {
      const valid =
        Object.keys(signature).sort().join() === signatureKeys.join() &&
        Number.isSafeInteger(signature.id) &&
        signature.id > 0 &&
        agreements.has(signature.agreement) &&
        /^\d+\.\d+$/.test(signature.version) &&
        /^\d{4}-\d{2}-\d{2}$/.test(signature.date);
      if (!valid) {
        throw new Error(
          `signed.json signature ${index} is not { id, agreement, version, date } with a numeric GitHub user id`,
        );
      }
      return signature.id;
    }),
  );
}

/**
 * @param {{
 *   fetch: (url: string, init: { headers: Record<string, string> }) => Promise<Response>,
 *   apiUrl: string,
 *   repository: string,
 *   token: string,
 *   pullNumber: number,
 * }} options
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function checkCla({ fetch, apiUrl, repository, token, pullNumber }) {
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

  const pull = JSON.parse(await get(`repos/${repository}/pulls/${pullNumber}`));
  if (pull.commits > listedCommits) {
    return {
      ok: false,
      message: `The pull request has ${pull.commits} commits, and GitHub lists only ${listedCommits}, so the CLA check cannot read every commit author. Squash or split the pull request.`,
    };
  }

  const defaultBranch = pull.base.repo.default_branch;
  const signed = parseSignatures(
    await get(
      `repos/${repository}/contents/.github/cla/signed.json?ref=${encodeURIComponent(defaultBranch)}`,
      'application/vnd.github.raw+json',
    ),
  );

  const commits = [];
  for (let page = 1; commits.length < pull.commits; page += 1) {
    const listed = JSON.parse(
      await get(
        `repos/${repository}/pulls/${pullNumber}/commits?per_page=${commitsPerPage}&page=${page}`,
      ),
    );
    commits.push(...listed);
    if (listed.length < commitsPerPage) {
      break;
    }
  }

  const release =
    pull.user.id === githubActions &&
    pull.head.repo?.full_name === pull.base.repo.full_name &&
    pull.head.ref.startsWith(releaseBranch);
  const exempt = new Set([maintainer, renovate, ...(release ? [githubActions] : [])]);

  const unsigned = new Map();
  const unlinked = [];
  for (const account of [pull.user, ...commits.map((commit) => commit.author)]) {
    if (account !== null && !exempt.has(account.id) && !signed.has(account.id)) {
      unsigned.set(account.id, `@${account.login}`);
    }
  }
  for (const commit of commits) {
    if (commit.author === null) {
      unlinked.push(commit.sha.slice(0, 7));
    }
  }

  if (unsigned.size === 0 && unlinked.length === 0) {
    return { ok: true, message: '' };
  }

  const blob = `https://github.com/${repository}/blob/${defaultBranch}`;
  const lines = [];
  if (unsigned.size > 0) {
    lines.push(
      `The contributor license agreement is not signed by ${[...unsigned.values()].join(', ')}.`,
      `To sign, read ${blob}/CLA.md and post this sentence as a comment on this pull request:`,
      '',
      signSentence,
      '',
      `If your employer owns the work you contribute, your employer signs ${blob}/CLA-corporate.md instead.`,
      'The maintainer then records the signature in .github/cla/signed.json and runs this check again.',
    );
  }
  if (unlinked.length > 0) {
    lines.push(
      `Commit ${unlinked.join(', ')} has an author email that belongs to no GitHub account, so its author cannot sign.`,
      'Set git user.email to an address of your GitHub account, amend the commit with --reset-author and push it again.',
    );
  }
  return { ok: false, message: lines.join('\n') };
}

// The job passes the pull request number through the environment, never inside the run script.
if (import.meta.main) {
  const { ok, message } = await checkCla({
    fetch,
    apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com',
    repository: process.env.GITHUB_REPOSITORY ?? '',
    token: process.env.GITHUB_TOKEN ?? '',
    pullNumber: Number(process.env.PR_NUMBER),
  });
  if (!ok) {
    console.log(errorAnnotation(message));
    process.exitCode = 1;
  }
}
