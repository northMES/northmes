---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 08, 14, 24, 25, 27, 32 and 33
informed: plugin authors, pilot IT, contributors and coding agents
release: "1"
needs-confirmation: "maintainer (no range override in 0.x)"
---

# Versions and releases: lockstep 0.x, release-please, API reports

## Context and problem statement

NorthMES ships many packages from one repository: the MIT packages a plugin builds against, every module's server, contracts and web packages, the apps, the example plugins and one Docker image. An on-prem plant receives a release as an offline bundle and must be able to tell exactly which set of code it runs. Krister Johansson decided that releases use release-please with one root component, modeled on Krister Johansson's gqlPrune repository. The release tooling research had recommended Changesets 3 with a fixed package group instead (internal research note 14); the repository setup research compared both and recommended release-please (internal research note 25).

The stress test found that the version a module accepted was read from three places that could disagree: the host config, a constant in the shell and hard-coded ranges in each manifest (internal research note 32). It also found that a remote built against other shared web versions could load into a newer shell, and that the pilot's supplier questions need a defined path for security patches.

This ADR decides the version scheme, where the version comes from, the compatibility checks that use it, the API reports that make public changes visible, the release-please configuration and release workflow, the patch release class and the release cadence. It covers every workspace package, the image and the release workflow. Plugin install is in [ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md); signing, attestations and runners are in [ADR 0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md).

## Decision drivers

* "NorthMES X.Y.Z" names one exact set of packages and one image.
* One tag, one GitHub release and one changelog per version, with lines a plant admin can read.
* No semver promise on a surface the project cannot yet hold stable; breaking changes are expected before 1.0.
* A mismatch between image, config, plugin and remote fails at boot or in CI with both values named, never at run time on the plant.
* The maintainer already runs release-please; one developer cannot carry a second release artifact per pull request.
* Images are built, pushed and signed in the same workflow run as the release, so a plant can verify them offline.
* A regulated customer later needs to see what each change touched.

## Considered options

* Lockstep 0.x with release-please and one root component
* Changesets 3 with a fixed package group
* release-please with one component per package and the `linked-versions` and `node-workspace` plugins
* Independent package versions with semver promises from release 1
* Lockstep 0.x with an audited `acceptNorthmes` range override

## Decision outcome

Chosen option: "Lockstep 0.x with release-please and one root component", because it gives one version, one tag, one release and one changelog without plugins, 0.x semantics are a configuration flag, and it is the tool Krister chose. The configuration details come from the repository setup research and the stress test.

### One version

* Every `@northmes/*` package, every module package, the example plugins and the image carry one version, bumped together, and stay on 0.x through the pilot. A breaking change bumps the minor. Docker tags are `X.Y.Z` and `X.Y`.
* The version comes from the image's `package.json`. The config's version field is dropped; if a config still names one that differs, boot fails naming both ("config names 0.3.0, this image is 0.4.0").
* In-repo manifests import their version. Release automation writes ranges as `>=X.Y.0-0 <X.(Y+1).0-0`, and server checks use `semver.satisfies` with `includePrerelease`, because an upper bound of `<X.(Y+1).0` would admit `X.(Y+1).0-rc.1`.
* The shell drops its own range check and checks only that each remote's id and version equal the server's module list entry.
* `northmes plugin build` writes a plugin's manifest range from `peerDependencies['@northmes/sdk']`, and boot refuses a plugin whose two values differ.
* No audited range override (`acceptNorthmes`) exists in release 1. In 0.x every minor therefore excludes plugins built for the previous minor until they are rebuilt (the maintainer confirms).
* `/api/web/modules` checks each remote's shared versions: react the same major and not newer than the shell's, the router and Apollo Client the same minor, `@northmes/web-sdk` and `@northmes/ui` the same 0.minor. A committed build of the previous release's example widget loads in Playwright on pull requests that touch the shared singleton list or the federation packages.

### API reports and schema diffs

* API Extractor writes a committed report per MIT package from the first commit. Exports are `@internal` by default, `@beta` for what the example plugins use, and `@public` only at 1.0. A changed report shows in review.
* GraphQL Inspector diffs the committed API schema and reports only in 0.x; its entity-field diff goes into the release notes. It becomes a gate at 1.0.
* Event payloads carry `schema_version`. Event JSON Schemas are diffed, and an added field counts as breaking, because consumers read what NorthMES produces.

### Releases with release-please

* One root component at `"."`, release type `node`, `bump-minor-pre-major`, `initial-version: 0.1.0`, tags `vX.Y.Z` without a component, and `extra-files` with `"glob": true` over `apps/*/package.json`, `modules/*/package.json`, `packages/*/package.json` and `examples/*/package.json`. Internal dependencies use `workspace:*`, which release-please leaves alone. Spike SP2 tests the configuration in a scratch repository before the first release pull request.
* Pull requests merge by squash only. The pull request title is the commit subject and the body is empty. The title is a Conventional Commit written for users, `type(module): outcome`, with `!` for a breaking change; `ci / pr title` checks it. `feat`, `fix`, `security`, `perf` and `revert` are visible in the changelog; the other types are hidden. A wrong line is fixed with `BEGIN_COMMIT_OVERRIDE` in the merged pull request's body. Upgrade steps go into the upgrade guide in `apps/docs`.
* Releases are drafts with `force-tag-creation: true`. In the same workflow run the release workflow builds, pushes and signs the images, attaches the image bundles, SBOMs and attestation bundles, and then publishes. Immutable releases are on from the first release tag. No job both installs dependencies and holds `id-token: write`.
* Every pull request states a validation impact: none, UI only, records, security, calculation or data migration ([ADR 0051](0051-regulated-readiness-no-regret-rules.md)).
* A patch release is image-only: no migrations, rollback class image ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)), with a target of 72 hours from fix to customer bundle.
* Changesets is not used. Publishing the MIT packages to npm comes after the pilot.

### Cadence and support

Working answer until the maintainer confirms it before the first release: monthly minor releases and patches as needed. Before 1.0 only the latest minor gets fixes. After 1.0 one minor per year gets 12 months of fixes. A regulated customer needs a longer support line and cumulative release notes across skipped versions; that is decided when one signs.

### Consequences

* Good, because one number tells a plant, a plugin author and a support engineer which code runs.
* Good, because every version mismatch fails at boot or in CI with both values in the message.
* Good, because release notes come from pull request titles that a check enforces, with no extra file per pull request.
* Bad, because every package bumps on every release, even when it did not change.
* Bad, because release notes are only as good as the titles; a title written for developers becomes a changelog line.
* Bad, because without a range override, a plugin built for 0.3 stops loading on 0.4 until it is rebuilt.
* Neutral, because the glob `extra-files` path is untested until spike SP2 runs.

### Confirmation

* `catalog.test.ts`: config 0.3.0 with image 0.4.0 throws naming both; image `0.4.0-rc.1` with range `>=0.3.0 <0.5.0` passes; peer `^0.3.0` against manifest range `>=0.3.0 <0.5.0` fails.
* A CI check fails when an in-repo manifest version differs from the root `package.json` version or an example plugin's range excludes it.
* Shared-version test: a remote built with a newer react major than the shell's is marked incompatible. The N-1 widget spec renders the committed previous build with no console error and no CSP violation.
* API Extractor runs in CI and fails when a report changed without being committed. The event schema diff reports an added field as breaking.
* `ci / pr title` rejects a title that is not a Conventional Commit with an allowed type.
* Spike SP2: in a scratch repository, one release pull request rewrites the version in every globbed `package.json`, proposes `0.1.0` first, and turns a `feat!:` title into a minor bump.
* A release test fails a patch release whose migration list differs from the previous minor's.
* The release workflow's verification job loads the offline bundle with `--network none` and gets `/health/ready` through Caddy before the release is published.

## Pros and cons of the options

### Lockstep 0.x with release-please, one root component

* Good, because one release pull request, one tag and one changelog come out of the box.
* Good, because `bump-minor-pre-major` gives 0.x semantics without a script.
* Bad, because the version bump follows commit types, so a missing `!` hides a breaking change; API reports and schema diffs are the backstop.

### Changesets 3 with a fixed group

* Good, because each pull request carries an explicit bump and a sentence for users.
* Bad, because it creates one release per package by default, so the workflow must build the single product release itself.
* Bad, because 0.x needs a script that requires `minor` for breaking changes, and every pull request needs a second artifact.

### release-please per component with plugins

* Good, because each package keeps its own changelog.
* Bad, because open bugs in the `node-workspace` and `linked-versions` plugins hit pnpm monorepos like this one, and it creates one tag and release per component.

### Independent versions with semver from release 1

* Good, because an unchanged package keeps its version.
* Bad, because comparable platforms with full teams break minors on narrower surfaces; promising semver on every extension point before the pilot cannot be kept.
* Bad, because a plant could not name its installation with one number.

### Lockstep 0.x with an audited range override

* Good, because a plant could run a plugin built for the previous minor without a rebuild.
* Bad, because it skips the one check that catches an incompatible plugin, and it would need the composition check and the shared-version check to be mandatory alongside it.

## More information

* Related ADRs: [0003](0003-module-package-shape-and-the-definemodule-manifest.md) manifest fields, [0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md) schema snapshot, [0019](0019-web-shell-with-react-module-federation-remotes.md) remotes and shared singletons, [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) plugins, [0040](0040-dependency-license-policy-ci-gate-and-sbom.md) SBOMs, [0045](0045-backups-restore-drills-upgrades-and-rollback.md) rollback classes, [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) signing and runners, [0051](0051-regulated-readiness-no-regret-rules.md) validation impact.
* Plan: [13-delivery-and-github.md](../plan/13-delivery-and-github.md#release-process), [03-modules-and-extensibility.md](../plan/03-modules-and-extensibility.md#versions-and-compatibility-checks), [16-open-questions.md](../plan/16-open-questions.md) (M-13, M-18).
* release-please: https://github.com/googleapis/release-please. API Extractor: https://api-extractor.com/. Conventional Commits: https://www.conventionalcommits.org/.
* Revisit at 1.0 (`@public` tags, GraphQL diff as a gate, support line), when the public SDK is published, and if spike SP2 shows the glob `extra-files` path does not work.
