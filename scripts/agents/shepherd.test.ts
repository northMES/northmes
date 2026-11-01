// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { fromGraph, report, triage } from './shepherd.mjs';

const maintainer = 24939000; // Krister-Johansson
const head = 'bcbc2c93161c01e59123af774d9b7ee8db38f582';

const merging = {
  number: 973,
  isDraft: false,
  mergeStateStatus: 'CLEAN',
  inMergeQueue: false,
  leftQueue: undefined,
  autoMerge: true,
  tier: 'low' as const,
  headSha: head,
  reviews: [],
  reviewRequested: [],
  requestedSinceHead: [],
  checks: [{ name: 'risk gate', conclusion: 'SUCCESS' }],
  threads: [],
};
const high = { ...merging, tier: 'high' as const };
const approvedHead = [{ userId: maintainer, state: 'APPROVED', commitId: head }];

describe('#978 the shepherd names what each open pull request waits on', () => {
  it('#978 a low pull request with auto-merge on, green checks and no open thread is merging', () => {
    expect(triage(merging)).toEqual(['merging: nothing to do']);
  });

  it('#978 a draft is left to its session, whatever else it waits on', () => {
    expect(triage({ ...merging, isDraft: true, mergeStateStatus: 'DIRTY' })).toEqual([
      'draft: leave it to its session',
    ]);
  });

  it('#978 a conflict needs a rebase with generated files rebuilt', () => {
    expect(triage({ ...merging, mergeStateStatus: 'DIRTY' })).toEqual([
      'conflict with main: rebase onto origin/main in the shepherd worktree, rebuild generated files with their command, and push',
    ]);
  });

  it('ADR0093 a branch that is only behind main needs no rebase: the merge queue builds it on main', () => {
    expect(triage({ ...merging, mergeStateStatus: 'BEHIND' })).toEqual(['merging: nothing to do']);
  });

  it('ADR0093 a pull request the queue dropped names the queue run to read and the one step to take, in place of the auto-merge line', () => {
    const dropped = { ...merging, leftQueue: { reason: 'CI_FAILURE' } };

    expect(triage(dropped)).toEqual([
      'left the merge queue (CI_FAILURE): its checks failed on the queue commit, not on the head; find the run with gh run list --event merge_group --limit 100 --json headBranch,databaseId,conclusion and its branch gh-readonly-queue/main/pr-973-<sha>, read its log by the rule of CLAUDE.md, then run pnpm agent:auto-merge 973 once more',
    ]);
    expect(triage({ ...dropped, autoMerge: false })).toEqual(triage(dropped));
    expect(triage({ ...dropped, leftQueue: { reason: 'CI_TIMEOUT' } })[0]).toContain(
      'left the merge queue (CI_TIMEOUT): its checks failed',
    );
  });

  it("ADR0093 a pull request a person or the queue took out for another reason is the maintainer's, not re-queued", () => {
    for (const reason of ['DEQUEUED', 'MERGE_CONFLICT', 'QUEUE_CLEARED', 'no reason given']) {
      expect(triage({ ...merging, leftQueue: { reason }, autoMerge: false })).toEqual([
        `left the merge queue (${reason}): not for a failed check, so a person or the queue took it out; the maintainer decides whether it goes back`,
      ]);
    }
  });

  it("ADR0093 a pull request in the merge queue is GitHub's, whatever else it shows", () => {
    expect(
      triage({
        ...merging,
        inMergeQueue: true,
        mergeStateStatus: 'BLOCKED',
        autoMerge: false,
        checks: [{ name: 'e2e', conclusion: 'FAILURE' }],
      }),
    ).toEqual(['in the merge queue: GitHub builds it on main and merges it']);
  });

  it('#978 each check that failed, timed out, was cancelled or errored is named with its conclusion', () => {
    expect(
      triage({
        ...merging,
        checks: [
          { name: 'e2e', conclusion: 'FAILURE' },
          { name: 'test', conclusion: 'SUCCESS' },
          { name: 'build', conclusion: 'TIMED_OUT' },
          { name: 'lint', conclusion: 'CANCELLED' },
          { name: 'cla', conclusion: 'STARTUP_FAILURE' },
          { name: 'Docs7 Preview', conclusion: 'ERROR' },
          { name: 'react doctor', conclusion: 'SKIPPED' },
          { name: 'typecheck', conclusion: 'NEUTRAL' },
          { name: 'gate', conclusion: undefined },
        ],
      }),
    ).toEqual([
      'failed check e2e (FAILURE): read its log, then re-run it by the rule of CLAUDE.md or fix the change',
      'failed check build (TIMED_OUT): read its log, then re-run it by the rule of CLAUDE.md or fix the change',
      'failed check lint (CANCELLED): read its log, then re-run it by the rule of CLAUDE.md or fix the change',
      'failed check cla (STARTUP_FAILURE): read its log, then re-run it by the rule of CLAUDE.md or fix the change',
      'failed check Docs7 Preview (ERROR): read its log, then re-run it by the rule of CLAUDE.md or fix the change',
    ]);
  });

  it('#978 a check that passed at the head in a later run is not failed for an earlier run at the same head', () => {
    expect(
      triage({
        ...merging,
        checks: [
          { name: 'risk gate', conclusion: 'FAILURE' },
          { name: 'risk gate', conclusion: 'SUCCESS' },
        ],
      }),
    ).toEqual(['merging: nothing to do']);
  });

  it("#978 the red risk gate of a high pull request before the maintainer's approval is the approval, not a failed check", () => {
    expect(
      triage({
        ...high,
        checks: [{ name: 'risk gate', conclusion: 'FAILURE' }],
        reviewRequested: [maintainer],
      }),
    ).toEqual(["waits for the maintainer's approval of bcbc2c93"]);
  });

  it('#978 a risk gate still red after the approval waits for Risk refresh before a re-run', () => {
    expect(
      triage({
        ...high,
        checks: [{ name: 'risk gate', conclusion: 'FAILURE' }],
        reviews: approvedHead,
      }),
    ).toEqual([
      'risk gate red after the approval of bcbc2c93: wait a few minutes for Risk refresh, then re-run it by the rule of CLAUDE.md',
    ]);
  });

  it('#978 a failed Argos check is not required and names the maintainer, not a log', () => {
    expect(triage({ ...merging, checks: [{ name: 'argos', conclusion: 'FAILURE' }] })).toEqual([
      'Argos reports a visual difference: not a required check; the maintainer approves it in Argos',
    ]);
  });

  it("#978 CodeRabbit's open threads are counted", () => {
    expect(
      triage({
        ...merging,
        threads: [
          { author: 'coderabbitai', resolved: false },
          { author: 'coderabbitai', resolved: true },
          { author: 'coderabbitai', resolved: false },
        ],
      }),
    ).toEqual([
      '2 CodeRabbit threads: check each against the code, fix or reply with the reason, and resolve',
    ]);
  });

  it("#978 a person's open thread is left for them, and a deleted account's goes to the maintainer", () => {
    expect(
      triage({
        ...merging,
        threads: [
          { author: 'Krister-Johansson', resolved: false },
          { author: undefined, resolved: false },
        ],
      }),
    ).toEqual([
      'thread by Krister-Johansson: leave it for them to resolve',
      'thread by a deleted account: the maintainer resolves it',
    ]);
  });

  it("#978 a high pull request waits for the maintainer's approval of its head once his review is requested", () => {
    expect(triage({ ...high, reviewRequested: [maintainer] })).toEqual([
      "waits for the maintainer's approval of bcbc2c93",
    ]);
  });

  it('#978 a request made since the head was committed counts as made, also after a comment cleared it', () => {
    expect(triage({ ...high, requestedSinceHead: [maintainer] })).toEqual([
      "waits for the maintainer's approval of bcbc2c93",
    ]);
  });

  it('#978 a request made since the head was committed counts as made, also after a comment cleared it', () => {
    expect(triage({ ...high, requestedSinceHead: [maintainer] })).toEqual([
      "waits for the maintainer's approval of bcbc2c93",
    ]);
  });

  it('#978 a new head on a high pull request with no review of it re-requests the review', () => {
    const approvedOld = [{ userId: maintainer, state: 'APPROVED', commitId: 'a1b2c3d4' }];

    expect(triage(high)).toEqual([
      "new head bcbc2c93 on a high pull request: re-request the maintainer's review",
    ]);
    expect(triage({ ...high, reviews: approvedOld })).toEqual([
      "new head bcbc2c93 on a high pull request: re-request the maintainer's review",
    ]);
  });

  it("#978 the maintainer's approval of the head lets a high pull request merge, also with a later comment", () => {
    const comment = [...approvedHead, { userId: maintainer, state: 'COMMENTED', commitId: head }];

    expect(triage({ ...high, reviews: approvedHead })).toEqual(['merging: nothing to do']);
    expect(triage({ ...high, reviews: comment })).toEqual(['merging: nothing to do']);
  });

  it("#978 another account's approval does not count as the maintainer's", () => {
    expect(
      triage({ ...high, reviews: [{ userId: 1, state: 'APPROVED', commitId: head }] }),
    ).toEqual(["new head bcbc2c93 on a high pull request: re-request the maintainer's review"]);
  });

  it("#978 the maintainer's request for changes or dismissal on the head is the branch's, not a review request", () => {
    const changes = [
      ...approvedHead,
      { userId: maintainer, state: 'CHANGES_REQUESTED', commitId: head },
    ];
    const dismissed = [{ userId: maintainer, state: 'DISMISSED', commitId: head }];

    expect(triage({ ...high, reviews: changes })).toEqual([
      'the maintainer requested changes on bcbc2c93: the branch needs a session, not a review request',
    ]);
    expect(triage({ ...high, reviews: dismissed })).toEqual([
      'the maintainer dismissed a review of bcbc2c93: the branch needs a session, not a review request',
    ]);
  });

  it('#978 a pull request without a risk label says the Risk run has not reported', () => {
    expect(triage({ ...merging, tier: undefined })).toEqual([
      'no risk label yet: the Risk run has not reported; look again later',
    ]);
  });

  it('#978 a pull request without auto-merge names the one step', () => {
    expect(triage({ ...merging, autoMerge: false })).toEqual([
      'auto-merge is off: run pnpm agent:auto-merge 973',
    ]);
  });

  it('#978 a blocked or not yet computed merge state with nothing else to do is named, not called merging', () => {
    expect(triage({ ...merging, mergeStateStatus: 'BLOCKED' })).toEqual([
      'blocked by GitHub for a reason this view does not show (a required check not reported yet, a ruleset rule): look again later, then ask the maintainer',
    ]);
    expect(triage({ ...merging, mergeStateStatus: 'UNKNOWN' })).toEqual([
      'merge state not computed yet, as right after a push: look again later',
    ]);
    expect(triage({ ...merging, mergeStateStatus: 'BLOCKED', autoMerge: false })).toEqual([
      'auto-merge is off: run pnpm agent:auto-merge 973',
    ]);
  });

  it('#978 the report lists each pull request with its needs, and says so when there is none', () => {
    expect(
      report([
        { number: 973, title: 'docs: the agent token', needs: ['merging: nothing to do'] },
        { number: 969, title: 'feat(core): machines', needs: ['behind main', 'waits'] },
      ]),
    ).toBe(
      [
        '#973 docs: the agent token',
        '  - merging: nothing to do',
        '#969 feat(core): machines',
        '  - behind main',
        '  - waits',
      ].join('\n'),
    );
    expect(report([])).toBe('northmes-agent has no open pull request.');
  });
});

describe('#978 fromGraph shapes a pull request of the query as triage reads it', () => {
  const node = {
    number: 969,
    title: 'feat(core): machines',
    isDraft: false,
    mergeStateStatus: 'BEHIND',
    isInMergeQueue: false,
    dequeued: { nodes: [] },
    headRefOid: head,
    autoMergeRequest: { enabledAt: '2026-11-01T09:00:00Z' },
    labels: { nodes: [{ name: 'risk:high' }, { name: 'core' }] },
    reviewRequests: {
      nodes: [{ requestedReviewer: { databaseId: maintainer } }, { requestedReviewer: {} }],
    },
    timelineItems: {
      nodes: [
        { createdAt: '2026-11-01T08:00:00Z', requestedReviewer: { databaseId: maintainer } },
        { createdAt: '2026-11-01T10:00:00Z', requestedReviewer: { databaseId: maintainer } },
        { createdAt: '2026-11-01T11:00:00Z', requestedReviewer: {} },
      ],
    },
    reviews: {
      nodes: [
        { author: { databaseId: 1 }, state: 'COMMENTED', commit: { oid: head } },
        { author: null, state: 'APPROVED', commit: { oid: head } },
      ],
    },
    reviewThreads: {
      nodes: [
        { isResolved: false, comments: { nodes: [{ author: { login: 'coderabbitai' } }] } },
        { isResolved: false, comments: { nodes: [{ author: null }] } },
      ],
    },
    commits: {
      nodes: [
        {
          commit: {
            committedDate: '2026-11-01T09:00:00Z',
            statusCheckRollup: {
              contexts: {
                nodes: [
                  { name: 'risk gate', conclusion: 'FAILURE' },
                  { name: 'e2e', conclusion: null },
                  { context: 'argos', state: 'SUCCESS' },
                ],
              },
            },
          },
        },
      ],
    },
  };

  it('#978 the tier comes from the risk label, the reviews and requests carry user ids, and a Team request is nobody', () => {
    const pull = fromGraph(node);

    expect(pull).toMatchObject({
      number: 969,
      title: 'feat(core): machines',
      isDraft: false,
      mergeStateStatus: 'BEHIND',
      inMergeQueue: false,
      leftQueue: undefined,
      autoMerge: true,
      tier: 'high',
      headSha: head,
      reviews: [
        { userId: 1, state: 'COMMENTED', commitId: head },
        { userId: 0, state: 'APPROVED', commitId: head },
      ],
      reviewRequested: [maintainer, 0],
      requestedSinceHead: [maintainer, 0],
    });
  });

  it('#978 the checks come from check runs and statuses alike, and a running check has no conclusion', () => {
    expect(fromGraph(node).checks).toEqual([
      { name: 'risk gate', conclusion: 'FAILURE' },
      { name: 'e2e', conclusion: undefined },
      { name: 'argos', conclusion: 'SUCCESS' },
    ]);
  });

  it("#978 a thread carries its first comment's author, and a deleted author is undefined", () => {
    expect(fromGraph(node).threads).toEqual([
      { author: 'coderabbitai', resolved: false },
      { author: undefined, resolved: false },
    ]);
  });

  it('ADR0093 a removal from the queue counts when it came after the head was committed and the pull request is not back in the queue', () => {
    const removed = (createdAt: string, extra = {}) =>
      fromGraph({
        ...node,
        dequeued: { nodes: [{ createdAt, reason: 'CI_FAILURE' }] },
        ...extra,
      }).leftQueue;

    expect(removed('2026-11-01T10:00:00Z')).toEqual({ reason: 'CI_FAILURE' });
    expect(removed('2026-11-01T08:00:00Z')).toBeUndefined();
    expect(removed('2026-11-01T10:00:00Z', { isInMergeQueue: true })).toBeUndefined();
    expect(
      fromGraph({ ...node, dequeued: { nodes: [{ createdAt: '2026-11-01T10:00:00Z' }] } })
        .leftQueue,
    ).toEqual({ reason: 'no reason given' });
    expect(fromGraph({ ...node, dequeued: undefined }).leftQueue).toBeUndefined();
  });

  it('#978 no label, no auto-merge and no check rollup read as what they are', () => {
    const pull = fromGraph({
      ...node,
      autoMergeRequest: null,
      labels: { nodes: [] },
      reviewRequests: { nodes: [] },
      reviews: { nodes: [] },
      reviewThreads: { nodes: [] },
      timelineItems: { nodes: [] },
      commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
    });

    expect(pull).toMatchObject({
      autoMerge: false,
      tier: undefined,
      checks: [],
      threads: [],
      requestedSinceHead: [],
    });
  });
});
