---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 12 and 25
informed: contributors, plugin authors, hosting partners and coding agents
release: "1"
needs-confirmation: "lawyer (license file and CLA text)"
---

# License: AGPL-3.0-or-later core and a contributor license agreement

## Context and problem statement

NorthMES is an open source, developer-first MES in one public monorepo. Krister Johansson decided that core is licensed AGPL-3.0-or-later and that contributions come in under a contributor license agreement (CLA). Flexmatic, Krister Johansson's business, holds the copyright.

Three related parts of the licensing model are still proposed and wait for legal review: MIT licenses for the SDK and contracts packages, an extension exception in `LICENSE` for plugins, and a trademark policy. They are decided separately in [ADR 0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md), so this ADR holds only what is accepted.

This ADR covers the license files at the repository root, the SPDX headers and `license` fields of every workspace package, the About page, the individual and corporate CLA texts, the public record of signatures and the CI check that enforces the CLA. The dependency license policy is in [ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md).

## Decision drivers

* Krister Johansson's decision: AGPL-3.0-or-later core and a CLA.
* Anyone who runs a modified NorthMES for users over a network must offer those users the source of that version (AGPL section 13), hosting partners included.
* The copyright holder must be able to move contributed code into MIT packages, change the extension exception, and offer NorthMES code under other terms. The Developer Certificate of Origin only certifies that a contributor may submit under the project's own license.
* Code a contributor writes at work may belong to the employer, who must then sign.
* Tools must read the license of every package from the first commit (the license gate, the SBOM).
* The public signature record holds no personal data beyond a GitHub account id.
* The CLA check must not run pull request code with a token that can write.

## Considered options

* AGPL-3.0-or-later core with an Apache-style CLA grant, a corporate CLA and a self-hosted check
* AGPL-3.0-or-later core with the Developer Certificate of Origin
* AGPL-3.0-or-later core with a CLA that assigns copyright
* AGPL-3.0-or-later core with a CLA through a hosted service or an existing CLA action

## Decision outcome

Chosen option: "AGPL-3.0-or-later core with an Apache-style CLA grant, a corporate CLA and a self-hosted check", because a license grant keeps open the options listed in the decision drivers without asking contributors to give up their copyright, and the hosted and packaged CLA tools were down or archived when checked on 2026-10-04 (internal research note 12).

### License files and metadata

* `LICENSE` holds the AGPL-3.0-or-later text. The draft extension exception sits in the same file and is governed by [ADR 0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md).
* `NOTICE` names NorthMES, the copyright holder and the extension exception.
* `LICENSE`, `NOTICE` and SPDX headers ship from the first commit. Source files in AGPL packages carry `SPDX-License-Identifier: AGPL-3.0-or-later`.
* Every workspace package sets its `license` field. AGPL-3.0-or-later applies to `apps/server`, `apps/web`, every module's server part and remote, and `@northmes/planning-domain` ([03-modules-and-extensibility.md](../plan/03-modules-and-extensibility.md#shared-packages-and-the-license-boundary)).
* The web app has an About page that shows the running version, the license and a link to the source of that exact version. The link is a setting, so a partner that modifies core points it to its own source (AGPL section 13).
* The AGPL forbids closing the code, not selling it. A renamed copy sold with its source is allowed; only the trademark policy protects the name ([ADR 0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md)).

### The contributor license agreement

* `CLA.md` is the individual agreement and `CLA-corporate.md` the corporate one. Each has a version number that signatures refer to.
* The individual agreement is a license grant, not an assignment, modeled on the Apache Individual CLA: a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare derivative works of, publicly display, publicly perform, sublicense and distribute, plus a patent license.
* It adds a promise modeled on the Harmony agreements' "Option Five": each contribution stays available under AGPL-3.0-or-later, or under MIT for code in MIT packages.
* The counterparty is "Krister Johansson trading as Flexmatic and their successors and assigns", with the right to sublicense and to transfer the agreement, so the grants follow the NorthMES business if its owner changes.
* The corporate agreement covers contributors whose employer owns their work.
* Both texts are drafts until a lawyer has reviewed them. They exist, together with the check below, before the repository accepts its first outside pull request.

### Signatures and the CLA check

* `.github/cla/signed.json` lists GitHub numeric user ids (stable across renames), the CLA version and the date. It holds no names. Names, the URL of the signing comment and corporate agreements are kept in a private record outside the public repository. The copyright holder's organisation number appears nowhere in the repository.
* `ci / cla` runs on `pull_request` with a read-only token and no checkout. It reads `signed.json` from the base branch through the GitHub API, never from the pull request's merge commit, so a pull request cannot sign for itself. It checks the pull request author and the author of every commit; a commit without a linked GitHub account fails. The maintainer, `renovate[bot]` and release pull requests pass.
* On failure the check prints how to sign: post the sentence from `CLA.md` as a pull request comment. The maintainer records the signature in the private record and in `signed.json` through a normal pull request, then re-runs the check.
* When outside pull requests become frequent, a fork of the archived CLA Assistant Lite action (Apache-2.0) on `issue_comment`, with a GitHub App token that can write only the signature location, automates the recording.
* No workflow uses `pull_request_target`, and cla-assistant.io is not used.
* `ci / cla` joins `ci / gate` before the first outside pull request ([ADR 0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md)).

### Consequences

* Good, because a partner or host that modifies NorthMES and runs it for users must offer those users the source of its changes.
* Good, because the grant lets helpers move from AGPL to MIT packages later, as a relicensing step under the CLA, and lets the extension exception change for all code.
* Good, because a pull request cannot add its own author to the signature list.
* Good, because the public record contains account ids only.
* Bad, because every outside contributor signs before the first merge, which a DCO sign-off does not need.
* Bad, because signatures are recorded by hand until the automation exists.
* Neutral, because the license file and the CLA texts may still change after legal review; all code so far is the copyright holder's and later contributions come under the CLA, so the texts and the exception can still change.

### Confirmation

* License field test: every workspace package has a `license` field, and every package under `apps/` and every module server part, remote and `@northmes/planning-domain` declares `AGPL-3.0-or-later` ([ADR 0003](0003-module-package-shape-and-the-definemodule-manifest.md)).
* SPDX header check in `ci / lint + typecheck + build`: every non-generated `.ts` and `.tsx` source file starts with an SPDX identifier equal to its package's `license` field.
* Image content test: `LICENSE` and `NOTICE` are present in the image.
* About page Playwright spec: the page shows the running version, `AGPL-3.0-or-later` and a source link to tag `v<version>`; with the source URL setting changed, the link follows the setting.
* `ci / cla` script tests against recorded API responses: an unsigned author fails; a signed author passes; a pull request that adds its own author to `signed.json` still fails; a commit without a GitHub account fails; `renovate[bot]` passes.
* A workflow lint fails on any `pull_request_target` trigger.
* The fixture lint fails on the organisation number pattern `\d{6}-\d{4}` ([11-quality-and-testing.md](../plan/11-quality-and-testing.md#lints-and-meta-tests)).

## Pros and cons of the options

### Apache-style CLA grant, corporate CLA and a self-hosted check

* Good, because the grant is broad enough to sublicense and relicense, while contributors keep their copyright.
* Good, because the check depends on no outside service.
* Bad, because the project maintains a small workflow and records signatures by hand at first.

### Developer Certificate of Origin

* Good, because contributors only add a sign-off line, and no record is kept.
* Bad, because the project then holds contributed code under the AGPL like everyone else, so it cannot move that code into MIT packages, change the extension exception for it, or offer it under other terms.

### A CLA that assigns copyright

* Good, because the holder owns every contribution outright.
* Bad, because copyright assignment is not possible in every jurisdiction, and a grant already covers what the project needs.

### A hosted CLA service or an existing CLA action

* Good, because there is no workflow to maintain.
* Bad, because cla-assistant.io answered HTTP 503 on 2026-10-04 (its home page answered again later that day), its repository's last commit was in October 2023 and recent issues report signing bugs, and CLA Assistant Lite and `finos/cla-bot` are archived.

## More information

* Related ADRs: [0003](0003-module-package-shape-and-the-definemodule-manifest.md) package shape and `license` fields, [0040](0040-dependency-license-policy-ci-gate-and-sbom.md) dependency license policy, [0048](0048-documentation-on-docs7-at-docs-northmes-dev.md) documentation site, [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) repository rules and CI, [0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md) MIT packages, extension exception and trademark policy.
* Plan: [13-delivery-and-github.md](../plan/13-delivery-and-github.md#community-files-and-contact-addresses), [12-operations-and-security.md](../plan/12-operations-and-security.md#license-gate), [01-product-and-scope.md](../plan/01-product-and-scope.md). License and CLA questions go to legal@northmes.dev.
* GNU AGPL v3: https://www.gnu.org/licenses/agpl-3.0.html. SPDX identifier: https://spdx.org/licenses/AGPL-3.0-or-later.html. Developer Certificate of Origin: https://developercertificate.org/. Harmony agreements: https://www.harmonyagreements.org/.
* Revisit when the legal review of the license file and the CLA texts returns, before the first outside pull request, and if the copyright holder changes.
