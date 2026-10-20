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

Until 2026-10-20 `.coderabbit.yaml` turned on `request_changes_workflow`: CodeRabbit requests changes when it posts actionable comments and approves a reviewed head commit once its threads are resolved. It also turned on `allow_author_approval`, so `@coderabbitai approve` and `@coderabbitai resolve` worked for a pull request's author.

handoff's PR node behaves as follows:

* Its CI status is the state of the head commit's check rollup, except for checks named after a reviewer in `waitForReviewers`. Since Krister-Johansson/handoff#657, such a check, CodeRabbit's included, counts as that reviewer's progress: it does not count toward CI or `requireChecks`, a pending one does not hold the node as CI pending, a failed one does not go to the coder, and `reviewTimeoutMinutes` bounds the wait.
* It counts a reviewer as started on the head commit when the reviewer reviewed that commit or when a check named after the reviewer is in progress there. The node's `reviewRequest` setting uses this to ask only a reviewer that has not started. All three NorthMES graphs set `reviewRequest` ([pull request #209](https://github.com/northMES/northmes/pull/209)).
* Its review decision is GitHub's review decision for the pull request. Its `ready` port needs a decision other than changes requested, and changes requested sends the run back to the coder. With review threads on, a reviewer's standing request for changes stops sending the run back once handoff has answered every item that reviewer raised (`github.changes_requested_answered`).
* With review threads on (`reviewThreads`), the PR node runs handoff's review comment loop. Each unresolved thread, each review summary that is not an approval, and each walkthrough note and failed or warning pre-merge check in CodeRabbit's summary comment is a review item. The coder answers each item as fixed with the commit, or as declined, unclear or a duplicate with its evidence, and posts nothing on GitHub. An item that came back with the reviewer's reply can also be answered as settled, when that reply accepts the earlier answer. After it pushes any fix, the PR node posts each answer in the item's thread, or in one pull request comment per round for the items without a thread, and resolves each answered thread after the reviewer's next review. A settled answer posts nothing, and the PR node resolves its thread at once. It waits for that review up to `reviewTimeoutMinutes` (30) for a bot and up to `personWaitHours` (24 hours) for a person. An item the loop cannot settle, such as one whose reviewer does not review again within that time or one the coder declines again after the reviewer's reply, is disputed, and the PR node asks one question about its disputed items, with Resolve, Send back or Leave for each. A thread that Krister leaves, that another person takes over or that handoff's token cannot resolve stays open, and the merge step lists it. The loop is described in [Review comments](../agents/handoff/README.md#review-comments).

## Decision drivers

* Krister and the operating session see in the merge box whether CodeRabbit is reviewing the head commit.
* GitHub keeps a pull request from merging before its head commit is approved, because handoff's PR node goes on after its review timeout.
* Pull requests that CodeRabbit skips still merge, with no bypass actors on the ruleset. CodeRabbit skips pull requests from `renovate[bot]` and `dependabot[bot]` (`ignore_usernames`) and release pull requests titled `chore(main): release` (`ignore_title_keywords`).
* Until ADR 0084, handoff and sessions opened pull requests with Krister's token, so Krister was their author, and GitHub does not let an author approve their own pull request.
* An error inside CodeRabbit does not fail the head commit's checks.

## Considered options

* Status quo: no check run, 0 required approvals
* Check run only, 0 required approvals
* Check run as a required status check
* Check run plus 1 required approving review

## Decision outcome

Chosen option: "Check run plus 1 required approving review", because it shows CodeRabbit in the merge box and lets handoff see a review in progress, while the gate is an approval. Since 2026-10-20 the ruleset also requires code owner review ([ADR 0084](0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md), proposed), and `CODEOWNERS` names only Krister, so the approval that lets a pull request merge is Krister's. CodeRabbit reviews every pull request it does not skip, and its approval no longer satisfies the rule. Since 2026-10-20 it posts its reviews as comments (`request_changes_workflow: false`), so it neither requests changes nor approves, and its open inline threads are what holds the merge.

Settings:

* `.coderabbit.yaml`: `reviews.review_progress: true`. `commit_status: false`, since it would apply only with `review_progress` off. `fail_commit_status: false`, so a CodeRabbit error does not fail the head commit. `request_changes_workflow: false` since 2026-10-20 (Krister): under code owner review CodeRabbit's approval counts for nothing, and its request for changes only blocked the merge until someone posted `@coderabbitai approve`. `allow_author_approval: false` since 2026-10-20, because agents are the authors of their pull requests and must not resolve CodeRabbit's threads by command; Krister, who is not their author, still can.
* Branch ruleset `main`, live since 2026-10-05: a pull request rule with `required_approving_review_count: 1`, `dismiss_stale_reviews_on_push: true`, `required_review_thread_resolution: true`, `require_code_owner_review: true` (false until 2026-10-20, when ADR 0084 turned it on), `require_last_push_approval: false`, `require_extra_approval_for_unattributed_changes: true` and `allowed_merge_methods: ["squash"]`; deletion and force pushes blocked; linear history; no bypass actors.
* The CodeRabbit check is not a required status check. The live ruleset has no required status checks yet. Task E00-S04-T03 adds the ones ADR 0050 lists, and the CodeRabbit check is not one of them.
* The PR node of `northmes-guided`, `northmes-standard` and `northmes-lean` in `docs/agents/handoff/graphs/`: `"reviewThreads": { "reply": true, "summary": "coderabbitai" }`, with handoff's defaults for the other settings (`resolveAfterReview` on, `maxPerRound` 20, `returnOnAnswerOnly` on, `personWaitHours` 24).

Who approves:

* Pull requests that a handoff run opens with Krister's token (under code owner review such a pull request cannot merge, because Krister is its author and cannot approve it; the rest of this item describes the setup before ADR 0084): CodeRabbit approves the head commit once its review of that commit is complete and its threads are resolved. The PR node answers CodeRabbit's comments, resolves the answered threads after CodeRabbit's next review, and asks Krister about the disputed items. Once handoff has answered every item CodeRabbit raised, CodeRabbit's standing request for changes no longer sends the run back to the coder. A run therefore reaches the merge step without CodeRabbit's approval of the head commit after a fix round that CodeRabbit did not review before handoff's timeout and after a finding the coder declined, and also when CodeRabbit never reviewed the pull request. When Krister accepts the head commit, he posts `@coderabbitai approve`, which resolves CodeRabbit's threads and asks it to approve. On the guided graph he posts it before he requests the merge; on the standard and lean graphs the merge step fails with `merge_failed` while the head commit has no approval. The PR node also answers threads from people and resolves each one after that person's next review, which it waits for up to 24 hours, or at once when that person's reply accepts the answer. Krister resolves by hand the threads that handoff leaves open, which the merge step lists.
* Pull requests that a session opens as `northmes-agent` (ADR 0084): before the pull request opens, a review agent with a fresh context reviews the diff as `CLAUDE.md` describes, and the Checks section lists every finding with its outcome. After each push the session posts `@coderabbitai review`, because below 10 stars CodeRabbit reviews only on request, and it answers CodeRabbit's comments and pushes the fixes. Krister reads the pull request, its Checks section and CodeRabbit's review, approves it as code owner and merges it. Agents do not merge (ADR 0084, rule 5). When CodeRabbit cannot review, for example because the open source review allowance is used up as on [pull request #733](https://github.com/northMES/northmes/pull/733), the pull request waits for Krister alone. CodeRabbit's open inline threads block the merge until they are resolved: Krister resolves them by hand or with `@coderabbitai resolve` when he accepts the head commit. The session answers each thread and does not resolve CodeRabbit's threads itself. Threads from people are resolved by hand.
* Pull requests that Krister writes himself need another approver, because GitHub does not let an author approve their own pull request and the ruleset has no bypass actors. Until a second maintainer joins, his changes go through an agent session (ADR 0084).
* Pull requests from `renovate[bot]` and `dependabot[bot]`: Krister approves them himself, because CodeRabbit skips them and Krister is not their author.
* Release pull requests (`chore(main): release`): CodeRabbit skips them by title. release-please opens them with the Actions token or a GitHub App token (spike SP2 chooses), so Krister is not their author, and he approves them before he merges them.
* Pull requests from contributors: CodeRabbit reviews them like any other, and Krister's approval as code owner satisfies the rule.
* A pull request that Copilot opens under its own app identity, not on behalf of a person, needs one more approval than the rule sets (`require_extra_approval_for_unattributed_changes`, on by default and in public preview). NorthMES does not use the Copilot coding agent, so the setting changes nothing today, and the ruleset keeps GitHub's default.

### Changes to ADR 0049

ADR 0049 is accepted, so its text stays as it was. This ADR replaces one part of it, and the rest of ADR 0049 stands.

| ADR 0049 | Replaced by |
|---|---|
| Runs: "On the guided graph Krister resolves review threads before requesting the merge; on the standard and lean graphs an open thread must not block the automatic merge (switch criterion 4 in [docs/agents/handoff/README.md](../agents/handoff/README.md))." | In every graph the pull request step answers review comments, resolves each answered thread after the reviewer's next review, or at once when the reviewer's reply accepts the answer, and asks Krister one question about the disputed items ([Review comments](../agents/handoff/README.md#review-comments)). On the guided graph Krister resolves the threads that handoff leaves open before requesting the merge. On the standard and lean graphs a thread that stays open blocks the automatic merge, because the `main` ruleset requires resolved threads: the merge step names the open threads and waits until a person resolves them ([switch criterion 4 from standard to lean](../agents/handoff/README.md#standard-to-lean)). The spec rule before it in the same line stands |

### Changes to ADR 0050

ADR 0050 is accepted, so its text stays as it was. This ADR replaces two parts of it, and the rest of ADR 0050 stands.

| ADR 0050 | Replaced by |
|---|---|
| Repository settings and rulesets: "Branch ruleset on `main`: pull request required with 0 approvals" | Pull request required with 1 approving review, and stale approvals dismissed on push. The rest of that line stands: review threads resolved, squash merge only, linear history, the strict required checks, force push and deletion blocked, no bypass actors |
| Tooling modeled on gqlPrune: "The coder checks each finding against the issue and the ADRs instead of obeying it, and lists rejected findings with the reason in the pull request description." | The coder checks each finding against the issue and the ADRs instead of obeying it, and answers it as fixed with the commit, or as declined, unclear or a duplicate with its evidence. The pull request step posts each answer on the pull request, in the finding's thread when it has one, and resolves the thread after CodeRabbit's next review ([Review comments](../agents/handoff/README.md#review-comments)). The rest of that line stands |

This ADR first kept the `CODEOWNERS` line of ADR 0050, with code owner review off, because `CODEOWNERS` names only Krister and he cannot approve his own pull requests. [ADR 0084](0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md) turned on code owner review on 2026-10-20, once agents act as their own machine user, and CodeRabbit's approval no longer satisfies the rule.

### Consequences

* Good, because the merge box shows CodeRabbit's check on the head commit, so Krister sees whether a review is running or done.
* Good, because handoff counts the check in progress as a started review, so the pull request step asks CodeRabbit only when it has not started.
* Good, because GitHub refuses to merge a pull request whose head commit has no approval. A run that went on after `reviewTimeoutMinutes` with no CodeRabbit review at all stops at the merge step with `merge_failed` instead of merging.
* Good, because the CodeRabbit check is not required and a review error does not fail it, so the pull requests that CodeRabbit skips are not held by its check.
* Good, because the PR node answers review comments and resolves their threads, so the rule on resolved threads holds a handoff run only for the disputed items Krister decides and the threads handoff leaves open.
* Bad, because a CodeRabbit check that stays in progress shows as a pending check on the pull request, and handoff's dashboard list of pull requests shows it as CI pending. handoff's PR node does not wait on it as CI (Krister-Johansson/handoff#657); `reviewTimeoutMinutes` bounds the wait for CodeRabbit.
* Neutral, because since 2026-10-20 CodeRabbit posts comments and no longer requests changes, so only its open inline threads hold the merge. A finding in its review summary without an inline thread blocks nothing, and Krister reads it in his own review. Until then a request for changes stayed the review decision until CodeRabbit approved a later commit or Krister posted `@coderabbitai approve`.
* Bad, because a thread from a person holds the PR step for up to 24 hours (`personWaitHours`) after the answer while it waits for that person's next review.
* Bad, because every push dismisses the approval (`dismiss_stale_reviews_on_push`). Each fix round and each catch-up merge from `main` needs a new approval from Krister. While the repository has fewer than 10 stars, each of those also needs an `@coderabbitai review` comment, and each uses one review from the hourly allowance.
* Bad, because Renovate's pull requests no longer merge without a person: Krister approves each one, and again after Renovate pushes to it.
* Bad, because Krister cannot approve pull requests he writes himself. Before ADR 0084 the fallback was `@coderabbitai approve`; since code owner review is on, his own pull requests need another approver, and his changes go through an agent session.
* Bad, because every pull request waits for Krister's approval, also one that CodeRabbit reviewed without findings (ADR 0084).
* Neutral, because release pull requests now need Krister's approval before he merges them.

### Confirmation

* Config test, in `test/meta/github-files.test.ts` (task E00-S04-T03): ".coderabbit.yaml turns on incremental reviews and review_progress, and turns off request_changes_workflow, allow_author_approval, commit_status and fail_commit_status". `test/meta/coderabbit.test.ts` already checks `request_changes_workflow: false` and `allow_author_approval: false`.
* Ruleset check (task E00-S04-T03): `scripts/repo/check-ruleset.mjs` reads the `main` ruleset through the GitHub API and fails when its pull request rule differs from an empty bypass list, `required_approving_review_count: 1`, `dismiss_stale_reviews_on_push: true`, `required_review_thread_resolution: true`, `require_extra_approval_for_unattributed_changes: true`, `require_code_owner_review: true` (ADR 0084) and `allowed_merge_methods: ["squash"]`. `scripts/repo/check-ruleset.test.ts`: "a ruleset with 0 required approvals fails naming required_approving_review_count". A weekly CI job named `repo settings` runs `check-ruleset.mjs` against the live `main` ruleset.

Inspection steps, not checks: `gh api repos/northmes/northmes/rulesets/<id>` shows the rule above; `gh api repos/northmes/northmes/pulls/<number>/commits --jq '.[].author.login'` prints `Krister-Johansson` for every commit of a handoff pull request; on the first pull request CodeRabbit reviews after this change, `gh pr checks <number>` lists CodeRabbit's check, and `gh pr view <number> --json reviewDecision` shows `APPROVED` after Krister's approval and no approval after a later push.

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
