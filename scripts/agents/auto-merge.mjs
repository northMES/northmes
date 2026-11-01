// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The one step a session takes once its pull request is open (ADR 0086 rule 5, ADR 0093):
// `pnpm agent:auto-merge <number>`. It turns on auto-merge, and GitHub adds the pull request to the
// merge queue once every required check passes, where it is built on the latest main, checked
// again and squash-merged; one whose checks have all passed already, which GitHub does not take
// auto-merge for, is added to the queue at once. For a high pull request it also asks the
// maintainer to review, posts a comment with the reasons and the Blast radius section so the
// maintainer sees what worries the session, and asks CodeRabbit to review. Risk / risk gate stays
// failed until the maintainer approves the head commit, so the pull request then merges by itself.
// The script refuses a pull request that northmes-agent did not open. It guards against a session's
// mistake, not an injected one: GitHub's required risk gate and code owner review are the controls
// that hold.

import { section } from '../ci/pull-request.mjs';
import { agent, checkRisk } from '../ci/risk-gate.mjs';

const maintainerLogin = 'Krister-Johansson';

// The first line of the comment for the maintainer, which also tells a second run it already asked.
const askLine = `@${maintainerLogin} this pull request waits for your review. It merges by itself once you approve its head commit.`;

/**
 * What the script does for a pull request: auto-merge, and for a high one a review request and a
 * comment for the maintainer.
 * @param {{ authorId: number, risk: { tier: 'low' | 'high', reasons: readonly string[] }, body: string, alreadyAsked?: boolean, baseRef: string }} pull
 * @returns {{ autoMerge: true, reviewer: string | undefined, comment: string | undefined }}
 */
export function shipPlan({ authorId, risk, body, alreadyAsked = false, baseRef }) {
  if (authorId !== agent) {
    throw new Error('Only a pull request that northmes-agent opened takes this step.');
  }
  // The main ruleset, the risk gate included, guards only pull requests into main; another base
  // would merge at once with no required check.
  if (baseRef !== 'main') {
    throw new Error(`The pull request targets ${baseRef}; open it against main (AGENTS.md).`);
  }
  if (risk.tier === 'low' || alreadyAsked) {
    return { autoMerge: true, reviewer: undefined, comment: undefined };
  }
  const blastRadius = section(body, 'Blast radius');
  const comment = [
    askLine,
    '',
    'The risk gate made it high because it:',
    ...risk.reasons.map((reason) => `- ${reason}`),
    ...(blastRadius ? ['', 'What the blast-radius review found:', '', blastRadius] : []),
  ].join('\n');
  return { autoMerge: true, reviewer: maintainerLogin, comment };
}

const mutations = {
  enqueuePullRequest:
    'mutation($id: ID!, $sha: GitObjectID!) { enqueuePullRequest(input: { pullRequestId: $id, expectedHeadOid: $sha }) { clientMutationId } }',
  mergePullRequest:
    'mutation($id: ID!, $sha: GitObjectID!) { mergePullRequest(input: { pullRequestId: $id, mergeMethod: SQUASH, expectedHeadOid: $sha }) { clientMutationId } }',
  enablePullRequestAutoMerge:
    'mutation($id: ID!, $sha: GitObjectID!) { enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: SQUASH, expectedHeadOid: $sha }) { clientMutationId } }',
};

// GitHub takes auto-merge only for a pull request that cannot merge yet, so a clean one, whose
// required checks (the risk gate included) have all passed, goes straight into the merge queue,
// through the same call GitHub's own Merge when ready button makes (ADR 0093). Until the ruleset
// has its merge queue rule, the same clean pull request is squash-merged now, as before.
/**
 * @param {string} mergeableState GitHub's mergeable_state of the pull request
 * @param {boolean} queueEnabled whether the base branch merges through a merge queue
 * @returns {{ mutation: keyof typeof mutations, query: string, now: boolean }}
 */
export function mergeMutation(mergeableState, queueEnabled) {
  const now = mergeableState === 'clean';
  const mutation = now
    ? queueEnabled
      ? 'enqueuePullRequest'
      : 'mergePullRequest'
    : 'enablePullRequestAutoMerge';
  return { mutation, query: mutations[mutation], now };
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
  const comments = await github(
    `repos/${repository}/issues/${pullNumber}/comments?per_page=100`,
    token,
  );
  const alreadyAsked = comments.some(
    (comment) => comment.user?.id === agent && comment.body?.startsWith(askLine),
  );
  let plan;
  try {
    plan = shipPlan({
      authorId: pull.user.id,
      risk,
      body: pull.body ?? '',
      alreadyAsked,
      baseRef: pull.base.ref,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  // Auto-merge first, so a refusal leaves no comment that promises a merge.
  const { data } = await github('graphql', token, {
    method: 'POST',
    body: JSON.stringify({
      query: 'query($id: ID!) { node(id: $id) { ... on PullRequest { isMergeQueueEnabled } } }',
      variables: { id: pull.node_id },
    }),
  });
  const queueEnabled = data?.node?.isMergeQueueEnabled === true;
  const mutate = (name) =>
    github('graphql', token, {
      method: 'POST',
      body: JSON.stringify({
        query: mutations[name],
        variables: { id: pull.node_id, sha: pull.head.sha },
      }),
    });
  let { mutation, now } = mergeMutation(pull.mergeable_state, queueEnabled);
  let { errors } = await mutate(mutation);
  // A pull request GitHub reports as blocked while it can enter the queue is refused auto-merge
  // with "clean status"; the queue takes it.
  if (
    errors &&
    queueEnabled &&
    !now &&
    errors.some(({ message }) => /clean status/i.test(message))
  ) {
    mutation = 'enqueuePullRequest';
    now = true;
    ({ errors } = await mutate(mutation));
  }
  if (errors) {
    console.error(`GitHub refused ${mutation}: ${errors.map(({ message }) => message).join('; ')}`);
    process.exit(1);
  }
  if (plan.reviewer && !now) {
    await github(`repos/${repository}/pulls/${pullNumber}/requested_reviewers`, token, {
      method: 'POST',
      body: JSON.stringify({ reviewers: [plan.reviewer] }),
    });
    for (const body of [plan.comment, '@coderabbitai review']) {
      await github(`repos/${repository}/issues/${pullNumber}/comments`, token, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
    }
  }
  console.log(
    now
      ? queueEnabled
        ? `#${pullNumber} is in the merge queue. GitHub builds it on the latest main, checks it and squash-merges it. You are done.`
        : `#${pullNumber} is squash-merged.`
      : plan.reviewer
        ? `Auto-merge is on for #${pullNumber}, and ${plan.reviewer} is asked to review. It joins the merge queue once the maintainer approves and every required check passes. You are done.`
        : `Auto-merge is on for #${pullNumber}. It joins the merge queue once every required check passes, and GitHub squash-merges it from there. You are done.`,
  );
}
