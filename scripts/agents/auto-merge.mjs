// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Turns on auto-merge for a low pull request (ADR 0086 rule 5): `pnpm agent:auto-merge <number>`.
// GitHub then squash-merges it once every required check passes; a pull request whose checks have
// all passed already, which GitHub does not take auto-merge for, is squash-merged at once. The
// script refuses unless the pull request is low by the risk gate's own rules and Risk / risk gate
// passed on its head commit. It reads the check run, not the risk:low label, because the machine
// user can set labels itself. The script guards against a session's mistake, not an injected one:
// a session can edit it or call GitHub's API itself. The control that holds is GitHub's: code
// owner review on the risk paths and the required risk gate keep a high pull request from merging.

import { checkRisk } from '../ci/risk-gate.mjs';

// The GitHub Actions app, the only integration whose risk gate counts, as in the main ruleset.
const actionsApp = 15368;

/**
 * Why auto-merge must not be turned on, or undefined when it may.
 * @param {{
 *   risk: { tier: 'low' | 'high', reasons: readonly string[] },
 *   checkRuns: readonly { id?: number, name: string, head_sha: string, status: string, conclusion: string | null, app?: { id: number } | null }[],
 *   headSha: string,
 * }} options
 * @returns {string | undefined}
 */
export function autoMergeRefusal({ risk, checkRuns, headSha }) {
  if (risk.tier !== 'low') {
    return `The pull request is high risk: ${risk.reasons.join('; ')}. It merges after the maintainer approves it.`;
  }
  const [latest] = checkRuns
    .filter(
      (run) => run.name === 'risk gate' && run.app?.id === actionsApp && run.head_sha === headSha,
    )
    // Check run ids grow with each run, so the highest id is the latest run, finished or not.
    .toSorted((a, b) => (b.id ?? 0) - (a.id ?? 0));
  if (latest?.status !== 'completed' || latest.conclusion !== 'success') {
    return 'Risk / risk gate has not passed on the head commit yet. Wait for it and run this again.';
  }
  return undefined;
}

async function github(path, token, init = {}) {
  const response = await fetch(`https://api.github.com/${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub answered ${response.status} to ${init.method ?? 'GET'} /${path}`);
  }
  return response.json();
}

if (import.meta.main) {
  const repository = 'northMES/northmes';
  const token = process.env.GH_TOKEN ?? '';
  const pullNumber = Number(process.argv[2]);
  if (!Number.isInteger(pullNumber) || pullNumber <= 0) {
    console.error('Usage: pnpm agent:auto-merge <pull request number>');
    process.exit(2);
  }
  const pull = await github(`repos/${repository}/pulls/${pullNumber}`, token);
  const risk = await checkRisk({
    fetch,
    apiUrl: 'https://api.github.com',
    repository,
    token,
    pullNumber,
  });
  const { check_runs: checkRuns } = await github(
    `repos/${repository}/commits/${pull.head.sha}/check-runs?check_name=${encodeURIComponent('risk gate')}`,
    token,
  );
  const refusal = autoMergeRefusal({ risk, checkRuns, headSha: pull.head.sha });
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }
  // GitHub takes auto-merge only for a pull request that cannot merge yet, so a clean one merges now.
  const now = pull.mergeable_state === 'clean';
  const mutation = now ? 'mergePullRequest' : 'enablePullRequestAutoMerge';
  const { errors } = await github('graphql', token, {
    method: 'POST',
    body: JSON.stringify({
      query: `mutation($id: ID!, $sha: GitObjectID!) { ${mutation}(input: { pullRequestId: $id, mergeMethod: SQUASH, expectedHeadOid: $sha }) { clientMutationId } }`,
      variables: { id: pull.node_id, sha: pull.head.sha },
    }),
  });
  if (errors) {
    console.error(`GitHub refused ${mutation}: ${errors.map(({ message }) => message).join('; ')}`);
    process.exit(1);
  }
  console.log(
    now
      ? `#${pullNumber} is squash-merged.`
      : `Auto-merge is on for #${pullNumber}. GitHub squash-merges it once every required check passes.`,
  );
}
