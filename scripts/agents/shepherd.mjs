// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The shepherd's view of the open pull requests (#978): `pnpm agent:shepherd` lists each open pull
// request that northmes-agent opened with what it waits on, so the pr-shepherd skill
// (.claude/skills/pr-shepherd/SKILL.md) can act on each one and the maintainer's step stays the
// approval. The script reads GitHub and prints; it changes nothing.

import { latestMaintainerReview, maintainer, maintainerApproved } from '../ci/risk-gate.mjs';

const repository = 'northMES/northmes';
const agentLogin = 'northmes-agent';
const coderabbit = 'coderabbitai';

// The conclusions and states of a check that block a merge: GitHub's CheckConclusionState and
// StatusState values other than success, neutral, skipped, pending and expected.
const failed = new Set([
  'FAILURE',
  'TIMED_OUT',
  'CANCELLED',
  'STARTUP_FAILURE',
  'ACTION_REQUIRED',
  'ERROR',
]);

// The Risk gate, which stays red on a high pull request until the maintainer approves its head
// (ADR 0086), and Argos, which is not a required check and waits for a person in Argos (ADR 0077).
const riskGate = 'risk gate';
const argos = 'argos';

/**
 * What one pull request waits on, in the order the shepherd acts: a draft is left alone; one in the
 * merge queue is GitHub's; a conflict needs a rebase, and a branch that is only behind main
 * nothing, since the queue builds it on main (ADR 0093); a failed check needs its log read; CodeRabbit's threads
 * need answers; a person's thread is theirs; a high pull request without the maintainer's approval
 * of its head waits for the maintainer, asked once per head (a request made since the head was
 * committed counts, also after a comment cleared it), or for its author once the maintainer asked
 * for changes; a pull request without auto-merge needs the one step of CLAUDE.md; a merge
 * state GitHub blocks for a reason the view does not show is named; and the rest is merging.
 * @param {{
 *   number: number,
 *   isDraft: boolean,
 *   mergeStateStatus: string,
 *   inMergeQueue: boolean,
 *   autoMerge: boolean,
 *   tier: 'low' | 'high' | undefined,
 *   headSha: string,
 *   reviews: readonly { userId: number, state: string, commitId: string }[],
 *   reviewRequested: readonly number[],
 *   requestedSinceHead: readonly number[],
 *   checks: readonly { name: string, conclusion: string | undefined }[],
 *   threads: readonly { author: string | undefined, resolved: boolean }[],
 * }} pull
 * @returns {string[]} one line per thing it waits on, or one line that says it is merging
 */
export function triage(pull) {
  if (pull.isDraft) return ['draft: leave it to its session'];
  if (pull.inMergeQueue) return ['in the merge queue: GitHub builds it on main and merges it'];
  const needs = [];
  const sha = pull.headSha.slice(0, 8);
  if (pull.mergeStateStatus === 'DIRTY') {
    needs.push(
      'conflict with main: rebase onto origin/main in the shepherd worktree, rebuild generated files with their command, and push',
    );
  }
  const approved = maintainerApproved(pull.reviews, pull.headSha);
  const latest = latestMaintainerReview(pull.reviews);
  // A check name that passed at the head passed, also when an earlier run of it at the same head
  // failed or was cancelled, as a Risk run before an approval is.
  const passed = new Set(
    pull.checks.filter(({ conclusion }) => conclusion === 'SUCCESS').map(({ name }) => name),
  );
  for (const { name, conclusion } of pull.checks) {
    if (!failed.has(conclusion ?? '') || passed.has(name)) continue;
    if (name === riskGate && pull.tier === 'high' && !approved) continue;
    if (name === riskGate && approved) {
      needs.push(
        `risk gate red after the approval of ${sha}: wait a few minutes for Risk refresh, then re-run it by the rule of CLAUDE.md`,
      );
    } else if (name === argos) {
      needs.push(
        'Argos reports a visual difference: not a required check; the maintainer approves it in Argos',
      );
    } else {
      needs.push(
        `failed check ${name} (${conclusion}): read its log, then re-run it by the rule of CLAUDE.md or fix the change`,
      );
    }
  }
  const open = pull.threads.filter(({ resolved }) => !resolved);
  const bot = open.filter(({ author }) => author === coderabbit).length;
  if (bot > 0) {
    needs.push(
      `${bot} CodeRabbit ${bot === 1 ? 'thread' : 'threads'}: check each against the code, fix or reply with the reason, and resolve`,
    );
  }
  for (const author of new Set(
    open.filter((thread) => thread.author !== coderabbit).map(({ author }) => author),
  )) {
    needs.push(
      author === undefined
        ? 'thread by a deleted account: the maintainer resolves it'
        : `thread by ${author}: leave it for them to resolve`,
    );
  }
  if (pull.tier === 'high' && !approved) {
    if (latest?.commitId === pull.headSha) {
      needs.push(
        `the maintainer ${latest.state === 'DISMISSED' ? 'dismissed a review of' : 'requested changes on'} ${sha}: the branch needs a session, not a review request`,
      );
    } else if (
      pull.reviewRequested.includes(maintainer) ||
      pull.requestedSinceHead.includes(maintainer)
    ) {
      needs.push(`waits for the maintainer's approval of ${sha}`);
    } else {
      needs.push(`new head ${sha} on a high pull request: re-request the maintainer's review`);
    }
  }
  if (pull.tier === undefined) {
    needs.push('no risk label yet: the Risk run has not reported; look again later');
  }
  if (!pull.autoMerge) needs.push(`auto-merge is off: run pnpm agent:auto-merge ${pull.number}`);
  if (needs.length === 0 && pull.mergeStateStatus === 'BLOCKED') {
    needs.push(
      'blocked by GitHub for a reason this view does not show (a required check not reported yet, a ruleset rule): look again later, then ask the maintainer',
    );
  }
  if (needs.length === 0 && pull.mergeStateStatus === 'UNKNOWN') {
    needs.push('merge state not computed yet, as right after a push: look again later');
  }
  return needs.length > 0 ? needs : ['merging: nothing to do'];
}

/** The lines of the report: the pull request, then one indented line per need. */
export function report(pulls) {
  if (pulls.length === 0) return `${agentLogin} has no open pull request.`;
  return pulls
    .map(({ number, title, needs }) =>
      [`#${number} ${title}`, ...needs.map((need) => `  - ${need}`)].join('\n'),
    )
    .join('\n');
}

// GitHub's view of the open pull requests northmes-agent opened, through the search so the author
// filter is GitHub's and the page is not shared with Renovate's and the release pull requests.
const query = `query($search: String!) {
  search(query: $search, type: ISSUE, first: 100) {
    nodes {
      ... on PullRequest {
        number title isDraft mergeStateStatus isInMergeQueue headRefOid
        autoMergeRequest { enabledAt }
        labels(first: 20) { nodes { name } }
        reviewRequests(first: 20) { nodes { requestedReviewer { ... on User { databaseId } } } }
        timelineItems(itemTypes: [REVIEW_REQUESTED_EVENT], last: 20) { nodes {
          ... on ReviewRequestedEvent { createdAt requestedReviewer { ... on User { databaseId } } }
        } }
        reviews(last: 100) { nodes { author { ... on User { databaseId } } state commit { oid } } }
        reviewThreads(first: 100) { nodes { isResolved comments(first: 1) { nodes { author { login } } } } }
        commits(last: 1) { nodes { commit { committedDate statusCheckRollup { contexts(first: 100) { nodes {
          ... on CheckRun { name conclusion }
          ... on StatusContext { context state }
        } } } } } }
      }
    }
  }
}`;

/** One pull request of the query's answer as triage reads it. */
export function fromGraph(node) {
  const labels = node.labels.nodes.map(({ name }) => name);
  const headCommit = node.commits.nodes[0]?.commit;
  const contexts = headCommit?.statusCheckRollup?.contexts.nodes ?? [];
  const committed = headCommit?.committedDate ?? '';
  return {
    number: node.number,
    title: node.title,
    isDraft: node.isDraft,
    mergeStateStatus: node.mergeStateStatus,
    inMergeQueue: node.isInMergeQueue === true,
    autoMerge: node.autoMergeRequest !== null,
    tier: labels.includes('risk:high') ? 'high' : labels.includes('risk:low') ? 'low' : undefined,
    headSha: node.headRefOid,
    reviews: node.reviews.nodes.map((review) => ({
      userId: review.author?.databaseId ?? 0,
      state: review.state,
      commitId: review.commit?.oid ?? '',
    })),
    reviewRequested: node.reviewRequests.nodes.map(
      ({ requestedReviewer }) => requestedReviewer?.databaseId ?? 0,
    ),
    // ISO 8601 strings in UTC compare as text.
    requestedSinceHead: (node.timelineItems?.nodes ?? [])
      .filter((event) => event.createdAt !== undefined && event.createdAt >= committed)
      .map(({ requestedReviewer }) => requestedReviewer?.databaseId ?? 0),
    checks: contexts.map((context) =>
      'context' in context
        ? { name: context.context, conclusion: context.state }
        : { name: context.name, conclusion: context.conclusion ?? undefined },
    ),
    threads: node.reviewThreads.nodes.map((thread) => ({
      author: thread.comments.nodes[0]?.author?.login ?? undefined,
      resolved: thread.isResolved,
    })),
  };
}

if (import.meta.main) {
  const token = process.env.GH_TOKEN ?? '';
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({
      query,
      variables: { search: `repo:${repository} is:pr is:open author:${agentLogin}` },
    }),
  });
  if (!response.ok) {
    console.error(`GitHub answered ${response.status} to the pull request query.`);
    process.exit(1);
  }
  const { data, errors } = await response.json();
  if (errors || !data?.search) {
    const reason = errors ? errors.map(({ message }) => message).join('; ') : 'no search result';
    console.error(`GitHub refused the query: ${reason}`);
    process.exit(1);
  }
  const pulls = data.search.nodes
    .filter((node) => node.number !== undefined)
    .map(fromGraph)
    .map((pull) => ({ ...pull, needs: triage(pull) }));
  console.log(report(pulls));
}
