---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 12, 13, 15, 23, 25 and 37
informed: contributors, plugin authors, coding agents and pilot IT
release: "1"
needs-confirmation: "lawyer (GPL family policy)"
---

# Dependency license policy, CI gate and SBOM

## Context and problem statement

NorthMES core is AGPL-3.0-or-later and contributions come under a CLA ([ADR 0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md)); the SDK and contracts packages are proposed as MIT ([ADR 0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md)). Every package in the server image or the browser bundle is distributed with NorthMES. A dependency's license therefore decides whether the image can ship under the AGPL, whether the MIT packages stay MIT, and whether the extension exception can cover plugins: the copyright holder can grant that exception only for code it owns.

A license audit of 124 candidate packages found that most are permissive, but three trees that look clean at the top carry restricted licenses: `@graphql-yoga/nestjs-federation` pulls five Elastic-2.0 Apollo packages, `@sentry/node` 11 pulls the FSL-licensed Sentry CLI into production installs, and `exceljs` pulls a package with no license at all (internal research note 13). The same audit found that `pnpm licenses list` reported a custom license as MIT, and that one off-the-shelf checker reported no forbidden license on a tree with five Elastic-2.0 packages. The AI research found that `@mastra/core` declares Apache-2.0 on npm while its published tarball ships `ee/` folders under a source-available enterprise license (internal research note 23). Coding agents add dependencies as part of their tasks.

This ADR decides the license policy per package class, the CI gate that enforces it from the first commit, the list of packages that are never installed, and the SBOMs and notices that ship with each release.

## Decision drivers

* The AGPL forbids passing on further restrictions, so source-available or non-commercial terms cannot sit in the distributed image.
* The extension exception and relicensing under the CLA work only for code the copyright holder can license.
* MIT packages must stay usable by plugins of any license.
* The gate must catch what SPDX fields hide: custom license texts, missing licenses and `ee/` folders.
* It runs from the first commit, costs little, and one developer can maintain it.
* Customers, supplier questionnaires and a later regulated customer ask for SBOMs.

## Considered options

* A gate script over `pnpm sbom` output with a policy per package class, denying third-party GPL-family licenses in core
* The same gate, allowing third-party GPL-3.0, AGPL and LGPL in core because they are compatible with the AGPL
* `pnpm licenses list` piped into an allow-list script
* An off-the-shelf license checker as the gate
* GitHub's dependency-review-action or the OSS Review Toolkit (ORT) as the gate

## Decision outcome

Chosen option: "A gate script over `pnpm sbom` output with a policy per package class, denying third-party GPL-family licenses in core", because `pnpm sbom` listed every component of the release 1 set, Linux binaries included, and kept non-SPDX license names visible, so a script that accepts only allowed SPDX ids catches every case the audit found. Denying the GPL family in core is the working policy until the lawyer gives a view.

### Policy per package class

| Class | Applies to | Allowed | Allowed with a recorded note | Denied |
|---|---|---|---|---|
| Core | AGPL packages; everything in the server image or the browser bundle | MIT, MIT-0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, Apache-2.0, Zlib, Unlicense, CC0-1.0, BlueOak-1.0.0, Python-2.0 | MPL-2.0 for unmodified files; CC-BY-4.0 for data | GPL-2.0-only; third-party GPL-3.0, AGPL and LGPL; Elastic-2.0, SSPL, BUSL, FSL, RSAL, Commons Clause, PolyForm; custom licenses, `UNLICENSED`, "SEE LICENSE IN" and missing licenses |
| MIT packages | `dependencies` and `peerDependencies` of the MIT packages | MIT, MIT-0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, Apache-2.0, Zlib, Unlicense, CC0-1.0, BlueOak-1.0.0 | none | everything else, and any workspace dependency on an AGPL package |
| Dev only | `devDependencies`, CI tools, test images | any OSI-approved license | named, reviewed exceptions for tools that never ship | the rest |

An `OR` expression passes when one branch passes; an `AND` expression passes when every part passes. Each package's own `license` field selects its class, so every workspace package sets one.

### The gate

* `license gate` in `supply-chain.yml` is a required check from the first commit ([ADR 0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md)).
* Steps: `pnpm install --frozen-lockfile` with `supportedArchitectures` for linux x64 and arm64, glibc and musl, so native binaries that ship in images are in the tree; then `pnpm sbom --sbom-format cyclonedx --sbom-type application --prod --split`; then `scripts/license-gate.mjs`, which applies the policy per package and writes a Markdown summary to the job.
* A non-SPDX name passes only when `license-clarifications.json` maps that exact `name@version` to an SPDX id after a person read the license file. Reviewed exceptions live in `license-exceptions.json` with a reason.
* The gate also scans installed packages for `ee/` folders and "Enterprise" license files, which SPDX fields miss.
* On pull requests, Socket checks new dependencies, and dependency-review-action with the same allow list adds a readable comment once GitHub's dependency graph reads the lockfile.

### Never installed

| Package | Reason | Instead |
|---|---|---|
| `@graphql-yoga/nestjs-federation`, `@apollo/gateway` | Elastic-2.0 Apollo packages | `@apollo/subgraph` and Hive Gateway ([ADR 0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md)) |
| `exceljs` | pulls a package with no license | papaparse for CSV |
| npm `xlsx` | stale and vulnerable | SheetJS from its CDN tarball 0.20.3, only if Excel is ever needed |
| `@sentry/node` 11 in the server | puts the FSL-licensed Sentry CLI into production installs | decided with error telemetry ([ADR 0052](0052-error-telemetry-opt-in-and-deferred.md)) |
| Mastra | source-available `ee/` code | the Vercel AI SDK ([ADR 0035](0035-ai-provider-port-with-customer-configured-providers.md)) |
| MinIO | the community edition is archived and ships no images | S3-compatible drivers tested against SeaweedFS ([ADR 0054](0054-file-storage-port-with-a-postgres-driver.md)) |
| Redis 8 | licensed RSALv2, SSPLv1 or AGPLv3 | Valkey, if a cache ever arrives |
| `@better-auth/cli`, `@base-ui-components/react` | replaced | `auth`, `@base-ui/react` |

react-doctor is a dev tool under a modified MIT license that restricts some AI-related uses. It runs in CI only, as a reviewed exception, and the project asks its vendor for written confirmation that running it in agent workflows is allowed.

The exception covers `react-doctor` and `oxlint-plugin-react-doctor`, which ships the same license text; both declare "SEE LICENSE IN LICENSE". The license file of version 0.9.14 was read on 2026-10-08. It is the MIT text plus two uses that need the copyright holder's prior written permission: using the software or its source as training, fine-tuning or evaluation data, or as input to an automated pipeline that trains or improves a machine learning model or AI system; and selling it, or offering it to third parties as a paid, hosted or managed product whose value derives entirely or substantially from it.

The catalog pins one exact version, and only the private root package takes it, as a dev dependency. No published `@northmes/*` package lists it ([ADR 0020](0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md)), so it never enters an image or the browser bundle. A new version needs its license file read again, because the exception covers the text a person read.

### The database image

The class table has no row for the database image `ghcr.io/northmes/postgres` ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)). It is a separate image whose Postgres process loads extensions and talks to NorthMES over SQL, and in release 1 it holds Postgres (PostgreSQL License), pgBackRest (MIT) and their OS packages. Two rules hold until a class is recorded:

* No component under the Timescale License enters the database image or any other NorthMES artifact ([ADR 0059](0059-time-series-storage-port-with-an-open-default-backend.md)).
* No AGPL component enters the database image. `citus_columnar` (AGPL-3.0), an optional Data collection adapter that ADR 0059 proposes, would be the first. The class for the database image needs a recorded decision before that adapter is built, and that decision is part of the GPL-family question under legal review.

### SBOMs and notices

* One CycloneDX SBOM per workspace package and one per image that includes OS packages, attached to each GitHub release and copied into the image under `/usr/share/northmes/` ([ADR 0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md)).
* `THIRD_PARTY_NOTICES.txt` is generated at build time from the production dependencies of the server and the web app, including Apache NOTICE contents. It is copied into the image and served by the web app, because the browser bundle is distributed too.

### Consequences

* Good, because restricted licenses deep in a transitive tree fail the pull request that adds them, including one written by a coding agent.
* Good, because the MIT packages cannot pick up copyleft or AGPL code.
* Good, because each release carries SBOMs a customer can read without asking.
* Bad, because the GPL-family denial excludes libraries that are license-compatible with the AGPL.
* Bad, because every non-SPDX license name needs a person to read the file once per version.
* Neutral, because the GPL-family rule may loosen after the lawyer's view, which changes one table row and the script's policy.

### Confirmation

* `license-gate.test.ts` (proposed name) runs the script on fixture SBOMs: an Elastic-2.0 component under a core package fails and names the package; "SEE LICENSE IN LICENSE" fails until `license-clarifications.json` maps that exact version; an MPL-2.0 dependency fails under an MIT package and passes with a note under a core package; `(MIT OR GPL-3.0-or-later)` and `MIT AND Zlib` pass under core; a missing license fails; a package with an `ee/` folder fails.
* The gate fails when the lockfile resolves any package from the never-installed table.
* The gate fails when the database image's SBOM lists a component under the Timescale License, or an AGPL component while the image has no recorded class.
* Every workspace package has a `license` field, and an MIT package that imports an AGPL package fails the import check ([ADR 0003](0003-module-package-shape-and-the-definemodule-manifest.md)).
* Image content test: `/usr/share/northmes/` holds the package and image SBOMs, and `THIRD_PARTY_NOTICES.txt` is present and served by the web app.
* The release workflow attaches the per-package SBOMs and the image SBOM to the release before it is published.

## Pros and cons of the options

### Gate over `pnpm sbom` with GPL-family denial in core

* Good, because `pnpm sbom` produced 615 components for the release 1 set, all with license data, and kept unusual names visible.
* Good, because the policy keeps every core dependency one the extension exception can sit beside.
* Bad, because the project maintains a script of about 100 lines.

### The same gate, allowing the GPL family in core

* Good, because more libraries become usable.
* Bad, because the copyright holder cannot relicense third-party GPL code, and a plugin loaded in the same process would combine with code whose authors gave no extension permission.

### `pnpm licenses list` with an allow-list script

* Good, because it is built into pnpm.
* Bad, because it reported a modified license as MIT and lists only packages for the current platform.

### An off-the-shelf checker

* Good, because there is no own script.
* Bad, because `@onebeyond/license-checker` scanned only direct dependencies and missed five Elastic-2.0 packages, and `cyclonedx-npm` failed on the pnpm layout. `license-checker-rseidelsohn` works but stops at the first offender; it stays a second opinion.

### dependency-review-action or ORT

* Good, because dependency-review-action gives a readable pull request comment, and ORT covers analysis, policy and notices.
* Bad, because GitHub's dependency graph can read a pnpm 12 lockfile as zero dependencies, and ORT is more machinery than one developer needs now.

## More information

* Related ADRs: [0003](0003-module-package-shape-and-the-definemodule-manifest.md), [0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md) database image, [0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md), [0035](0035-ai-provider-port-with-customer-configured-providers.md), [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md), [0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md), [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md), [0052](0052-error-telemetry-opt-in-and-deferred.md), [0054](0054-file-storage-port-with-a-postgres-driver.md), [0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md), [0059](0059-time-series-storage-port-with-an-open-default-backend.md) time-series storage and the optional `citus_columnar` adapter.
* Plan: [12-operations-and-security.md](../plan/12-operations-and-security.md#license-gate), [13-delivery-and-github.md](../plan/13-delivery-and-github.md#ci).
* pnpm sbom: https://pnpm.io/cli/sbom. CycloneDX: https://cyclonedx.org/. FSF license list: https://www.gnu.org/licenses/license-list.html. dependency-review-action: https://github.com/actions/dependency-review-action.
* Revisit when the lawyer gives a view on the GPL family in core, when `citus_columnar` enters the database image ([ADR 0059](0059-time-series-storage-port-with-an-open-default-backend.md)), and when Excel import is needed.
