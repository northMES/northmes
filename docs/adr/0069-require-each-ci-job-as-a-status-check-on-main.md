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

[ADR 0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) names `ci / gate` as the one required check from `.github/workflows/ci.yml`, so jobs could join or leave that workflow without a ruleset edit. `ci / gate` needed `ci / lint + typecheck + build`, `ci / test (TZ=UTC)`, `ci / test (TZ=Europe/Stockholm)`, `ci / pr title` and `ci / linked issue`, and the merge box marked only `ci / gate` as required. On 2026-10-08 Krister decided that the checks list of a pull request shows one check per kind of work, and that each of them is a required status check on `main`. GitHub shows a check as `<workflow name> / <job name> (<event>)`, so the job `ci / lint` of the workflow `CI` read `CI / ci / lint (pull_request)`, and Krister asked that the check names not repeat `ci`. This ADR covers the jobs of `ci.yml`, the required status checks of the `main` ruleset and `test/meta/workflows.test.ts`.

## Decision drivers

* The merge box shows each kind of check as required: lint, typecheck, build, tests, the pull request title and the linked issue.
* One check covers all tests in both time zone legs ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)).
* GitHub counts a skipped required check as passed, so something must still fail a pull request on which a job did not run.
* A renamed or added job must not drop out of the required checks unnoticed.
* A check name does not repeat the workflow name.

## Considered options

* Only `ci / gate` required, as ADR 0050 decides
* Each CI job required, with `CI / gate` kept

## Decision outcome

Chosen option: "Each CI job required, with `CI / gate` kept", because the merge box then shows each kind of check as required, while `CI / gate` still fails a pull request on a job that was skipped or cancelled.

The workflow keeps the name `CI`, and its job names do not start with `ci / `, so GitHub shows each job as `CI / <job name>`, for example `CI / lint (pull_request)`. The jobs of `ci.yml`:

| Job name | Shown as | Runs |
|---|---|---|
| `lint` | `CI / lint` | `pnpm lint`, then `pnpm gen --check` |
| `typecheck` | `CI / typecheck` | `pnpm typecheck` |
| `build` | `CI / build` | `pnpm build` |
| `test` | `CI / test` | `pnpm test:coverage` (the `unit`, `integration`, `web` and `types` projects with coverage) with `TZ` and `NM_TEST_PG_TZ` set to `UTC`; after a passed UTC step, a step that copies the coverage summary into the job summary and an upload of the lcov report; then `pnpm test:tz` (the `unit` and `integration` projects in `Europe/Stockholm`), which also runs when the UTC step failed and does not run when a failed install skipped it |
| `react doctor` | `CI / react doctor` | `pnpm react-doctor`: react-doctor with `--no-telemetry` over `apps/web`, every `modules/*/web` and `packages/web-sdk`, writing a JSON report. Then `pnpm react-doctor:summary` copies the findings into the job summary and the log; it also runs after a failed scan. react-doctor runs in CI only, under the reviewed license exception of [ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md), so neither `pnpm check` nor `pnpm check:full` contains it |
| `pr title` | `CI / pr title` | As `ci / pr title` did, on pull requests only |
| `linked issue` | `CI / linked issue` | As `ci / linked issue` did, on pull requests only |
| `gate` | `CI / gate` | Needs every other job, and fails when one of them failed or was cancelled, or was skipped on a pull request |

The `main` ruleset requires these eight checks by their job names, strict (the branch must be up to date), each with the GitHub Actions app (integration id 15368) as its source: `lint`, `typecheck`, `build`, `test`, `react doctor`, `pr title`, `linked issue` and `gate`. `license gate`, `dependency audit` and `CodeQL` stay required as ADR 0050 decides. CodeRabbit stays required through the approving review rule of [ADR 0065](0065-coderabbit-check-run-and-a-required-approval-on-main.md), not as a status check.

A required status check matches a check by its name and the app that reports it, not by the workflow, so a job named `build` in another workflow would also satisfy the required `build` check. No two workflows share a job name; a job without a `name` reports its id.

A job added to `ci.yml` joins the list in the change that adds it, under a name without `ci / `: `react doctor` joined with [#339](https://github.com/northMES/northmes/issues/339), and `e2e` ([#281](https://github.com/northMES/northmes/issues/281)) joins when it lands. [#338](https://github.com/northMES/northmes/issues/338) adds coverage steps to `test` and no job. Where an accepted ADR, a plan document or `docs/agents` names a job of `ci.yml` as `ci / <name>`, such as `ci / a11y` in ADR 0021 or `ci / pr title` in ADR 0038, the job is `<name>`, shown as `CI / <name>`. A person edits the ruleset, because agents change no repository settings. A new job's name joins the ruleset after the change that adds it merges. A renamed or removed job's old name leaves the ruleset just before that change merges, because its pull request no longer reports the old check, and a new name joins after the merge. For the change that drops the `ci / ` prefix, `ci / gate` leaves the ruleset just before the merge, and `lint`, `typecheck`, `build`, `test`, `pr title`, `linked issue` and `gate` join it after.

### Changes to ADR 0050

ADR 0050 is accepted, so its text stays as it was. This ADR replaces one part of it, and the rest of ADR 0050 stands.

| ADR 0050 | Replaced by |
|---|---|
| Repository settings and rulesets: "strict required checks `ci / gate`, `license gate`, `dependency audit` and `CodeQL`" | Strict required checks `lint`, `typecheck`, `build`, `test`, `react doctor`, `pr title`, `linked issue` and `gate` from the GitHub Actions app, shown as `CI / lint` and so on, and `license gate`, `dependency audit` and `CodeQL`. The rest of that line, as ADR 0065 changed it, stands |
| `ci / gate` | The job `gate` of `ci.yml`, shown as `CI / gate` |

### Changes to ADR 0039

ADR 0039 is accepted, so its text stays as it was.

| ADR 0039 | Replaced by |
|---|---|
| Confirmation: "SPDX header check in `ci / lint + typecheck + build`" | SPDX header check in `lint`, shown as `CI / lint`. The rest of that line stands |

### Consequences

* Good, because a failed lint, typecheck, build or test run shows by its own name as a required check.
* Good, because `CI / gate` still fails a pull request on which a job was skipped, which GitHub would count as a passed required check.
* Good, because the checks list reads `CI / lint (pull_request)`, without `ci` twice.
* Bad, because the two time zone legs run one after the other in `CI / test`, so that check takes as long as both legs together. The Europe/Stockholm leg still runs after a failed UTC leg, so a failure in either zone reports in the same run.
* Bad, because renaming, adding or removing a job needs a ruleset edit timed to its merge: an old name leaves just before it, and a new name joins after it. A required check that no job reports any more blocks every pull request, and a new job missing from the ruleset does not show as required.
* Bad, because short job names such as `build` and `test` fit jobs in other workflows too, and one of those would satisfy the required check. `test/meta/workflows.test.ts` fails when two workflows share a job name.

### Confirmation

* `test/meta/workflows.test.ts`: "the CI workflow has exactly the jobs lint, typecheck, build, test, react doctor, pr title, linked issue and gate". It fails on a renamed, added or removed job, so the change that makes it pass names the ruleset edit.
* `test/meta/workflows.test.ts`: "no two workflows share a job name" and "no job name starts with its workflow name and a slash".
* `test/meta/workflows.test.ts`: "CI / test runs the unit, integration, web and types projects in the UTC leg, then the unit and integration projects in the Europe/Stockholm leg", "CI / gate needs every other job in its workflow" and "CI / gate runs after a failed, cancelled or skipped job and then fails".
* `test/meta/workflows.test.ts`: "the react doctor job runs with --no-telemetry", "the react doctor job scans apps/web, every modules/*/web and packages/web-sdk", "the react doctor job copies its findings into the job summary, also after a failed scan" and "neither pnpm check nor pnpm check:full runs react-doctor".
* Ruleset check (task E00-S04-T03): `scripts/repo/check-ruleset.mjs` fails when the `required_status_checks` rule of the `main` ruleset does not list every job name of `.github/workflows/ci.yml` with `integration_id` 15368, or when `strict_required_status_checks_policy` is false. `scripts/repo/check-ruleset.test.ts`: "a ruleset that does not require test fails naming test".

Inspection step, not a check: `gh api repos/northmes/northmes/rulesets/<id>` lists the eight job names under the `required_status_checks` rule, each with `integration_id` 15368.

## Pros and cons of the options

### Each CI job required, with `CI / gate` kept

* Good, because each kind of check shows as required in the merge box.
* Good, because `CI / gate` still catches a skipped or cancelled job.
* Bad, because a renamed, added or removed job needs a ruleset edit timed to its merge.

### Only `ci / gate` required

* Good, because jobs join, leave or change name without a ruleset edit.
* Bad, because the merge box marks only `ci / gate` as required, and the jobs behind it show without that mark.

## More information

* Related ADRs: [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) (the ruleset line this ADR changes), [0065](0065-coderabbit-check-run-and-a-required-approval-on-main.md) (the approving review rule), [0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) (the root scripts the jobs run), [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md) (the two time zone legs), [0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md) (the SPDX header check).
* Plan: [13 delivery and GitHub, required checks](../plan/13-delivery-and-github.md#required-checks) and [11 quality and testing, required checks](../plan/11-quality-and-testing.md#required-checks).
* Revisit if a ruleset edit that lags a job change blocks pull requests.
