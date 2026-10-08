---
status: "proposed"
date: 2026-10-08
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors, coding agents
release: "1"
needs-confirmation: ""
---

# Require each CI job as a status check on main

## Context and problem statement

[ADR 0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) names `ci / gate` as the one required check from `.github/workflows/ci.yml`, so jobs could join or leave that workflow without a ruleset edit. `ci / gate` needed `ci / lint + typecheck + build`, `ci / test (TZ=UTC)`, `ci / test (TZ=Europe/Stockholm)`, `ci / pr title` and `ci / linked issue`, and the merge box marked only `ci / gate` as required. On 2026-10-08 Krister decided that the checks list of a pull request shows one check per kind of work, and that each of them is a required status check on `main`. This ADR covers the jobs of `ci.yml`, the required status checks of the `main` ruleset and `test/meta/workflows.test.ts`.

## Decision drivers

* The merge box shows each kind of check as required: lint, typecheck, build, tests, the pull request title and the linked issue.
* One check covers all tests in both time zone legs ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)).
* GitHub counts a skipped required check as passed, so something must still fail a pull request on which a job did not run.
* A renamed or added job must not drop out of the required checks unnoticed.

## Considered options

* Only `ci / gate` required, as ADR 0050 decides
* Each CI job required, with `ci / gate` kept

## Decision outcome

Chosen option: "Each CI job required, with `ci / gate` kept", because the merge box then shows each kind of check as required, while `ci / gate` still fails a pull request on a job that was skipped or cancelled.

The jobs of `ci.yml`:

| Check | Runs |
|---|---|
| `ci / lint` | `pnpm lint`, then `pnpm gen --check` |
| `ci / typecheck` | `pnpm typecheck` |
| `ci / build` | `pnpm build` |
| `ci / test` | `pnpm test` (the `unit`, `integration`, `web` and `types` projects) with `TZ` and `NM_TEST_PG_TZ` set to `UTC`, then `pnpm test:tz` (the `unit` and `integration` projects in `Europe/Stockholm`) as a second step, which also runs when the UTC step failed and does not run when a failed install skipped it |
| `ci / pr title` | As before, on pull requests only |
| `ci / linked issue` | As before, on pull requests only |
| `ci / gate` | Needs every other job, and fails when one of them failed or was cancelled, or was skipped on a pull request |

The `main` ruleset requires these seven checks, strict (the branch must be up to date), each with the GitHub Actions app (integration id 15368) as its source: `ci / lint`, `ci / typecheck`, `ci / build`, `ci / test`, `ci / pr title`, `ci / linked issue` and `ci / gate`. `license gate`, `dependency audit` and `CodeQL` stay required as ADR 0050 decides. CodeRabbit stays required through the approving review rule of [ADR 0065](0065-coderabbit-check-run-and-a-required-approval-on-main.md), not as a status check.

A job added to `ci.yml` joins the list in the change that adds it: `ci / e2e` ([#281](https://github.com/northMES/northmes/issues/281)), `ci / coverage` ([#338](https://github.com/northMES/northmes/issues/338)) and `ci / react doctor` ([#339](https://github.com/northMES/northmes/issues/339)) when they land. A person edits the ruleset, because agents change no repository settings. A new job's name joins the ruleset after the change that adds it merges. A renamed or removed job's old name leaves the ruleset just before that change merges, because its pull request no longer reports the old check, and a new name joins after the merge.

### Changes to ADR 0050

ADR 0050 is accepted, so its text stays as it was. This ADR replaces one part of it, and the rest of ADR 0050 stands.

| ADR 0050 | Replaced by |
|---|---|
| Repository settings and rulesets: "strict required checks `ci / gate`, `license gate`, `dependency audit` and `CodeQL`" | Strict required checks `ci / lint`, `ci / typecheck`, `ci / build`, `ci / test`, `ci / pr title`, `ci / linked issue` and `ci / gate` from the GitHub Actions app, and `license gate`, `dependency audit` and `CodeQL`. The rest of that line, as ADR 0065 changed it, stands |

### Changes to ADR 0039

ADR 0039 is accepted, so its text stays as it was.

| ADR 0039 | Replaced by |
|---|---|
| Confirmation: "SPDX header check in `ci / lint + typecheck + build`" | SPDX header check in `ci / lint`. The rest of that line stands |

### Consequences

* Good, because a failed lint, typecheck, build or test run shows by its own name as a required check.
* Good, because `ci / gate` still fails a pull request on which a job was skipped, which GitHub would count as a passed required check.
* Bad, because the two time zone legs run one after the other in `ci / test`, so that check takes as long as both legs together. The Europe/Stockholm leg still runs after a failed UTC leg, so a failure in either zone reports in the same run.
* Bad, because renaming, adding or removing a job needs a ruleset edit timed to its merge: an old name leaves just before it, and a new name joins after it. A required check that no job reports any more blocks every pull request, and a new job missing from the ruleset does not show as required.

### Confirmation

* `test/meta/workflows.test.ts`: "the CI workflow has exactly the jobs ci / lint, ci / typecheck, ci / build, ci / test, ci / pr title, ci / linked issue and ci / gate". It fails on a renamed, added or removed job, so the change that makes it pass names the ruleset edit.
* `test/meta/workflows.test.ts`: "ci / test runs the unit, integration, web and types projects in the UTC leg, then the unit and integration projects in the Europe/Stockholm leg", "ci / gate needs every other job in its workflow" and "ci / gate runs after a failed, cancelled or skipped job and then fails".

Inspection step, not a check: `gh api repos/northmes/northmes/rulesets/<id>` lists the seven checks under the `required_status_checks` rule, each with `integration_id` 15368.

## Pros and cons of the options

### Each CI job required, with `ci / gate` kept

* Good, because each kind of check shows as required in the merge box.
* Good, because `ci / gate` still catches a skipped or cancelled job.
* Bad, because a renamed, added or removed job needs a ruleset edit timed to its merge.

### Only `ci / gate` required

* Good, because jobs join, leave or change name without a ruleset edit.
* Bad, because the merge box marks only `ci / gate` as required, and the jobs behind it show without that mark.

## More information

* Related ADRs: [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) (the ruleset line this ADR changes), [0065](0065-coderabbit-check-run-and-a-required-approval-on-main.md) (the approving review rule), [0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) (the root scripts the jobs run), [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md) (the two time zone legs), [0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md) (the SPDX header check).
* Plan: [13 delivery and GitHub, required checks](../plan/13-delivery-and-github.md#required-checks) and [11 quality and testing, required checks](../plan/11-quality-and-testing.md#required-checks).
* Revisit if a ruleset edit that lags a job change blocks pull requests.
