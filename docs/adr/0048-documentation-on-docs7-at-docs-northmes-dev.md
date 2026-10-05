---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 14 and 25
informed: contributors, coding agents, pilot users and plugin developers
release: "1"
needs-confirmation: "maintainer (docs content license)"
---

# Documentation on Docs7 at docs.northmes.dev

## Context and problem statement

Krister Johansson decided that everything public lives under northmes.dev, that docs.northmes.dev is the Docs7 docs site, that northmes.dev becomes the landing page later, and that the project uses a fixed set of mail addresses under northmes.dev. Docs7 is a hosted docs platform from the Context7 team at Upstash. It reads a Mintlify project (`docs.json`, MDX, snippets, OpenAPI files), publishes a site for people plus agent formats such as `/llms.txt` and per-page Markdown, and refreshes the site's Context7 library on each production build.

Research found three limits (internal research note 14). Docs7 runs no build step, so generated pages must be committed. In a local test of its renderer, the `graphql` and `sdk` reference properties of Mintlify's format generated no pages. Files in the docs folder that navigation does not list still became routable URLs. The renderer is closed source and young, so the format must stay portable.

This ADR records where the site lives, which format it uses, what is generated in release 1, the public names and the contact addresses. It covers `apps/docs`, `context7.json`, the `ci / docs` job and the community files that name an address.

## Decision drivers

* docs.northmes.dev on Docs7; public names and mail addresses under northmes.dev.
* Plan files, ADR drafts and internal notes in `docs/` must never become public URLs.
* The format must move to another host without a rewrite.
* Generated reference pages must not go stale.
* One developer writes the docs, so release 1 generates only what is cheap.
* Coding agents read the docs through Context7.

## Considered options

* Docs7 reading `apps/docs`, a portable Mintlify subset, and committed generated pages
* Docs7 reading `docs/`
* Mintlify as the host

## Decision outcome

Chosen option: "Docs7 reading `apps/docs`, a portable Mintlify subset, and committed generated pages", because it follows Krister Johansson's decision, keeps internal files off the site, and keeps Mintlify open as a fallback host.

### The site

* The site lives in `apps/docs` and is a GitHub-connected Docs7 site at docs.northmes.dev. Previews run locally with `docs7 dev`.
* Pages use a portable Mintlify subset: plain Markdown plus Card, Steps, Tabs, CodeGroup, callouts, ParamField, ResponseField and Update. No Docs7-only configuration field is used except `filterSidebar`. Mintlify stays the fallback host.
* All generated MDX is committed. Generators write deterministic output (sorted keys, no timestamps, no commit hashes) and a navigation fragment per section that `docs.json` includes with `$ref`. `pnpm gen` runs reference docs last ([ADR 0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md)).
* Release 1 generates two references: the configuration reference from the Zod configuration schema, and the permissions and roles reference from the module manifests ([ADR 0003](0003-module-package-shape-and-the-definemodule-manifest.md)). The GraphQL reference (an in-house `graphql-js` script per subgraph), the SDK reference and the MCP tool reference land with the surfaces they document.
* Hand-written release 1 pages include the install guide (Compose install, backup and restore, upgrade, production checklist) and the planner and operator guides. Upgrade steps for a breaking change are written in the pull request that makes it ([ADR 0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md)).
* Module pages live in `apps/docs/modules/<id>/` until external plugins exist.
* No versioned docs before 2.0.
* `context7.json` points the Context7 library at `apps/docs` and excludes `docs/`, `.claude` and the root rule files.
* ADRs and the plan stay in `docs/` in the repository and are not part of the site.

### Public names

Everything public lives under northmes.dev: docs.northmes.dev for the docs, northmes.dev for a later landing page, and further subdomains for a demo or a telemetry receiver when they exist.

### Mail addresses

| Address | Use |
|---|---|
| security@northmes.dev | Vulnerability reports, named in `SECURITY.md` |
| conduct@northmes.dev | Code of conduct reports |
| legal@northmes.dev | Contributor license agreement, license and trademark questions |
| privacy@northmes.dev | Personal data requests |
| support@northmes.dev | Pilot support |
| krister@northmes.dev | The maintainer |

### Still open

* The license of the documentation content (maintainer).
* Docs7's default `Content-Signal: ai-train=yes` in the generated `robots.txt` (maintainer).
* The CAA record under northmes.dev allows only `pki.goog` today and may need an entry for the certificate authority Docs7 uses.

Docs7's defaults apply until these are decided, and they are decided before the site goes live.

### Consequences

* Good, because the same folder serves people, `llms.txt` readers and Context7 without a separate publishing step.
* Good, because a stale generated page fails CI instead of reaching readers.
* Good, because the portable subset keeps the exit to Mintlify a hosting change, not a rewrite.
* Bad, because Docs7's renderer is closed and young; a regression there is outside the project's control.
* Bad, because GraphQL and SDK reference pages need in-house generators instead of the host's built-in ones.
* Bad, because module docs live in the site folder, not next to each module, until external plugins exist.

### Confirmation

* `ci / docs` on pull requests and pushes to `main`: `pnpm docs:generate`, then `git diff --exit-code -- apps/docs` and `git status --porcelain apps/docs`; any diff or untracked file fails.
* Generator tests: running `pnpm docs:generate` twice gives no diff; the configuration reference lists every key of the Zod configuration schema; the permissions reference lists every permission that a module manifest declares.
* Docs format lint: an MDX file under `apps/docs` that uses a component outside the portable subset fails; a `docs.json` with a Docs7-only field other than `filterSidebar`, or with `navigation.versions`, fails.
* Context7 config test: `context7.json` names `apps/docs` and excludes `docs/`.
* Contact address meta test: `SECURITY.md` names security@northmes.dev, `CODE_OF_CONDUCT.md` names conduct@northmes.dev, and every `@northmes.dev` address in tracked files is one of the six above.

## Pros and cons of the options

### Docs7 reading `apps/docs`

* Good, because only files meant for readers are in the folder Docs7 publishes.
* Bad, because module and reference pages are copied or generated into one folder.

### Docs7 reading `docs/`

* Good, because there is one docs folder in the repository.
* Bad, because files that navigation does not list still become routable URLs (internal research note 14), so internal files would be published.

### Mintlify as the host

* Good, because Mintlify generates GraphQL and SDK reference pages from SDL and TypeDoc output.
* Bad, because Krister Johansson's decision names Docs7, the `mint` CLI is under the Elastic License 2.0, and self-hosting or offline export needs Mintlify's Enterprise plan (internal research note 14).

## More information

* Related ADRs: [0001](0001-record-architecture-decisions-in-madr.md) ADRs in `docs/adr`, [0003](0003-module-package-shape-and-the-definemodule-manifest.md) manifests, [0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md) `pnpm gen` order, [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) releases and upgrade notes, [0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md) docs per task and per epic, [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) community files, [0051](0051-regulated-readiness-no-regret-rules.md) `SECURITY.md`, [0052](0052-error-telemetry-opt-in-and-deferred.md) a later telemetry receiver.
* Plan: [13 delivery and GitHub](../plan/13-delivery-and-github.md) (documentation site, community files and contact addresses), [12 operations and security](../plan/12-operations-and-security.md) (security reporting), [01 product and scope](../plan/01-product-and-scope.md) (what done means for release 1), [16 open questions](../plan/16-open-questions.md).
* Docs7 documentation: https://context7.com/docs7/overview
* Mintlify navigation format: https://www.mintlify.com/docs/organize/navigation
* Revisit when the docs content license is chosen, when NorthMES 2.0 needs versioned docs, when external plugins ship their own docs, or if Docs7 stops serving the site.
