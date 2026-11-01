# Project credentials

How the NorthMES project handles its own credentials: the tokens its workflows use, the secrets stored in GitHub, and the maintainer's own tokens. It answers the OpenSSF criterion `osps_br_07_02`. The secrets of an installation (database role passwords, the auth secret, the installation key) are a different matter, decided in [ADR 0047](../adr/0047-secrets-and-the-installation-key.md) and [ADR 0060](../adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md).

The rules rest on [ADR 0050](../adr/0050-github-organization-rulesets-ci-runners-and-supply-chain.md) (organization, repository and workflow settings), [ADR 0077](../adr/0077-visual-regression-snapshots-with-argos-from-the-playwright-specs.md) (the Argos token) and [ADR 0076](../adr/0076-secure-development-lifecycle-with-a-security-note-per-change-a-controls-index-and-an-internal-audit-each-release.md) (the internal audit that checks this page).

## Workflow tokens

Every job in `.github/workflows/` runs with GitHub's `GITHUB_TOKEN`. GitHub issues it when the job starts and revokes it when the job ends, so no workflow holds a long-lived GitHub credential.

- Every workflow sets top-level permissions, and every job sets its own. The organization's default workflow token is read-only (ADR 0050).
- Every checkout sets `persist-credentials: false`, so the token does not stay in the working copy for later steps.
- No workflow uses `pull_request_target`, so a pull request from a fork runs without write rights and without the repository's secrets.
- `test/meta/workflows.test.ts` enforces each of these rules, and lists the permissions each job may hold.

All jobs read the repository (`contents: read`) and nothing more, with these exceptions:

| Job | Workflow | Permissions | Why |
|---|---|---|---|
| `gate` | `ci.yml` | none | It reads only the results of the jobs it needs |
| `cla` | `ci.yml` | `contents: read`, `pull-requests: read` | Reads the pull request, its commits, `.github/cla/signed.json` and its own script through the API from the default branch, with no checkout ([ADR 0039](../adr/0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md)) |
| `pull request` | `pr.yml` | `contents: read`, `pull-requests: read` | Reads the pull request the run is about through the API, from the event's number or, in a merge group, from the queue branch's name, and writes its fields as job outputs for the other PR jobs ([ADR 0093](../adr/0093-merge-through-githubs-merge-queue-with-the-pull-request-checks-the-risk-gate-and-codeql-reporting-on-the-queues-commits.md)) |
| `risk gate` | `risk.yml` | `contents: read`, `pull-requests: read` | Reads the pull request, its files and reviews, `.github/risk-paths` and its own scripts through the API from the default branch, with no checkout ([ADR 0086](../adr/0086-risk-tiered-review-and-merge-of-agent-pull-requests.md)) |
| `risk label` | `risk.yml` | `contents: read`, `pull-requests: write` | Labels the pull request `risk:low` or `risk:high` with the tier from `risk gate`, and runs nothing from the repository. A pull request from a fork gets a read-only token, so its label step only warns (ADR 0086) |
| `risk refresh` | `risk-refresh.yml` | `actions: write`, `pull-requests: read` | Runs from the default branch when a Risk run that a review started passes, checks that the commit is still the head of an open pull request, and re-runs the other failed or cancelled Risk runs at that commit one at a time, so the risk gate checks from before an approval read the reviews again. It reads no files and runs nothing from the repository (ADR 0086) |
| `release please` | `release.yml` | `contents: write`, `pull-requests: write` | Keeps the release pull request open and tags the release ([ADR 0038](../adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md)) |
| `release image` | `release.yml` | `contents: write`, `packages: write` | Pushes the image to ghcr.io with the job's token and writes the `.env` line into the release notes ([ADR 0080](../adr/0080-upgrade-paths-with-upgrade-stops-a-rehearsal-on-a-restored-copy-and-an-upgrade-matrix-in-ci.md)) |
| `release attestations` | `release.yml` | `contents: write`, `packages: write`, `id-token: write`, `attestations: write` | Attests the image's build provenance and its SBOM, pushes both attestations to ghcr.io and attaches the SBOM and the bundles to the release. It checks out nothing and installs nothing ([ADR 0050](../adr/0050-github-organization-rulesets-ci-runners-and-supply-chain.md)) |
| `Scorecard analysis` | `scorecard.yml` | `contents: read`, `security-events: write`, `id-token: write` | Uploads the findings to code scanning and publishes the score to the OpenSSF API |
| `codeql` | `codeql.yml` | `contents: read`, `actions: read`, `security-events: write` | Runs CodeQL on `actions` and `javascript-typescript` with no build and uploads the analysis to code scanning; the actions language reads the workflow runs it analyzes (ADR 0093) |

### OIDC

Two jobs request an OIDC token (`id-token: write`). `release attestations` uses it to sign the attestations through GitHub Actions OIDC, so signing needs no stored key. `Scorecard analysis` uses it so the OpenSSF API can check that the published score comes from this repository's workflow, so publishing needs no stored secret. `test/meta/workflows.test.ts` checks that no job both runs `pnpm install` and holds `id-token: write`. ADR 0050 decides an OIDC upload to Codecov as well; no workflow does it yet.

## Stored secrets

The workflows reference one repository secret besides the job token, and no organization secret.

| Secret | Read by | Who can change it | Stored in | Rotated |
|---|---|---|---|---|
| `GITHUB_TOKEN` | `release image`, to log in to ghcr.io and to edit the release notes; `release attestations`, to log in to ghcr.io and to upload the release assets; `cla`, to read the pull request, its commits and `signed.json` through the API; `pull request`, to read the pull request for the PR jobs; `risk gate`, to read the pull request, its files and reviews; `risk label`, to label the pull request; `risk refresh`, to re-run a failed Risk run | nobody: GitHub issues it per job | not stored; GitHub creates it for each job | at the end of every job |
| `ARGOS_TOKEN` | the `pnpm e2e` step of the `e2e` job only, as an environment variable (ADR 0077; checked by `test/meta/workflows.test.ts`) | the organization owners, through the repository settings | GitHub encrypted secrets, repository level | at least once a year, and at once after a suspected leak or when a person with access leaves |

GitHub does not show a stored secret's value to anyone after it is saved, so whoever changes a secret replaces it rather than reads it. `ARGOS_TOKEN` is Argos's project token: it uploads screenshots to the one NorthMES project and grants nothing in GitHub.

The repository variables `NM_RUNNER_X64` and `NM_RUNNER_ARM64` hold runner labels, not credentials (ADR 0050).

A new secret gets its row here in the same pull request that first references it, and `test/meta/security-docs.test.ts` fails a change that references a secret this page does not list. The internal audit before each release compares this table with the repository settings and records when each stored secret was last rotated.

## Accounts and personal tokens

- Every project account has two-factor sign-in: the `northMES` GitHub organization, the npm organization `northmes`, the Docker Hub namespace `northmes` and the mailboxes on northmes.dev (ADR 0050). A second owner account is kept for recovery.
- A personal access token of the maintainer is fine-grained, limited to the repositories and permissions its task needs, and has an expiry of at most one year.
- One exception is the classic token in handoff's `.env` on the maintainer's machine, with the `project` scope. [Plan 13](../plan/13-delivery-and-github.md) chose it because a fine-grained token cannot reach a user-owned Project. It also carries an expiry of at most one year, and it is replaced by a fine-grained token once one is shown to reach the plan Project under the organization.
- Claude Code sessions act on GitHub as the machine user `northmes-agent`, with the write role on `northMES/northmes` only ([ADR 0084](../adr/0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md)). Its fine-grained token reaches that one repository with Contents, Pull requests, Issues and Actions read and write and Metadata read, holds no Workflows, Administration or Secrets permission, and is the other exception: it has no expiration date. It lives in the `env` of the main checkout's `.claude/settings.local.json` on the maintainer's machine, which git ignores and only this repository's sessions load, and the maintainer revokes and regenerates it at once after a suspected leak.
- The maintainer's own gh logins use gh's file storage under `~/.config/gh`, which the Claude Code sandbox denies, and the macOS keychain holds no GitHub credential, because a sandboxed command can read the keychain (ADR 0084).
- A personal token is revoked at once after a suspected leak, and every token a person holds for the project is revoked when that person leaves.

## No credential in the repository

- No credential is committed. Secret scanning and push protection are on for the repository (ADR 0050), so a push that holds a known secret format is refused.
- Tests and the stack seed use only generated or public development values. The server refuses to boot in production with the seed's dev users or with dev secrets (the [controls index](README.md#controls-index), section 1).
- A credential that reaches the repository anyway is treated as leaked: it is revoked and replaced first, and removed from the history afterwards.
