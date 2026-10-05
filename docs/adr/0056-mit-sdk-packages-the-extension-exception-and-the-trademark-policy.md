---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 08, 12, 13, 20, 25, 32 and 33
informed: plugin developers, hosting partners, contributors and coding agents
release: "1"
needs-confirmation: "lawyer"
---

# MIT SDK packages, the extension exception and the trademark policy

## Context and problem statement

NorthMES core is licensed AGPL-3.0-or-later, and contributions come in under a contributor license agreement ([ADR 0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md)). Plugins are drop-in packages that run in the same Node process as core and render in the same browser page; a site may also build them into an image `FROM` the NorthMES image ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)). The FSF's reading is that a plugin which shares function calls and data structures with its host in one process forms one combined program with it. Krister Johansson decided that an extension exception, MIT SDK packages and a trademark policy are proposed, pending legal review.

The AGPL forbids closing the code, not selling it: a rebranded copy sold with its source is allowed, and only a trademark protects the name. This ADR decides which packages are MIT, which way imports may point, the structure of the exception text in `LICENSE`, how code moves between the two licenses, and what the trademark policy says. It covers every package under `packages/` and `modules/*/contracts`, `LICENSE`, `NOTICE` and a later `TRADEMARKS.md`.

## Decision drivers

* A plugin author chooses the plugin's own license, and the plugin's source tree should import no AGPL package.
* An MIT SDK keeps AGPL out of the plugin's source tree but does not cover the combination at run time; only a permission from the copyright holder does.
* The permission must hold for in-process loading and for build-time bundling into a site image, not only for separately distributed plugins.
* Only a copyright holder can grant such a permission, so it covers only code that holder owns or holds a CLA grant for.
* Because every contribution comes under the CLA, the exception text and the package licenses can still change before the SDK is announced.

## Considered options

* MIT SDK packages, an additional permission under AGPLv3 section 7 (the extension exception) and a trademark policy
* AGPL for everything, plugins included, with no exception
* MIT SDK packages without an exception
* An exception that declares plugins "not derivative works"

## Decision outcome

Chosen option: "MIT SDK packages, an additional permission under AGPLv3 section 7 and a trademark policy", because the MIT packages keep AGPL out of plugin source, the permission covers the combination at run time and in a site image, and the trademark policy protects the name, which the license cannot. The structure follows Twenty's Application Exception (MIT SDK and UI packages next to an AGPLv3 core).

The MIT package set:

* `@northmes/contracts`, every `@northmes/<id>-contracts`, `@northmes/sdk`, `@northmes/web-sdk`, `@northmes/ui`, `@northmes/web-build`, `@northmes/testing` and the generator package.
* Each has its own `LICENSE` file and `"license": "MIT"` in `package.json`. Their dependencies and peer dependencies carry permissive licenses only, under the MIT package policy of the license gate ([ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md)).
* Dependencies point down from `@northmes/contracts`. No MIT package imports from `modules/*`, `apps/*` or any AGPL package. The SDK declares and the AGPL host runs: the command bus, the audit writer, the gateway, the job runner, the MCP tool runner and the `ai` module are AGPL code behind MIT declarations.
* Plugins import only MIT packages. Reusable test helpers live in `@northmes/testing`, so plugin test files never import AGPL code either.
* `@northmes/ui` takes no AGPL-only third-party dependency, so the board parts it may expose to plugins stay MIT.
* Generated code in the MIT packages (types generated from the core schema) is MIT because the CLA covers what it is generated from.
* Moving a helper from an AGPL package to an MIT one later is a relicensing step under the CLA, done only for code the copyright holder owns or holds a grant for.

The extension exception, a draft at the top of `LICENSE`, titled as an additional permission under AGPLv3 section 7:

* Defines the interfaces it covers: the MIT packages above, the `defineModule` manifest format, the declared extension points (command validators, UI slots, events, later ports), and the public GraphQL and MCP interfaces, with the later REST, Events API and webhook interfaces when they exist.
* Grants permission to combine a plugin that uses only those interfaces with NorthMES, to convey the combination in object code (for example a site image built `FROM` the NorthMES image), and to let users interact with it over a network, without the AGPL applying to the plugin.
* A bundling clause: combining through the official build tooling (`@northmes/web-build` and the plugin build path) does not extend the AGPL to the plugin.
* States that a plugin is not part of NorthMES's Corresponding Source.
* Limits: modified NorthMES stays under the AGPL, section 13 included; ejected components, forked modules and copied core code are core code and stay AGPL; the exception grants no trademark rights.
* Applies under AGPLv3 or any later version the recipient chooses, because the license is "or later".
* Names one grantor, the same party as the CLA counterparty.
* `NOTICE` names NorthMES, the copyright holder and the exception.
* Third-party GPL-3.0, AGPL and LGPL code is denied in core ([ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md)), because a plugin would also combine with that code and its authors gave no permission.
* The text is a draft until legal review, which happens before the SDK is announced to third parties.

The trademark policy, in `TRADEMARKS.md`:

* Allowed without asking: self-hosting NorthMES, saying a product is built on NorthMES, and naming a plugin or service "X for NorthMES".
* Needs permission: using the name in a company, product or domain name, or anything that implies an official offering.
* A fork that changes core takes another name.
* AGPLv3 section 7(e) allows declining trademark rights, so the policy and the license agree. A partner program follows the policy.

### Consequences

* Good, because a plugin author can build, test and ship a plugin that imports only MIT code, under a license of their choice.
* Good, because the permission is explicit, so nobody has to argue whether an in-process plugin is a derivative work.
* Good, because the name stays with the project while the code stays free to fork under the AGPL.
* Bad, because the license boundary runs through the monorepo, so every package needs its own license field, gate policy and import check.
* Bad, because the exception covers only code the copyright holder owns, which rules out third-party copyleft code in core for good.
* Neutral, because the exception text can change until legal review; the package set and the import rule hold either way.

### Confirmation

* An import rule (Biome restricted imports plus a CI check) fails when a package whose `license` is MIT imports from `modules/*`, `apps/*` or any package whose `license` is AGPL.
* The license gate applies the MIT package policy to every package whose `license` field is MIT ([ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md)).
* A meta test `test/meta/licenses.test.ts` asserts that the set of MIT packages equals the list in this ADR, that each has a `LICENSE` file with the MIT text, that `LICENSE` at the root holds the AGPL text with the exception's heading, and that `NOTICE` names the exception.
* The `plugin-outside` CI job packs the MIT packages, installs an example plugin from the tarballs outside the repository, builds it, drops it into a plugins directory, boots and runs its e2e spec, which shows a plugin needs no AGPL package to build.
* Before the SDK is announced to third parties, this ADR moves to accepted with the reviewed exception text; until then the docs call the exception a draft.

## Pros and cons of the options

### MIT packages, the section 7 permission and a trademark policy

* Good, because it covers both the plugin's source and the running combination, including site images.
* Bad, because the exception needs careful drafting and legal review before third parties rely on it.

### AGPL for everything

* Good, because the license is simple and every plugin stays open source.
* Bad, because customers and partners with closed plugins are excluded, and plugin authors import AGPL code into their own source.

### MIT packages without an exception

* Good, because no custom license text is needed.
* Bad, because the plugin still runs inside AGPL core in one process, so the combination stays unresolved.

### "Not derivative works" wording

* Good, because it is short.
* Bad, because whether something is a derivative work is decided by copyright law, not by the licensor, and the wording says nothing about bundling, images or network use.

## More information

* Related ADRs: [0003](0003-module-package-shape-and-the-definemodule-manifest.md), [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md), [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md), [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) (API reports for MIT packages), [0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md), [0040](0040-dependency-license-policy-ci-gate-and-sbom.md), [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md).
* Plan: [03 modules and extensibility, shared packages and the license boundary](../plan/03-modules-and-extensibility.md#shared-packages-and-the-license-boundary), [13 delivery and GitHub, community files](../plan/13-delivery-and-github.md#community-files-and-contact-addresses).
* GNU AGPLv3: https://www.gnu.org/licenses/agpl-3.0.html. GPL FAQ on plugins: https://www.gnu.org/licenses/gpl-faq.html#GPLPlugins. GPL FAQ on linking over a controlled interface: https://www.gnu.org/licenses/gpl-faq.html#LinkingOverControlledInterface.
* Revisit after legal review, before the SDK is published to npm after the pilot, and when a partner program is set up.
