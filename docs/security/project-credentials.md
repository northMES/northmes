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
| `release please` | `release.yml` | `contents: write`, `pull-requests: write` | Keeps the release pull request open and tags the release ([ADR 0038](../adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md)) |
| `release image` | `release.yml` | `contents: write`, `packages: write` | Pushes the image to ghcr.io with the job's token and writes the `.env` line into the release notes ([ADR 0080](../adr/0080-upgrade-paths-with-upgrade-stops-a-rehearsal-on-a-restored-copy-and-an-upgrade-matrix-in-ci.md)) |
| `Scorecard analysis` | `scorecard.yml` | `contents: read`, `security-events: write`, `id-token: write` | Uploads the findings to code scanning and publishes the score to the OpenSSF API |

### OIDC

`Scorecard analysis` is the only job that requests an OIDC token (`id-token: write`). The OpenSSF API uses it to check that the published score comes from this repository's workflow, so publishing needs no stored secret. `test/meta/workflows.test.ts` checks that no job both runs `pnpm install` and holds `id-token: write`. ADR 0050 decides an OIDC upload to Codecov as well; no workflow does it yet.

## Stored secrets

The workflows reference one repository secret besides the job token, and no organization secret.

| Secret | Read by | Who can change it | Stored in | Rotated |
|---|---|---|---|---|
| `GITHUB_TOKEN` | `release image`, to log in to ghcr.io and to edit the release notes | nobody: GitHub issues it per job | not stored; GitHub creates it for each job | at the end of every job |
| `ARGOS_TOKEN` | the `pnpm e2e` step of the `e2e` job only, as an environment variable (ADR 0077; checked by `test/meta/workflows.test.ts`) | the organization owners, through the repository settings | GitHub encrypted secrets, repository level | at least once a year, and at once after a suspected leak or when a person with access leaves |

GitHub does not show a stored secret's value to anyone after it is saved, so whoever changes a secret replaces it rather than reads it. `ARGOS_TOKEN` is Argos's project token: it uploads screenshots to the one NorthMES project and grants nothing in GitHub.

The repository variables `NM_RUNNER_X64` and `NM_RUNNER_ARM64` hold runner labels, not credentials (ADR 0050).

A new secret gets its row here in the same pull request that first references it, and `test/meta/security-docs.test.ts` fails a change that references a secret this page does not list. The internal audit before each release compares this table with the repository settings and records when each stored secret was last rotated.

## Accounts and personal tokens

- Every project account has two-factor sign-in: the `northMES` GitHub organization, the npm organization `northmes`, the Docker Hub namespace `northmes` and the mailboxes on northmes.dev (ADR 0050). A second owner account is kept for recovery.
- A personal access token of the maintainer is fine-grained, limited to the repositories and permissions its task needs, and has an expiry of at most one year.
- The one exception is the classic token in handoff's `.env` on the maintainer's machine, with the `project` scope. [Plan 13](../plan/13-delivery-and-github.md) chose it because a fine-grained token cannot reach a user-owned Project. It also carries an expiry of at most one year, and it is replaced by a fine-grained token once one is shown to reach the plan Project under the organization.
- A personal token is revoked at once after a suspected leak, and every token a person holds for the project is revoked when that person leaves.

## No credential in the repository

- No credential is committed. Secret scanning and push protection are on for the repository (ADR 0050), so a push that holds a known secret format is refused.
- Tests and the stack seed use only generated or public development values. The server refuses to boot in production with the seed's dev users or with dev secrets (the [controls index](README.md#controls-index), section 1).
- A credential that reaches the repository anyway is treated as leaked: it is revoked and replaced first, and removed from the history afterwards.
