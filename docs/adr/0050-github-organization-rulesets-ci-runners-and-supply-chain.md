---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 12, 13, 15, 19, 25, 26, 27, 28, 30 and 32
informed: contributors, coding agents, the pilot customer's IT
release: "1"
needs-confirmation: ""
---

# GitHub organization, rulesets, CI runners and supply chain

## Context and problem statement

NorthMES is developed in public at `github.com/northmes/northmes` (moved from the maintainer's personal account and renamed on 2026-10-05) by one maintainer and many coding agents, and it ships container images to plants that may have no internet. Krister decided that the repository moves to the GitHub organization `northMES`; that the GitHub setup follows the maintainer's gqlPrune repository (release-please with one root component, Renovate with Dependabot alerts on, CodeRabbit, Codecov, Socket, OpenSSF Scorecard and Best Practices, issue forms, CodeQL); and that Blacksmith runners run the trusted test and build jobs while release, signing and fork pull requests stay on GitHub-hosted runners.

This ADR decides the repository owner and when it moves, the organization and repository settings, the rulesets, which job runs where, the dependency update tool, what agents may do on GitHub, and how a plant verifies a release without internet. Versioning and the changelog are in [ADR 0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md), the license gate in [ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md), delivery with handoff in [ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md).

## Decision drivers

* A GHCR package stays with the account that pushed it; a repository transfer does not move it, and GitHub documents no redirect for image paths.
* Blacksmith works only for organizations. Merge queue, issue types and the linked artifacts page are organization features too.
* handoff reads its plan Project from the repository owner, so its support for organization-owned Projects had to exist before the move. That support is built, and spike SP0 checked it on 2026-10-05.
* One maintainer approves every change; agents push many branches; public issues are untrusted input.
* A fork pull request runs the workflow file from the fork, so it can pick any runner label and write to shared runner caches.
* Blacksmith runners register as self-hosted. npm trusted publishing and provenance reject them, and `gh attestation verify --deny-self-hosted-runners` rejects attestations made on them.
* A plant without internet must verify the file it received, not a registry signature.
* The update tool must handle pnpm catalogs, digest pins in Compose files and Dockerfiles, a shared image digest file and a release-age delay.

## Considered options

* Repository owner: the personal account, or the organization `northMES`
* Dependency updates: Dependabot version and security updates (gqlPrune's tool), or Renovate with Dependabot alerts on and Dependabot security updates off
* Runners: GitHub-hosted for every job; Blacksmith for every job; or Blacksmith for trusted test and build jobs and GitHub-hosted for the rest
* Release verification at the plant: cosign keyless signatures; GitHub artifact attestations with cosign optional; checksums only

## Decision outcome

Chosen options: the organization `northMES`, Renovate, Blacksmith for trusted test and build jobs only, and artifact attestations as the documented verification path, because together they keep image paths stable, keep every signing and publishing step on runners that verifiers accept, and give plant IT a verification procedure that GitHub documents for hosts without internet.

Organization and the move:

* The organization `northMES` exists on the GitHub Free plan, with northmes.dev verified.
* Status on 2026-10-05: these accounts are set up: the `northMES` organization with CodeRabbit installed, the npm organization `northmes`, the Docker Hub namespace `northmes`, the public mailboxes on northmes.dev, two-factor sign-in on every account, a private companion repository for maintainer material, and the sandbox organization `northmes-sandbox` for tool tests. Spike SP0 passed: handoff's GitHub organization support is built and was checked on a repository in `northmes-sandbox`.
* The repository moved into the organization on 2026-10-05 and is named `northmes`. `add_project` targets `northmes/northmes` directly and `setup_plan` creates or adopts the plan Project under the organization; if handoff already holds the project under the old owner, `pnpm handoff project move` updates it in place of `add_project`, and `setup_plan` with `copy_from` set to the old Project's owner and number copies the plan's items.
* The move happens before the first image is pushed to GHCR. Images are `ghcr.io/northmes/<image>`, with the `org.opencontainers.image.source` label set before the first push and public visibility set after it (a public package cannot become private again).
* Organization settings: approval required for all external contributors' workflow runs; actions must be pinned to a full-length commit SHA; read-only default workflow token; a second owner account kept for recovery.
* Waiting: Discussions, the organization `.github` repository, a dev container, per-module CODEOWNERS with teams, Sponsors, the public demo.

Repository settings and rulesets:

* Branch ruleset on `main`: pull request required with 0 approvals; review threads resolved; squash merge only; linear history; strict required checks `ci / gate`, `license gate`, `dependency audit` and `CodeQL`; force push and deletion blocked; no bypass actors.
* Tag ruleset on `v*`: blocks deletion and updates, allows creation for release-please.
* Immutable releases from the first release tag. A `release` environment with the owner as required reviewer, "Prevent self-review" off and administrator bypass off.
* Private vulnerability reporting with `.github/VULNERABILITY_REPORT.yml` and a required CWE; secret scanning and push protection; Dependabot alerts on; CodeQL default setup for `actions` and `javascript-typescript`.
* `CODEOWNERS` is `* @Krister-Johansson`; code owner review is not required, because a maintainer cannot approve their own pull request. Auto-merge off. Signed commits stay off until every agent path signs. GitHub's merge queue stays off; handoff's queue with strict checks merges one up-to-date pull request at a time.
* `pnpm-workspace.yaml` sets `pmOnFail: ignore`, so the lockfile stays one YAML document that GitHub's dependency graph can read.
* Workflows: top-level `permissions: contents: read` and per-job raises; every action pinned by full SHA with the version in a comment; `persist-credentials: false`; no `pull_request_target`; event values never interpolated into run scripts. Required workflows have no `on.paths` filter; a job that runs only for some paths decides in its first step.

Runners:

| Job | Runner |
|---|---|
| Lint, typecheck, build, license gate | GitHub-hosted `ubuntu-24.04` |
| Unit and integration in both time zone legs, e2e, for pull requests from branches in the repository and pushes to `main` | Blacksmith 4 vCPU x64 |
| The same jobs for fork pull requests | GitHub-hosted |
| Image build and smoke, amd64 and arm64; nightly ops tests | Blacksmith 4 vCPU x64 and arm |
| Release, image push, signing, attestations, SBOMs, npm publish, the release pull request, the CLA check, Scorecard, labelers | GitHub-hosted |

* Runner labels live in repository variables `NM_RUNNER_X64` and `NM_RUNNER_ARM64`. A `runs-on` expression sends fork pull requests to `ubuntu-24.04` and falls back to it when the variable is unset, so deleting the variables moves CI back without a commit.
* Blacksmith's 4 vCPU size matches GitHub's public 4 vCPU and 16 GB runners, so tests behave the same on both paths. Until the repository is in the organization, every job runs on GitHub-hosted runners.
* Blacksmith settings: the App on the NorthMES repository only; sticky-disk branch protection on; branch-scoped caches; SSH access off; AI features off; a spending alert; an EU region requested from support. `useblacksmith/*` actions are pinned by SHA; sticky disks are not used in release 1.
* The first two weeks compare wall time, container start time and flake rate between the two paths.

Tooling modeled on gqlPrune:

* Renovate (Mend app) with `config:best-practices`, `helpers:pinGitHubActionDigests`, digest pinning for Compose files and Dockerfiles, a custom manager for the database image digest in `infra/pg-image.json`, and `minimumReleaseAge`, strict for the Module Federation packages. Dependabot alerts on, Dependabot security updates off, so two bots never open the same fix. If Renovate cannot update the pnpm lockfile in its first week, Dependabot version updates take over.
* CodeRabbit, installed on the `northMES` organization, with `.coderabbit.yaml`, which passes CodeRabbit's validation. A public repository with fewer than 10 stars gets a review only after an `@coderabbitai review` comment. The config turns on `request_changes_workflow`, so a clean review approves the head commit. The coder checks each finding against the issue and the ADRs instead of obeying it, and lists rejected findings with the reason in the pull request description. Details: [docs/agents/coderabbit.md](../agents/coderabbit.md).
* Codecov (informational, one OIDC upload from the UTC leg), Socket (`socket.yml`, new dependencies on pull requests), OpenSSF Scorecard and Best Practices (`.bestpractices.json`, passing before release 1), issue forms and a pull request template, `scripts/labels.sh`, `context7.json`, and the community files `AGENTS.md`, `GOVERNANCE.md`, `NOTICES.md`, `SECURITY.md`, `CONTRIBUTING.md` and a code of conduct that names conduct@northmes.dev.

Agents on GitHub:

* An agent merges only when the maintainer asks. handoff's merge node is manual on `northmes-guided`; on `northmes-standard` and `northmes-lean` it merges automatically, and the operating session uses those graphs only after Krister has switched routine tasks to them under the switch rule ([ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md)).
* The Claude Code Action runs as a custom GitHub App with Contents, Issues and Pull requests permissions only (no Workflows permission), a turn limit, a job timeout and a concurrency group.
* Actions execution policies let only the owner start the release and image workflows by `workflow_dispatch`.
* A run agent never adds a dependency released within the `minimumReleaseAge` window; it returns `needs_input`, and a dependency addition is its own human-reviewed task. `AGENTS.md` states the tool-neutral form of the rule (a new dependency comes in its own pull request, at a version older than the window); handoff's project agent notes state the `needs_input` part.
* E03 runs start only after the E02 foundation pull request has settled the root configs (`pnpm-lock.yaml`, `package.json`, `vitest.config.ts`, `turbo.json`, Biome), or all root-config changes land in one session pull request before the first E03 run starts; later root-config changes are human-labelled tasks.

Offline image bundle and its verification:

* A release job on an amd64 GitHub-hosted runner builds `northmes-<v>-linux-amd64-images.tar.zst` from `docker compose config --images` with `docker save --platform linux/amd64` and attaches its sha256.
* GitHub artifact attestations cover the image digests, the SBOMs, the `docker save` tarballs and the Compose bundle. They are made on GitHub-hosted runners only, and their bundles are renamed `<asset>.intoto.jsonl` so Scorecard's Signed-Releases check credits them.
* The documented path, in `SECURITY.md` and the upgrade runbook: on a connected machine `gh attestation download <file> -R northmes/northmes` and `gh attestation trusted-root > trusted_root.jsonl`; on the offline host `gh attestation verify <file> -R northmes/northmes --bundle <bundle>.jsonl --custom-trusted-root trusted_root.jsonl`. cosign keyless signatures, including `cosign sign-blob` on the tarball, stay an optional second path; plain checksums are the minimum.
* `install-preflight.sh` checks that `docker info` shows the containerd snapshotter, Engine 29 or later and Compose 5 or later, verifies the tarball, and after `docker load` runs `docker image inspect <ref@digest>` for each image; the stack starts with `docker compose up --pull never`. Offline Docker packages are a customer IT prerequisite in the install guide.
* Trivy or Grype run pinned by digest; every action and scanner is pinned by full SHA or digest.

### Consequences

* Good, because image paths, the organization name and repository URLs stay the same when ownership later passes to a company, which is an ownership change, not a transfer.
* Good, because everything that signs, attests or publishes runs where verifiers can require `github-hosted`, and a plant without internet has one documented verification command.
* Good, because one variable change moves CI off Blacksmith during an outage.
* Bad, because every job runs on GitHub-hosted runners until the repository moves, and the move waits for Krister's approval of the transfer.
* Bad, because Blacksmith sees the jobs it runs, their logs and any secret given to them; the moved jobs need no secret beyond a read-only token.
* Bad, because Scorecard's Code-Review stays at 0 while one maintainer merges their own pull requests.
* Neutral, because the Renovate app with pnpm 12 lockfiles is untested; the Dependabot fallback covers a failure.

### Confirmation

* A meta test `test/meta/workflows.test.ts` parses `.github/workflows/*.yml` and fails on: an action not pinned to a 40-character SHA; any `pull_request_target`; a workflow without top-level `permissions`; an `on.paths` filter on a workflow that feeds a required check; a Blacksmith label outside the variable expression with the fork fallback; a job that both runs `pnpm install` and holds `id-token: write`.
* The organization's SHA-pinning setting makes an unpinned action fail at run time.
* Release CI job `bundle-offline` copies the tarball into a fresh amd64 VM or Docker-in-Docker started with `--network none`, runs the preflight, loads, runs `up --pull never --wait`, and expects 200 from `/health/ready` through Caddy.
* A preflight unit test fails on `docker info` output that shows overlay2 without the containerd snapshotter.
* The release verification job runs the offline `gh attestation verify` command with `--deny-self-hosted-runners` on the bundle before the draft release is published, and checks that every attested asset has its `.intoto.jsonl` file.
* After the first push, the E00 task checks that the dependency graph lists the workspace packages.
* A plan check: no E03 task is Ready before the foundation pull request is merged.

## Pros and cons of the options

### Organization `northMES`

* Good, because GHCR paths, Blacksmith, merge queue and issue types depend on it, and the repository is still empty, so moving costs nothing.
* Bad, because handoff's plan features needed organization Projects first; that support is built and passed SP0 on 2026-10-05.

### Personal account

* Good, because handoff works with it today.
* Bad, because images pushed under it stay there after any later move, and Blacksmith cannot run.

### Renovate with Dependabot alerts

* Good, because it pins and updates digests in Compose files, Dockerfiles and Actions, updates the shared digest file through a custom manager, and reads pnpm catalogs.
* Bad, because it is new to the maintainer, and its free tier runs one job at a time every 4 hours.

### Dependabot updates

* Good, because the maintainer knows it from gqlPrune.
* Bad, because security updates are not supported for Docker or Compose, and several pnpm issues were open when this was decided.

### Blacksmith for trusted jobs only

* Good, because the slow Testcontainers and e2e jobs get colocated caches, while fork code and signing never reach a self-hosted runner.
* Bad, because two runner paths must stay equivalent; the variable pattern and matching sizes keep them so.

### Blacksmith for every job, or GitHub-hosted only

* Bad (Blacksmith only), because attestations and npm provenance would record a self-hosted runner, and fork pull requests could spend money.
* Neutral (GitHub-hosted only), because it is free for a public repository but slower; it stays the fallback.

### Attestations as the documented path

* Good, because the tarball itself is the attested subject and GitHub documents offline verification with one binary.
* Bad, because the trusted root rotates a few times a year, so plant IT fetches a fresh one with each import.

### cosign only, or checksums only

* Bad (cosign only), because offline verification of a saved image was left open.
* Bad (checksums only), because a checksum from the same release page proves no origin.

## More information

* Related ADRs: [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) (release-please, draft releases), [0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md) (CLA check), [0040](0040-dependency-license-policy-ci-gate-and-sbom.md) (license gate, SBOM), [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md), [0042](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md) (live AI workflow), [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md), [0045](0045-backups-restore-drills-upgrades-and-rollback.md), [0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md), [0051](0051-regulated-readiness-no-regret-rules.md) (rule 20), [0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md).
* Plan: [13 delivery and GitHub](../plan/13-delivery-and-github.md), [12 operations and security, offline image transfer](../plan/12-operations-and-security.md#offline-image-transfer) and [supply chain](../plan/12-operations-and-security.md#supply-chain).
* The plant's IT chooses the tool on its transfer machine (`gh`, cosign or checksums); every release carries all three. The question is tracked in [16 open questions](../plan/16-open-questions.md).
* GitHub artifact attestations: https://docs.github.com/en/actions/concepts/security/artifact-attestations. SHA pinning policy: https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/. Blacksmith GitHub App: https://docs.blacksmith.sh/blacksmith-administration/github-app. SLSA requirements: https://slsa.dev/spec/v1.0/requirements. gqlPrune: https://github.com/Krister-Johansson/gqlPrune.
* Revisit after the move to `northMES`, after the two-week runner comparison, when every agent path signs commits, when a second maintainer joins (teams, code owner review), and if Renovate fails on the pnpm lockfile.
