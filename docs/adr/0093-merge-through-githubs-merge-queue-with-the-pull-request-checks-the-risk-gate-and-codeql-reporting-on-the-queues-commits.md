---
status: "proposed"
date: 2026-11-01
decision-makers: Krister Johansson
consulted: GitHub documentation on merge queues, the merge_group event, rulesets and auto-merge; GitHub community reports that code scanning's default setup does not report on merge groups; a review of the change in a fresh context
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (the merge queue in place of the strict policy, decided 2026-11-01; the queue settings in rule 1; CodeQL as a workflow in place of default setup; the cutover in rule 5)"
---

# Merge through GitHub's merge queue, with the pull request checks, the risk gate and CodeQL reporting on the queue's commits

## Context and problem statement

The `main` ruleset requires every pull request branch to be up to date before it merges (ADR 0050, the strict policy, pinned by `scripts/repo/check-ruleset.mjs`) and dismisses stale approvals on push. Every merge to `main` puts every other open pull request behind; GitHub shows "This branch is out-of-date with the base branch", and someone presses Update branch or rebases. On a high pull request that update throws away the maintainer's approval, so he approves again. On 2026-11-01 five agent pull requests merged one after the other, and each later one cost one update and one approval. The shepherd of ADR 0086 can do the updates, but not the approvals.

This ADR decides how a pull request reaches `main` without that round: GitHub's merge queue, and what the workflows, the ruleset, CodeQL and the session scripts need for it. It covers `.github/workflows/ci.yml`, `pr.yml`, `risk.yml`, `supply-chain.yml` and `codeql.yml`, `scripts/ci/event-pull-request.mjs`, `scripts/ci/risk-gate.mjs`, `scripts/agents/auto-merge.mjs`, `scripts/agents/shepherd.mjs` and `scripts/repo/check-ruleset.mjs`.

## Decision drivers

* A pull request should be tested against the `main` it merges into, which is what the strict policy bought.
* The maintainer's one step stays the approval of a high pull request (ADR 0086); nobody updates branches by hand.
* The required checks stay the same checks, from the same scripts, on the same events plus the queue's.
* The risk gate's integrity holds in the queue: it runs from the default branch and reads the pull request GitHub says the queue commit is for.

## Considered options

* Keep the strict policy and let the shepherd rebase, with a re-approval per rebase
* Turn the strict policy off and merge without the latest `main`
* GitHub's merge queue, with the required workflows running on `merge_group`

## Decision outcome

Chosen option: "GitHub's merge queue", because it tests each pull request on the latest `main` before merging it, as the strict policy did, without pushing to the pull request branch, so no approval is dismissed and nobody updates a branch. The second option would merge a pull request against a `main` it was never tested with, which is the risk ADR 0050 took the strict policy for.

A pull request whose required checks pass on its own head enters the queue, by auto-merge once the checks pass or by the project script when they already have. GitHub builds it on the latest `main` and the entries before it, in a branch `gh-readonly-queue/main/pr-<number>-<base sha>`, runs the required checks on that commit through `merge_group` events, and squash-merges it when they pass. An entry whose checks fail leaves the queue and its pull request shows the failure.

1. **The ruleset.** The `main` ruleset gets a merge queue rule: squash merge; only non-failing pull requests merge; up to 5 entries built at once and up to 5 merged at once; a minimum of 1 entry, so an entry merges as soon as its checks pass; 60 minutes for the checks to report before the queue gives up on an entry. The strict policy is off, because the queue gives the same guarantee and a pull request behind `main` would otherwise wait for an update it no longer needs. The other rules of ADR 0050, ADR 0065, ADR 0084 and ADR 0086 stand: 0 required approvals with code owner review, stale approvals dismissed on push, resolved threads, `risk gate` and the other checks required, linear history, no bypass.
2. **The workflows run on merge groups.** `ci.yml`, `pr.yml`, `risk.yml`, `supply-chain.yml` and `codeql.yml` run on `merge_group` with the `checks_requested` type, next to their pull request events, so every required check reports on the queue's commit. Each merge group run is in a concurrency group of its own that nothing cancels. A `merge_group` event carries no pull request, so `PR / pull request` (`scripts/ci/event-pull-request.mjs`) reads the pull request through the API on both events, from the event's number or from the queue branch's name, and writes its number, title, body, author, head branch, fork flag and base commit as job outputs; the other PR jobs need it and read those outputs, so the checks read the same fields on either event and fail when the pull request cannot be found. In a merge group the base output is the group's parent commit, which the checkout is built on, so `PR / openapi diff` compares the pull request's change alone and not what `main` merged since the branch's base. `Risk / risk gate` finds its pull request the same way (`eventPullNumber` in `scripts/ci/pull-request.mjs`) and reads its reviews, so a high entry passes only with the maintainer's approval of the pull request's head, which the queue does not change; `Risk / risk label` skips a merge group run, whose pull request its own runs labelled. `CI / e2e` gets no Argos token in a merge group, because the pull request's own run uploaded the same screenshots (ADR 0077).
3. **CodeQL as a workflow.** Code scanning's default setup reports on pushes and pull requests and not on merge groups, so a required `CodeQL` check from it would hold every entry until the queue gave up. `codeql.yml` runs the same analysis, `actions` and `javascript-typescript` with the default queries and no build, on pull requests, merge groups, pushes to `main` and weekly, and uploads it to code scanning. The ruleset requires its job `codeql` from the GitHub Actions app in place of `CodeQL` from code scanning, and default setup is turned off, because code scanning refuses a workflow's analysis while default setup is on.
4. **The session scripts.** `pnpm agent:auto-merge` turns on auto-merge as before, which adds the pull request to the queue once its required checks pass, and adds a clean pull request to the queue at once in place of merging it; it reads whether the base has a queue, and until the ruleset has one it squash-merges a clean pull request as before, so the window between this merge and the cutover changes nothing for sessions. The deny rule on `gh pr merge` stays. `pnpm agent:shepherd` reports a pull request in the queue as merging, names one the queue dropped (the failure is on the queue commit, which the head's checks do not show) with the run to read and the one step to take, and asks for no rebase on a branch that is only behind `main`; a conflict still needs one. `pnpm repo:check-ruleset` fails without a merge queue rule, with one that does not squash, or with the strict policy still on.
5. **The cutover.** The maintainer pushes the workflow files of this change, approves it and lets it merge under the old rules; its own `codeql` check fails until default setup is off, and is not required yet. After the merge, in this order: turn off CodeQL default setup under the repository's code security settings; edit the `main` ruleset as rule 1 says and, under required status checks, add `codeql` from GitHub Actions and remove `CodeQL` from code scanning; run `pnpm repo:check-ruleset` on `main`; check the code scanning tool status page for the configurations default setup left and remove them. From then on a pull request shows Merge when ready in place of Update branch, and the release and Renovate pull requests, which nobody runs the project script on, go into the queue through that button after the maintainer's approval. Open question for the first outside contributor: whether the read-only token of a pull request from a fork may upload the CodeQL analysis; GitHub's permission table caps `security-events` at read there, and no page says the upload endpoint excepts it. A probe pull request from a fork answers it, and if the upload is refused, `codeql` runs with `if` on the fork case and the ruleset keeps it required only for branches of this repository.

### Changes to ADR 0050, ADR 0069 and ADR 0086

ADR 0050 and ADR 0069 are accepted, so their text stays as it was. ADR 0086 is proposed and points here. From the cutover in rule 5, this ADR replaces these parts, and the rest of each stands.

| Line | Replaced by |
|---|---|
| ADR 0050: GitHub's merge queue stays off; handoff's queue with strict checks merges one up-to-date pull request at a time | GitHub's merge queue is on, with the settings of rule 1, and merges every pull request; the strict policy is off |
| ADR 0050: CodeQL default setup for `actions` and `javascript-typescript` | CodeQL as the workflow `codeql.yml` for the same languages; default setup is off |
| ADR 0069: the ruleset requires the checks strict (the branch must be up to date), and `CodeQL` stays required as ADR 0050 decides | The checks are required without the strict policy, and `codeql` from the GitHub Actions app is required in place of `CodeQL` from code scanning |
| ADR 0069, confirmation: `pnpm repo:check-ruleset` fails when the ruleset has `strict_required_status_checks_policy` false, or misses `CodeQL` from code scanning | It fails when the ruleset has no `merge_queue` rule or one that does not squash, has `strict_required_status_checks_policy` true, or misses `codeql` from the GitHub Actions app, which `codeql.yml` reports |
| ADR 0086 rule 5: the project script turns on auto-merge, so GitHub merges once every required check passes, and merges at once a pull request whose checks have all passed | The script turns on auto-merge, so GitHub adds the pull request to the merge queue once every required check passes, and adds a pull request whose checks have all passed to the queue at once |

### Consequences

* Good, because a pull request merges from the state it was approved in, tested on the `main` it lands on, and the maintainer approves each high pull request once.
* Good, because several approved pull requests merge one after the other without anyone touching them, the shepherd included.
* Bad, because every pull request runs its checks twice, once on its head and once in the queue, which doubles the CI minutes of a merge; the pull request's run still catches most failures first.
* Bad, because a queue entry whose checks fail on a flaky end-to-end spec leaves the queue, and the shepherd, which sees the removal in the pull request's timeline, or a session reads the queue run and puts the pull request back with the project script; the retry of ADR 0041 keeps that rare.
* Bad, because CodeQL now runs as a workflow pinned by SHA that Renovate updates, in place of a setup GitHub kept current by itself.
* Neutral, because the release pull request and Renovate's pull requests enter the queue through the Merge when ready button in place of the Squash and merge button.

### Confirmation

* `test/meta/workflows.test.ts`: "ADR0093 every workflow whose jobs the ruleset requires runs on merge groups, on the checks_requested type only", "ADR0093 PR / pull request reads the pull request from the event number or the queue branch through the API, and every other PR job needs it", "ADR0086 ADR0093 Risk / risk gate runs on pull requests, reviews and merge groups, checks out nothing and runs the check from the default branch", "ADR0086 ADR0093 the Risk workflow runs one at a time per pull request, in a group of its own per merge group, and labels in a job of its own after the gate on pull request runs", "ADR0077 ADR0093 only the e2e job reads ARGOS_TOKEN, as an environment variable of its test step, and not in a merge group" and "ADR0093 CodeQL / codeql analyzes actions and javascript-typescript without a build on pull requests, merge groups, pushes to main and weekly, and uploads to code scanning".
* `scripts/ci/pull-request.test.ts` and `scripts/ci/event-pull-request.test.ts`: the queue branch names the pull request, and the outputs carry the fields the checks read.
* `scripts/agents/auto-merge.test.ts`: "ADR0093 a clean pull request goes into the merge queue where the base has one, is squash-merged where it has none yet, and any other one gets auto-merge, which enqueues it when ready". `scripts/agents/shepherd.test.ts`: "ADR0093 a branch that is only behind main needs no rebase: the merge queue builds it on main", "ADR0093 a pull request in the merge queue is GitHub's, whatever else it shows", "ADR0093 a pull request the queue dropped names the queue run to read and the one step to take, in place of the auto-merge line" and "ADR0093 a removal from the queue counts when it came after the head was committed and the pull request is not back in the queue".
* `scripts/repo/check-ruleset.test.ts`: "ADR0093 a ruleset without a merge_queue rule fails naming it, and the strict policy is not asked for", "ADR0093 a ruleset that keeps the strict policy next to the queue fails naming it", "ADR0093 a merge queue that does not squash fails naming its method" and "ADR0093 CodeQL is the job codeql of codeql.yml, from GitHub Actions, and the check of code scanning's default setup is stale". `test/meta/workflows.test.ts`: "ADR0093 no job the ruleset requires runs on some events only".
* Inspection step, not a check: `gh api repos/northMES/northmes/rulesets/24515911` lists a `merge_queue` rule with `merge_method` `SQUASH`, `strict_required_status_checks_policy` false, and `codeql` with `integration_id` 15368; the repository's code security settings show CodeQL default setup off.

## Pros and cons of the options

### Keep the strict policy and let the shepherd rebase

* Good, because nothing changes in GitHub.
* Bad, because every rebase of a high pull request dismisses the approval, so the maintainer approves each one as many times as `main` moves under it.

### Turn the strict policy off

* Good, because one ruleset click removes the updates.
* Bad, because a pull request then merges against a `main` it was never tested with, and two pull requests that pass alone can break `main` together.

### GitHub's merge queue

* Good, because the queue tests each pull request on the latest `main` and the branch is never pushed to.
* Bad, because every required workflow has to run on `merge_group` and find its pull request without the event, and CodeQL has to move out of default setup.

## More information

* Related ADRs: [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) (the ruleset and default setup), [0069](0069-require-each-ci-job-as-a-status-check-on-main.md) (each job a required check), [0086](0086-risk-tiered-review-and-merge-of-agent-pull-requests.md) (the risk gate and auto-merge), [0077](0077-visual-regression-snapshots-with-argos-from-the-playwright-specs.md) (Argos), [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md) (the end-to-end retry).
* Plan: [13 delivery and GitHub](../plan/13-delivery-and-github.md), [11 quality and testing](../plan/11-quality-and-testing.md).
* GitHub, managing a merge queue: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue. The `merge_group` event: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group.
* Revisit when GitHub's default setup reports on merge groups, which would let CodeQL go back to it, and if the doubled CI minutes matter once the repository has more than one contributor.
