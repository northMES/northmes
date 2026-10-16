# Governance

This file describes how NorthMES is run today: who decides, how decisions are recorded, how a change gets in and who may hold elevated access to the repository. It changes through a pull request like any other file.

## The maintainer decides

Krister Johansson is the only maintainer of NorthMES and decides the scope, the plan and the architecture, accepts the architecture decisions, and decides what merges to `main`.

The maintainer works with coding agents and bots. They write code, review it and run checks, but they act under the rules below and never decide on their own.

## Roles

| Role | Who | Responsibilities |
|---|---|---|
| Maintainer | Krister Johansson | Decides scope, plan and architecture. Sets an ADR's status to `accepted`. Moves planned tasks to Ready. Approves the pull requests that CodeRabbit skips (Renovate's and the release pull request) and merges the release pull request. Asks an agent to merge, or merges directly. Triages issues and security reports, and enforces the [code of conduct](CODE_OF_CONDUCT.md). Grants elevated access under the policy below |
| Contributor | Anyone who opens an issue or sends a pull request | Opens an issue with the issue forms before a change. Sends a pull request that links the issue, passes the required checks and fills in the pull request template, including its Security section. Signs the contributor license agreement, [CLA.md](CLA.md), or works for an employer that signed [CLA-corporate.md](CLA-corporate.md). Follows [AGENTS.md](AGENTS.md) and the [code of conduct](CODE_OF_CONDUCT.md). Reports vulnerabilities privately as [SECURITY.md](SECURITY.md) describes |
| Coding agents | Interactive Claude Code sessions run by the maintainer, and the agents of a handoff run | Plan, write tests and code, review and open pull requests under [AGENTS.md](AGENTS.md) and the rules in [docs/plan/13-delivery-and-github.md](docs/plan/13-delivery-and-github.md#who-does-what). Bring every question, permission request and merge decision to the maintainer. Merge only when the maintainer asks. A run agent does not push, run `gh`, open issues or resolve review threads |
| Bots | CI on GitHub Actions, CodeQL, CodeRabbit, release-please, Renovate, Codecov, Socket, OpenSSF Scorecard | Run checks, review pull requests, open dependency update and release pull requests. No bot merges |

The rules for agents and bots are in these files:

- [AGENTS.md](AGENTS.md): the working, security, scope and writing rules for any coding agent, and for people.
- [docs/plan/13-delivery-and-github.md](docs/plan/13-delivery-and-github.md#who-does-what): who does what, from the plan to a merged pull request.
- [ADR 0049](docs/adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md): the delivery workflow with handoff, thin vertical slices and a design per task.
- [ADR 0050](docs/adr/0050-github-organization-rulesets-ci-runners-and-supply-chain.md): the GitHub organization, the rulesets, the CI runners and what agents may do on GitHub.
- [ADR 0065](docs/adr/0065-coderabbit-check-run-and-a-required-approval-on-main.md): the CodeRabbit check run and the approving review that `main` requires.

## How decisions are recorded

The plan is in [docs/plan](docs/plan/README.md), and the decisions behind it are architecture decision records (ADRs) in [docs/adr](docs/adr/README.md), one file per decision in MADR 4 format.

- A new ADR has status `proposed`. Only the maintainer sets it to `accepted`.
- A changed decision gets a new ADR. The old ADR's status becomes `superseded by ADR-NNNN`, and its text stays as it was.
- The index in [docs/adr/README.md](docs/adr/README.md) lists every ADR with its title and status, and it says how to add one.
- When a plan document and an ADR disagree, the ADR holds and the plan document gets fixed.
- ADRs and plan documents are public. They reach `main` through pull requests like any other change.

## How a change gets in

1. Open an issue first, with the [bug report or feature request form](https://github.com/northMES/northmes/issues/new/choose). A vulnerability goes to private reporting instead, as [SECURITY.md](SECURITY.md) describes.
2. Send a pull request from a branch. Its title is a Conventional Commit written for users, because it becomes the squash commit subject and the changelog line. Its body says `Closes #N` for the issue it finishes and fills in the sections of the [pull request template](.github/PULL_REQUEST_TEMPLATE.md), Security included. `CI / cla` fails until the author of the pull request and of every commit has signed the contributor license agreement; post the sentence in [CLA.md](CLA.md) as a comment to sign. The CLA texts are drafts until a lawyer has reviewed them, and outside pull requests are not merged before that.
3. Run `pnpm check` before you push. On GitHub, `CI / gate` passes only when the CI jobs pass, among them lint, typecheck, build, the tests, the end-to-end specs and the checks on the pull request title, the linked issue and the Security section. CodeQL scans the code.
4. CodeRabbit reviews the pull request. The ruleset on `main` requires one approving review, dismisses an approval when a new commit is pushed, requires every review thread to be resolved, merges by squash only and has no bypass actors. CodeRabbit's approval or the maintainer's satisfies the review rule.
5. The maintainer decides whether the change merges.

## Granting elevated access

Elevated access means write, merge or admin rights on a NorthMES repository or the `northMES` GitHub organization, or access to a secret the project holds. Before any person gets elevated access, the maintainer:

1. Reviews the person's contribution history in the project and confirms their identity.
2. Grants the least role that covers the work the person will do.
3. Grants it through a GitHub team, not to the person's account directly.
4. Requires two-factor authentication on the person's GitHub account.
5. Records the grant, with the role and the reason, in the issue or pull request that asks for it.

## Continuity

The project has no decision yet on who continues NorthMES if the maintainer is unavailable. [Issue #527](https://github.com/northMES/northmes/issues/527) tracks that decision. Until it is made, this file names no successor and no second maintainer.

## Code of conduct and security

Everyone in the project follows the [code of conduct](CODE_OF_CONDUCT.md). Reports go to conduct@northmes.dev, and the maintainer handles them.

Vulnerabilities are reported privately, never in a public issue. [SECURITY.md](SECURITY.md) gives the channels and the response targets.
