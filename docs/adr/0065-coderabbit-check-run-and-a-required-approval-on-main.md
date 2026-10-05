---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors, coding agents
release: "1"
needs-confirmation: ""
---

# CodeRabbit check run and a required approval on main

## Context and problem statement

[ADR 0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) set the branch ruleset on `main` to require a pull request with 0 approvals, and `.coderabbit.yaml` turned off CodeRabbit's check run and commit status (`review_progress: false`, `commit_status: false`, `fail_commit_status: false`). The comment in that file gave the reason: handoff's PR node reads the whole check rollup of the head commit, so a CodeRabbit check that stayed pending would hold a run with no time limit, while `waitForReviewers` has one. With that setup the merge box shows nothing from CodeRabbit until it posts a review, and GitHub lets a pull request merge that CodeRabbit never reviewed. handoff's PR node waits for `coderabbitai[bot]` for `reviewTimeoutMinutes` (30) and then goes on without a review.

On 2026-10-05 Krister changed the `main` ruleset to require 1 approving review and decided to turn on CodeRabbit's check run. This ADR records that decision. It covers `.coderabbit.yaml`, the `main` ruleset and who approves which pull requests. The CodeRabbit setup is described in [docs/agents/coderabbit.md](../agents/coderabbit.md), and handoff's PR node in [docs/agents/handoff/README.md](../agents/handoff/README.md).

CodeRabbit's configuration reference and changelog say:

* With `reviews.review_progress` on, CodeRabbit publishes a review's status and progress through GitHub progress reports and check runs. The setting defaults to on.
* `reviews.commit_status` mirrors that progress as a legacy commit status, and only while `review_progress` is off.
* `reviews.fail_commit_status` fails the active status surface on review errors. It defaults to off.

`.coderabbit.yaml` already turns on `request_changes_workflow`: CodeRabbit requests changes when it posts actionable comments and approves a reviewed head commit once its threads are resolved. It also turns on `allow_author_approval`, so `@coderabbitai approve` works on pull requests that Krister authored.

handoff's PR node behaves as follows:

* Its CI status is the state of the head commit's check rollup, so a pending check keeps the node waiting. `reviewTimeoutMinutes` limits the wait for a review, not the wait for a pending check.
* It counts a reviewer as started on the head commit when the reviewer reviewed that commit or when a check named after the reviewer is in progress there. The node's `reviewRequest` setting uses this to ask only a reviewer that has not started. None of the three NorthMES graphs sets `reviewRequest` yet; [pull request #209](https://github.com/northMES/northmes/pull/209), which is open, adds it to all three.
* Its review decision is GitHub's review decision for the pull request. Its `ready` port needs a decision other than changes requested, and changes requested sends the run back to the coder.

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

Chosen option: "Check run plus 1 required approving review", because it shows CodeRabbit in the merge box and, once pull request #209 merges, lets handoff see a review in progress, while the gate is an approval. CodeRabbit gives that approval on Krister's pull requests, and Krister gives it on the pull requests that CodeRabbit skips.

Settings:

* `.coderabbit.yaml`: `reviews.review_progress: true`. `commit_status: false`, since it would apply only with `review_progress` off. `fail_commit_status: false`, so a CodeRabbit error does not fail the head commit. `request_changes_workflow: true` and `allow_author_approval: true` stay as they are.
* Branch ruleset `main`, live since 2026-10-05: a pull request rule with `required_approving_review_count: 1`, `dismiss_stale_reviews_on_push: true`, `required_review_thread_resolution: true`, `require_code_owner_review: false`, `require_last_push_approval: false`, `require_extra_approval_for_unattributed_changes: true` and `allowed_merge_methods: ["squash"]`; deletion and force pushes blocked; linear history; no bypass actors.
* The CodeRabbit check is not a required status check. The live ruleset has no required status checks yet. Task E00-S04-T03 adds the ones ADR 0050 lists, and the CodeRabbit check is not one of them.

Who approves:

* Pull requests that handoff or a session opens with Krister's token: CodeRabbit approves the head commit once its review of that commit is complete and its threads are resolved. When CodeRabbit has not approved, Krister posts `@coderabbitai approve`. While CodeRabbit's request for changes stands (a fix round it did not review before handoff's timeout, or a finding that Krister rejects with the coder's reason), he posts it while the PR node waits after the coder's push, because otherwise the PR node sends the run back to the coder and never reaches the merge step. When CodeRabbit never reviewed the pull request, the run reaches the merge step: on the guided graph he posts it before he requests the merge, and on the standard and lean graphs the merge step fails with `merge_failed`. The comment resolves CodeRabbit's threads and asks it to approve. Threads from people are resolved by hand.
* Pull requests from `renovate[bot]` and `dependabot[bot]`: Krister approves them himself, because CodeRabbit skips them and Krister is not their author.
* Release pull requests (`chore(main): release`): CodeRabbit skips them by title. release-please opens them with the Actions token or a GitHub App token (spike SP2 chooses), so Krister is not their author, and he approves them before he merges them.
* Pull requests from contributors: CodeRabbit reviews them like any other, and either CodeRabbit's approval or Krister's satisfies the rule.
* A pull request with a commit that GitHub cannot attribute to an account needs one more approval (`require_extra_approval_for_unattributed_changes`). On Krister's pull requests only CodeRabbit can approve, so such a commit blocks the merge, and handoff and sessions commit with an email linked to Krister's account. handoff commits as `handoff@localhost` when the worker's git `user.email` is unset, and GitHub cannot attribute that address. The commits of pull request #192, made by a handoff run, were attributed to Krister's account because the worker's git config sets an email linked to it. Every handoff worker and every session keeps a git email linked to Krister's account.

### Changes to ADR 0050

ADR 0050 is accepted, so its text stays as it was. This ADR replaces one part of it, and the rest of ADR 0050 stands.

| ADR 0050 | Replaced by |
|---|---|
| Repository settings and rulesets: "Branch ruleset on `main`: pull request required with 0 approvals" | Pull request required with 1 approving review, and stale approvals dismissed on push. The rest of that line stands: review threads resolved, squash merge only, linear history, the strict required checks, force push and deletion blocked, no bypass actors |

The `CODEOWNERS` line of ADR 0050 stands: code owner review stays off, because `CODEOWNERS` names only Krister and he cannot approve his own pull requests.

### Consequences

* Good, because the merge box shows CodeRabbit's check on the head commit, so Krister sees whether a review is running or done.
* Good, because handoff counts the check in progress as a started review. Once pull request #209 merges, the pull request step asks CodeRabbit only when it has not started, and the check run lets handoff see a review in progress.
* Good, because GitHub refuses to merge a pull request whose head commit has no approval. A run that went on after `reviewTimeoutMinutes` with no CodeRabbit review at all stops at the merge step with `merge_failed` instead of merging.
* Good, because the CodeRabbit check is not required and a review error does not fail it, so the pull requests that CodeRabbit skips are not held by its check.
* Bad, because a CodeRabbit check that stays in progress keeps the head commit's check rollup pending. With `review_progress` on, handoff's PR node counts CodeRabbit's pending check as CI pending with no time limit (`checksPending` in handoff's `packages/engine/src/executors/github.ts`), and `reviewTimeoutMinutes` limits only the wait for a review, so a hung CodeRabbit review holds the run until the check completes or Krister repairs or cancels the run. A handoff change that limits a reviewer's own check by `reviewTimeoutMinutes` is requested.
* Bad, because with a required review GitHub reports CodeRabbit's request for changes as the pull request's review decision until CodeRabbit approves a later commit (stale dismissal removes approvals only). handoff's PR node then leaves through `fix`, not `ready`, so a fix round that CodeRabbit does not review before the timeout, or a finding the coder rejected, goes back to the coder and uses one of the loop's 3 rounds until CodeRabbit approves or Krister posts `@coderabbitai approve`.
* Bad, because every push dismisses the approval (`dismiss_stale_reviews_on_push`). Each fix round and each catch-up merge from `main` needs a new CodeRabbit review and approval. While the repository has fewer than 10 stars, each of those also needs an `@coderabbitai review` comment, and each uses one review from the hourly allowance.
* Bad, because Renovate's pull requests no longer merge without a person: Krister approves each one, and again after Renovate pushes to it.
* Bad, because Krister cannot approve his own pull requests. When CodeRabbit does not approve, the fallback is `@coderabbitai approve`, which gives an approval without a new review. On those pull requests the rule shows that CodeRabbit or Krister accepted the head commit, not that CodeRabbit reviewed it.
* Neutral, because release pull requests now need Krister's approval before he merges them.

### Confirmation

* Ruleset check, run by a reviewer or by task E00-S04-T03 (protect main): `gh api repos/northmes/northmes/rulesets --jq '.[] | select(.name == "main") | .id'` gives the ruleset id, and `gh api repos/northmes/northmes/rulesets/<id> --jq '.bypass_actors, (.rules[] | select(.type == "pull_request") | .parameters)'` shows an empty bypass list, `required_approving_review_count: 1`, `dismiss_stale_reviews_on_push: true`, `required_review_thread_resolution: true`, `require_extra_approval_for_unattributed_changes: true` and `allowed_merge_methods: ["squash"]`.
* Commit check by the operating session before each merge request: `gh api repos/northmes/northmes/pulls/<number>/commits --jq '.[].author.login'` prints `Krister-Johansson` for every commit of a handoff pull request.
* Config test, in `test/meta/github-files.test.ts` (task E00-S04-T03): ".coderabbit.yaml turns on incremental reviews, review_progress, request_changes_workflow and allow_author_approval, and turns off commit_status and fail_commit_status".
* Pull request check by a reviewer, on the first pull request that CodeRabbit reviews after this change: `gh pr checks <number>` lists a check named after CodeRabbit on the head commit; after CodeRabbit approves, `gh pr view <number> --json reviewDecision` shows `APPROVED`, which shows that CodeRabbit's approval counts for the rule; after a later push it shows no approval until CodeRabbit approves the new head commit.

## Pros and cons of the options

### Check run plus 1 required approving review

* Good, because CodeRabbit is visible in the merge box, and once pull request #209 merges, handoff sees a review in progress.
* Good, because GitHub enforces the gate, and stale approval dismissal ties the approval to the head commit.
* Good, because Krister can approve the pull requests that CodeRabbit skips, so none of them needs a bypass actor.
* Bad, because a check that stays in progress holds a handoff run, and every push needs a new approval.

### Status quo: no check run, 0 required approvals

* Good, because no CodeRabbit check enters the rollup, so a CodeRabbit review that never finishes holds a run only until `reviewTimeoutMinutes`.
* Good, because Renovate's pull requests need no approval.
* Bad, because the merge box shows nothing from CodeRabbit until it posts a review.
* Bad, because GitHub lets a pull request merge that CodeRabbit never reviewed, for example after handoff's review timeout.

### Check run only, 0 required approvals

* Good, because CodeRabbit is visible in the merge box, and once pull request #209 merges, handoff sees a review in progress.
* Bad, because nothing on GitHub requires CodeRabbit's approval before a merge.
* Bad, because a check that stays in progress holds a handoff run, as in the chosen option.

### Check run as a required status check

* Good, because the merge waits until CodeRabbit has finished a review of the head commit.
* Bad, because CodeRabbit skips pull requests from `renovate[bot]` and `dependabot[bot]` and release pull requests, and a required check that never reports on them would block them, with no bypass actor to merge them.
* Bad, because with `fail_commit_status: false` a review error does not fail the check, so the check shows that a review ended, not that its findings were handled.

## More information

* Related ADRs: [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) (the ruleset this ADR changes), [0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md) (delivery with handoff).
* Plan: [13 delivery and GitHub, rulesets](../plan/13-delivery-and-github.md#rulesets). Agent docs: [docs/agents/coderabbit.md](../agents/coderabbit.md) and [docs/agents/handoff/README.md](../agents/handoff/README.md).
* CodeRabbit configuration reference: https://docs.coderabbit.ai/reference/configuration. CodeRabbit changelog, review progress reports: https://docs.coderabbit.ai/changelog.
* Revisit when a CodeRabbit check stays in progress on a handoff run, when handoff limits a reviewer's own check by `reviewTimeoutMinutes`, and when a second maintainer joins who can approve Krister's pull requests.
