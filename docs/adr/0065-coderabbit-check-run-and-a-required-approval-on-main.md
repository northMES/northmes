---
status: "proposed"
date: 2026-10-06
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors, coding agents
release: "1"
needs-confirmation: ""
---

# CodeRabbit check run and a required approval on main

## Context and problem statement

[ADR 0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) set the branch ruleset on `main` to require a pull request with 0 approvals, and `.coderabbit.yaml` turned off CodeRabbit's check run and commit status (`review_progress: false`, `commit_status: false`, `fail_commit_status: false`). The comment in that file gave the reason: handoff's PR node reads the whole check rollup of the head commit, so a CodeRabbit check that stayed pending would hold a run with no time limit, while `waitForReviewers` has one. With that setup the merge box shows nothing from CodeRabbit until it posts a review, and GitHub lets a pull request merge that CodeRabbit never reviewed. handoff's PR node waits for `coderabbitai[bot]` for `reviewTimeoutMinutes` (30) and then goes on without a review.

On 2026-10-05 Krister changed the `main` ruleset to require 1 approving review and decided to turn on CodeRabbit's check run. On 2026-10-06 he decided to turn on handoff's review comment loop in the three NorthMES graphs, so a run answers review comments and resolves their threads itself. This ADR records both decisions. It covers `.coderabbit.yaml`, the `main` ruleset and who approves which pull requests. The CodeRabbit setup is described in [docs/agents/coderabbit.md](../agents/coderabbit.md), and handoff's PR node in [docs/agents/handoff/README.md](../agents/handoff/README.md).

CodeRabbit's configuration reference and changelog say:

* With `reviews.review_progress` on, CodeRabbit publishes a review's status and progress through GitHub progress reports and check runs. The setting defaults to on.
* `reviews.commit_status` mirrors that progress as a legacy commit status, and only while `review_progress` is off.
* `reviews.fail_commit_status` fails the active status surface on review errors. It defaults to off.

`.coderabbit.yaml` already turns on `request_changes_workflow`: CodeRabbit requests changes when it posts actionable comments and approves a reviewed head commit once its threads are resolved. It also turns on `allow_author_approval`, so `@coderabbitai approve` works on pull requests that Krister authored.

handoff's PR node behaves as follows:

* Its CI status is the state of the head commit's check rollup, except for checks named after a reviewer in `waitForReviewers`. Since Krister-Johansson/handoff#657, such a check, CodeRabbit's included, counts as that reviewer's progress: it does not count toward CI or `requireChecks`, a pending one does not hold the node as CI pending, a failed one does not go to the coder, and `reviewTimeoutMinutes` bounds the wait.
* It counts a reviewer as started on the head commit when the reviewer reviewed that commit or when a check named after the reviewer is in progress there. The node's `reviewRequest` setting uses this to ask only a reviewer that has not started. All three NorthMES graphs set `reviewRequest` ([pull request #209](https://github.com/northMES/northmes/pull/209)).
* Its review decision is GitHub's review decision for the pull request. Its `ready` port needs a decision other than changes requested, and changes requested sends the run back to the coder. With review threads on, a reviewer's standing request for changes stops sending the run back once handoff has answered every item that reviewer raised (`github.changes_requested_answered`).
* With review threads on (`reviewThreads`), the PR node runs handoff's review comment loop. Each unresolved thread, each review summary that is not an approval, and each walkthrough note and failed or warning pre-merge check in CodeRabbit's summary comment is a review item. The coder answers each item as fixed with the commit, or as declined, unclear or a duplicate with its evidence, and posts nothing on GitHub. After it pushes any fix, the PR node posts each answer in the item's thread and resolves the thread after the reviewer's next review. It waits for that review up to `reviewTimeoutMinutes` (30) for a bot and up to `personWaitHours` (24 hours) for a person. An item the loop cannot settle, such as one whose reviewer does not review again within that time or one the coder declines again after the reviewer's reply, is disputed, and the PR node asks one question about its disputed items, with Resolve, Send back or Leave for each. A thread that Krister leaves, that another person takes over or that handoff's token cannot resolve stays open, and the merge step lists it. All three NorthMES graphs set `"reviewThreads": { "reply": true, "summary": "coderabbitai" }` and keep handoff's defaults for the other settings ([Review comments](../agents/handoff/README.md#review-comments)).

## Decision drivers

* Krister and the operating session see in the merge box whether CodeRabbit is reviewing the head commit.
* GitHub keeps a pull request from merging before its head commit is approved, because handoff's PR node goes on after its review timeout.
* Pull requests that CodeRabbit skips still merge, with no bypass actors on the ruleset. CodeRabbit skips pull requests from `renovate[bot]` and `dependabot[bot]` (`ignore_usernames`) and release pull requests titled `chore(main): release` (`ignore_title_keywords`).
* handoff and sessions open pull requests with Krister's token, so Krister is their author, and GitHub does not let an author approve their own pull request.
* An error inside CodeRabbit does not fail the head commit's checks.

## Considered options

* Status quo: no check run, 0 required approvals
* Check run only, 0 required approvals
* Check run as a required status check
* Check run plus 1 required approving review

## Decision outcome

Chosen option: "Check run plus 1 required approving review", because it shows CodeRabbit in the merge box and lets handoff see a review in progress, while the gate is an approval. CodeRabbit gives that approval on Krister's pull requests, and Krister gives it on the pull requests that CodeRabbit skips.

Settings:

* `.coderabbit.yaml`: `reviews.review_progress: true`. `commit_status: false`, since it would apply only with `review_progress` off. `fail_commit_status: false`, so a CodeRabbit error does not fail the head commit. `request_changes_workflow: true` and `allow_author_approval: true` stay as they are.
* Branch ruleset `main`, live since 2026-10-05: a pull request rule with `required_approving_review_count: 1`, `dismiss_stale_reviews_on_push: true`, `required_review_thread_resolution: true`, `require_code_owner_review: false`, `require_last_push_approval: false`, `require_extra_approval_for_unattributed_changes: true` and `allowed_merge_methods: ["squash"]`; deletion and force pushes blocked; linear history; no bypass actors.
* The CodeRabbit check is not a required status check. The live ruleset has no required status checks yet. Task E00-S04-T03 adds the ones ADR 0050 lists, and the CodeRabbit check is not one of them.

Who approves:

* Pull requests that a handoff run opens with Krister's token: CodeRabbit approves the head commit once its review of that commit is complete and its threads are resolved. The PR node answers CodeRabbit's comments, resolves the answered threads after CodeRabbit's next review, and asks Krister about the disputed items. Once handoff has answered every item CodeRabbit raised, CodeRabbit's standing request for changes no longer sends the run back to the coder, so the run also reaches the merge step without CodeRabbit's approval of the head commit: after a fix round that CodeRabbit did not review before handoff's timeout, after a finding the coder declined, or when CodeRabbit never reviewed the pull request. When Krister accepts the head commit, he posts `@coderabbitai approve`, which resolves CodeRabbit's threads and asks it to approve. On the guided graph he posts it before he requests the merge; on the standard and lean graphs the merge step fails with `merge_failed` while the head commit has no approval. The PR node also answers threads from people and resolves each one after that person's next review, which it waits for up to 24 hours. Krister resolves by hand the threads that handoff leaves open, which the merge step lists.
* Pull requests that a session opens with Krister's token: CodeRabbit approves the head commit once its review of that commit is complete and its threads are resolved. When CodeRabbit has not approved and Krister accepts the head commit, he posts `@coderabbitai approve`. Threads from people are resolved by hand.
* Pull requests from `renovate[bot]` and `dependabot[bot]`: Krister approves them himself, because CodeRabbit skips them and Krister is not their author.
* Release pull requests (`chore(main): release`): CodeRabbit skips them by title. release-please opens them with the Actions token or a GitHub App token (spike SP2 chooses), so Krister is not their author, and he approves them before he merges them.
* Pull requests from contributors: CodeRabbit reviews them like any other, and either CodeRabbit's approval or Krister's satisfies the rule.
* A pull request that Copilot opens under its own app identity, not on behalf of a person, needs one more approval than the rule sets (`require_extra_approval_for_unattributed_changes`, on by default and in public preview). NorthMES does not use the Copilot coding agent, so the setting changes nothing today, and the ruleset keeps GitHub's default.

### Changes to ADR 0049

ADR 0049 is accepted, so its text stays as it was. This ADR replaces one part of it, and the rest of ADR 0049 stands.

| ADR 0049 | Replaced by |
|---|---|
| Runs: "On the guided graph Krister resolves review threads before requesting the merge; on the standard and lean graphs an open thread must not block the automatic merge (switch criterion 4 in [docs/agents/handoff/README.md](../agents/handoff/README.md))." | In every graph the pull request step answers review comments, resolves their threads after the reviewer's next review, and asks Krister one question about the disputed items ([Review comments](../agents/handoff/README.md#review-comments)). On the guided graph Krister resolves the threads that handoff leaves open before requesting the merge; on the standard and lean graphs an open thread must not block the automatic merge (switch criterion 4 in [docs/agents/handoff/README.md](../agents/handoff/README.md)). The spec rule before it in the same line stands |

### Changes to ADR 0050

ADR 0050 is accepted, so its text stays as it was. This ADR replaces two parts of it, and the rest of ADR 0050 stands.

| ADR 0050 | Replaced by |
|---|---|
| Repository settings and rulesets: "Branch ruleset on `main`: pull request required with 0 approvals" | Pull request required with 1 approving review, and stale approvals dismissed on push. The rest of that line stands: review threads resolved, squash merge only, linear history, the strict required checks, force push and deletion blocked, no bypass actors |
| Tooling modeled on gqlPrune: "The coder checks each finding against the issue and the ADRs instead of obeying it, and lists rejected findings with the reason in the pull request description." | The coder checks each finding against the issue and the ADRs instead of obeying it, and answers it as fixed with the commit, or as declined, unclear or a duplicate with its evidence. The pull request step posts each answer on the pull request, in the finding's thread when it has one, and resolves the thread after CodeRabbit's next review ([Review comments](../agents/handoff/README.md#review-comments)). The rest of that line stands |

The `CODEOWNERS` line of ADR 0050 stands: code owner review stays off, because `CODEOWNERS` names only Krister and he cannot approve his own pull requests.

### Consequences

* Good, because the merge box shows CodeRabbit's check on the head commit, so Krister sees whether a review is running or done.
* Good, because handoff counts the check in progress as a started review, so the pull request step asks CodeRabbit only when it has not started.
* Good, because GitHub refuses to merge a pull request whose head commit has no approval. A run that went on after `reviewTimeoutMinutes` with no CodeRabbit review at all stops at the merge step with `merge_failed` instead of merging.
* Good, because the CodeRabbit check is not required and a review error does not fail it, so the pull requests that CodeRabbit skips are not held by its check.
* Bad, because a CodeRabbit check that stays in progress shows as a pending check on the pull request, and handoff's dashboard list of pull requests shows it as CI pending. handoff's PR node does not wait on it as CI (Krister-Johansson/handoff#657); `reviewTimeoutMinutes` bounds the wait for CodeRabbit.
* Good, because the PR node answers review comments and resolves their threads, so the rule on resolved threads holds a handoff run only for the disputed items Krister decides and the threads handoff leaves open.
* Bad, because with a required review GitHub reports CodeRabbit's request for changes as the pull request's review decision until CodeRabbit approves a later commit (stale dismissal removes approvals only). Once handoff has answered every item CodeRabbit raised, the PR node no longer sends the run back for that request, but after a fix round that CodeRabbit does not review before the timeout, or a finding the coder declined, the head commit has no approval, and the merge needs Krister's `@coderabbitai approve`.
* Bad, because a thread from a person holds the PR step for up to 24 hours (`personWaitHours`) after the answer while it waits for that person's next review.
* Bad, because every push dismisses the approval (`dismiss_stale_reviews_on_push`). Each fix round and each catch-up merge from `main` needs a new CodeRabbit review and approval. While the repository has fewer than 10 stars, each of those also needs an `@coderabbitai review` comment, and each uses one review from the hourly allowance.
* Bad, because Renovate's pull requests no longer merge without a person: Krister approves each one, and again after Renovate pushes to it.
* Bad, because Krister cannot approve his own pull requests. When CodeRabbit does not approve, the fallback is `@coderabbitai approve`, which gives an approval without a new review. On those pull requests the rule shows that CodeRabbit or Krister accepted the head commit, not that CodeRabbit reviewed it.
* Neutral, because release pull requests now need Krister's approval before he merges them.

### Confirmation

* Config test, in `test/meta/github-files.test.ts` (task E00-S04-T03): ".coderabbit.yaml turns on incremental reviews, review_progress, request_changes_workflow and allow_author_approval, and turns off commit_status and fail_commit_status".
* Ruleset check (task E00-S04-T03): `scripts/repo/check-ruleset.mjs` reads the `main` ruleset through the GitHub API and fails when its pull request rule differs from an empty bypass list, `required_approving_review_count: 1`, `dismiss_stale_reviews_on_push: true`, `required_review_thread_resolution: true`, `require_extra_approval_for_unattributed_changes: true` and `allowed_merge_methods: ["squash"]`. `scripts/repo/check-ruleset.test.ts`: "a ruleset with 0 required approvals fails naming required_approving_review_count". A weekly CI job named `repo settings` runs `check-ruleset.mjs` against the live `main` ruleset.

Inspection steps, not checks: `gh api repos/northmes/northmes/rulesets/<id>` shows the rule above; `gh api repos/northmes/northmes/pulls/<number>/commits --jq '.[].author.login'` prints `Krister-Johansson` for every commit of a handoff pull request; on the first pull request CodeRabbit reviews after this change, `gh pr checks <number>` lists CodeRabbit's check, and `gh pr view <number> --json reviewDecision` shows `APPROVED` after its approval and no approval after a later push.

## Pros and cons of the options

### Check run plus 1 required approving review

* Good, because CodeRabbit is visible in the merge box, and handoff sees a review in progress.
* Good, because GitHub enforces the gate, and stale approval dismissal ties the approval to the head commit.
* Good, because Krister can approve the pull requests that CodeRabbit skips, so none of them needs a bypass actor.
* Bad, because every push needs a new approval, and a check that stays in progress shows as pending on the pull request (handoff's PR node bounds it by `reviewTimeoutMinutes` since Krister-Johansson/handoff#657).

### Status quo: no check run, 0 required approvals

* Good, because no CodeRabbit check enters the rollup.
* Good, because Renovate's pull requests need no approval.
* Bad, because the merge box shows nothing from CodeRabbit until it posts a review.
* Bad, because GitHub lets a pull request merge that CodeRabbit never reviewed, for example after handoff's review timeout.

### Check run only, 0 required approvals

* Good, because CodeRabbit is visible in the merge box, and handoff sees a review in progress.
* Bad, because nothing on GitHub requires CodeRabbit's approval before a merge.
* Bad, because a check that stays in progress holds a handoff run, as in the chosen option.

### Check run as a required status check

* Good, because the merge waits until CodeRabbit has finished a review of the head commit.
* Bad, because CodeRabbit skips pull requests from `renovate[bot]` and `dependabot[bot]` and release pull requests, and a required check that never reports on them would block them, with no bypass actor to merge them.
* Bad, because with `fail_commit_status: false` a review error does not fail the check, so the check shows that a review ended, not that its findings were handled.

## More information

* Related ADRs: [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) (the ruleset and the line on CodeRabbit findings this ADR changes), [0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md) (delivery with handoff, and the line on review threads this ADR changes).
* Plan: [13 delivery and GitHub, rulesets](../plan/13-delivery-and-github.md#rulesets). Agent docs: [docs/agents/coderabbit.md](../agents/coderabbit.md) and [docs/agents/handoff/README.md](../agents/handoff/README.md).
* CodeRabbit configuration reference: https://docs.coderabbit.ai/reference/configuration. CodeRabbit changelog, review progress reports: https://docs.coderabbit.ai/changelog.
* Revisit when a CodeRabbit check stays in progress on a handoff run longer than `reviewTimeoutMinutes`, and when a second maintainer joins who can approve Krister's pull requests.
