---
status: "accepted"
date: 2026-10-27
decision-makers: Krister Johansson
consulted: Krister Johansson
informed: contributors, coding agents, plugin developers and integrators
release: "1"
needs-confirmation: ""
---

# Developer documentation kept current with a Docs section per pull request, generated references and executable examples

## Context and problem statement

NorthMES generates its GraphQL schema (`schema/api.graphql`) and its OpenAPI document (`schema/openapi-v1.json`) from the code, `pnpm gen --check` fails when either is stale, and the `openapi diff` job fails a breaking REST change whose title has no `!` ([ADR 0064](0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md)). Nothing checks the prose. The docs site has one hand-written developer page, the GraphQL API page, and no page on REST, events, the SDK or plugin development. [ADR 0048](0048-documentation-on-docs7-at-docs-northmes-dev.md) decided a `ci / docs` job, generated configuration and permissions references and generators for the GraphQL, SDK and MCP references, and [ADR 0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) decided API Extractor reports per MIT package; neither is built. [ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md) says that generated and module docs are updated in each task and extension point docs in the task that changes the extension point, and no check or review step reads that rule. The screenshots in `apps/docs/images` are written by `pnpm docs:screenshots` from the seeded demo data when someone starts the workflow by hand; in every other run the spec only checks that the pages render, so a screen change leaves an old picture without a failure.

Every code change arrives in a pull request that a coding agent session opens. A study of 29,669 AI-generated pull requests found that 63.2% change code without touching any documentation (55.2% of feature changes, 77.5% of refactors), and that a file changed without docs is re-documented within 90 days at half the rate of one changed with docs (De Michele and Tantithamthavorn, 2026). A controlled test across seven language models found that detection of a contradiction between documentation and implementation falls by 21 to 43 percentage points when only the implementation changed and the documentation text stayed as it was (Ulfat, Sabit and Hossain, 2026), which is what a stale page looks like in a diff review, and a plain consistency prompt flagged over 90% of functions until the check was scoped (Xu, Wahab, Holmes and Lemieux, 2026). Large projects warn rather than block: GitLab's Danger rule warns when a feature merge request has no doc change and its technical writer review is non-blocking, and Django's reviewer checklist asks for a release note and a version marker on each new feature. Both rely on a person reading the warning.

This ADR decides who the developer documentation is for, how the Build on NorthMES tab is structured, which facts are generated and which are written, how a pull request shows its docs change, what the review before the pull request reads, which checks run on the docs, and how the screenshots are kept current. It covers `apps/docs`, `examples/`, the pull request template, `scripts/ci/`, `.claude/agents/code-reviewer.md` and the docs stages of `pnpm gen`.

## Decision drivers

* Every pull request is agent-written, so a rule without a check is skipped most of the time.
* One maintainer writes and reviews, so each check must be cheap to keep and must not flood with false findings.
* Coding agents read the site through Context7, and plugin developers read it before they read the code.
* A fact that lives in code appears on the site from the code, never retyped.
* Plan 01: a developer or a coding agent runs, tests and extends NorthMES without reading core code, and each extension point ships with a recipe.
* ADR 0048: Docs7 publishes every file in `apps/docs`, so a placeholder page is a public page.

## Considered options

* A Docs section per pull request checked in CI, the review step reading the mapped pages, generated references, executable examples and screenshots per release
* An agent review of the diff for documentation drift, with no check on the pull request body
* A warning on the pull request when a feature changes no docs, after GitLab's Danger rule
* A freshness bot that flags pages by days since their last edit

## Decision outcome

Chosen option: "A Docs section per pull request checked in CI, the review step reading the mapped pages, generated references, executable examples and screenshots per release", because the check is what makes the rule hold for agent-written pull requests, the mapping is what lets an agent review see the page the diff made stale, and generated references and executable examples leave the hand-written pages with intent and steps rather than values that drift.

### Audiences and the Build on NorthMES tab

Three audiences read the developer documentation. Integrators call the public REST API under `/api/v1` with an integration token, later with OAuth client credentials, and later consume the events; they reach no GraphQL field and no MCP tool, because GraphQL and the tools act for people ([ADR 0073](0073-one-module-contract-for-rest-webmcp-and-later-mcp-with-oauth-clients-and-tokens.md)). Plugin developers build on the MIT packages ([ADR 0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md)), call GraphQL from their screens through the web SDK, and use the extension points ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md), [ADR 0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md), [ADR 0075](0075-plugin-installs-from-signed-archives-into-a-plugin-volume-with-plugin-screens-loaded-at-run-time.md)). Contributors and coding agents work in the repository, where `AGENTS.md`, the ADRs, `GLOSSARY.md`, `docs/agents/` and the project skills describe the work; those stay in the repository and off the site ([ADR 0048](0048-documentation-on-docs7-at-docs-northmes-dev.md)).

The site keeps the Run NorthMES tab (install and upgrade, plugins for operators, the use guides). The Build on NorthMES tab grows from its one API page into these groups. A page is added when its surface ships, never as a placeholder.

| Group | Pages |
|---|---|
| Overview | What you can build; the trust model (a plugin runs with full access, ADR 0037); licenses (the AGPL core, the MIT SDK packages, the draft extension exception); versions and compatibility (ADR 0038) |
| How NorthMES works | One page with a diagram: one backend process serving GraphQL and REST, the static web app, the workers, Postgres with row-level security, the outbox and the event tail, modules and manifests. It links to the ADRs for the reasons and repeats none of them |
| Integrate | Authentication (integration tokens for REST, OAuth later, and the web app's JWT that GraphQL accepts); REST API conventions; GraphQL API conventions for plugin screens (today's page, with its schema section moved to the reference); events and subscriptions; errors |
| Extend | The plugin package shape and the manifest; Your first plugin, a tutorial built on `examples/plugin-sidebar-page`; one page per extension point, each built on its example plugin: screens and sidebar entries (`plugin-sidebar-page`), dashboard widgets (`plugin-article-count`), event consumers and a plugin's own tables (`plugin-article-log`), command validators (`plugin-validator`), and later the board slots that have no example yet (ADR 0037), contributed fields (ADR 0068), GraphQL extensions and MCP tools; testing a plugin with `@northmes/testing`; building and publishing |
| Modules | One page per module under `apps/docs/modules/<id>/` with its entities, commands, events and permissions, the lists generated from the manifest and the contracts |
| Reference | Generated only: the GraphQL schema, the REST API per module from the OpenAPI document, the SDK API reports, the error codes (#704), the configuration keys, the permissions and roles, the event catalog |
| Contribute | A short page that points at `CONTRIBUTING.md`, the ADR index and the glossary in the repository |

Each page has a `description` in its front matter and a title that names the task, because Context7 and `llms.txt` readers see the description first, and nothing a page says is only in a screenshot.

### One source per fact

A value that lives in code appears on the site only through a generated page or a test. The references in the table above are generated, each by a stage of `pnpm gen` that writes deterministic MDX and a navigation fragment as ADR 0048 laid out, so `pnpm gen --check` fails when one is stale. The SDK reference is rendered from API Extractor's doc model (the `.api.json` file, which carries the signatures and the doc comments), while the `.api.md` report that ADR 0038 decided stays the review artifact that shows a changed public surface in the diff; whether such a change is high is the blast-radius review's judgment ([ADR 0086](0086-risk-tiered-review-and-merge-of-agent-pull-requests.md)). A hand-written page that states a limit, a default, a lifetime or a code, such as the GraphQL API page's limits table, gets a test that reads the page and compares each value with the constant the code exports, so the page cannot state a value the code does not hold. A guide links to the reference for its values and does not repeat them.

### Docs with the surface

A pull request documents the surface it changes, in the same pull request, as ADR 0049 says. The pull request template gets a `## Docs` section, and a `pr docs` check in `scripts/ci/pr-docs.mjs`, run like `pr security` ([ADR 0076](0076-secure-development-lifecycle-with-a-security-note-per-change-a-controls-index-and-an-internal-audit-each-release.md)), fails the pull request when the section is missing or says none without a reason. `.github/docs-paths` maps each developer-facing surface to the pages that describe it, in the pattern syntax of `.github/risk-paths`: `apps/backend/src/http/` to the Integrate pages; `packages/sdk/`, `packages/web-sdk/` and each `modules/*/contracts/` to the Extend pages and the SDK reference; each `modules/<id>/` to its module page; the configuration schema to the configuration reference; and `examples/` to the tutorial pages. An entry names its pages, or says `none yet` while the surface has no page, so the file is complete from the first day without a placeholder page. When the diff touches a mapped surface and the section says none, the reason must name that surface, so the author states why no reader-facing behaviour changed. The use guides and the screens are not in the file: user guides come in one docs task per epic (ADR 0049), and the screenshots are regenerated before each release. A change under `docs/` alone (an ADR, a plan file) is not a docs change for this check, as GitLab excludes its architecture and development docs, because those pages describe decisions, not the product. Renovate's and release-please's pull requests are exempt, as for `pr security`.

### The review before the pull request reads the mapped pages

The `code-reviewer` agent (`.claude/agents/code-reviewer.md`, the review before the pull request that `CLAUDE.md` asks for and ADR 0086 names) gets one more step: when the diff touches a surface that `.github/docs-paths` maps, read the pages it names and the ADR the diff cites, and report each statement the change makes wrong, with the page, the line and the code that contradicts it. The step reads the pages, not the diff alone, because a stale page is not in the diff. It reports only on the mapped pages, so the review does not flag every function. The findings are advisory: the session fixes them before the pull request opens, and the pull request's Checks section lists them with their outcome, as for every other finding.

### Executable examples and snippet checks

The four packages under `examples/` are the source of the tutorial pages. A `pnpm gen` stage copies the code blocks the tutorials show from the example sources, between markers in the example files, so a tutorial cannot show code that CI does not build and run (today `CI / e2e` loads the examples in process; the `plugin-outside` job that ADR 0056 decided, which installs an example from the packed tarballs outside the repository, is not built yet). A docs snippet check runs in `ci / docs`: every GraphQL block under `apps/docs` parses and validates against `schema/api.graphql`; every backticked permission, error code and configuration key exists in the code; every TypeScript block that is not copied from an example type-checks against the packages it imports, once the SDK pages exist; and lychee checks the links. Each check starts in report mode, lists the blocks it would fail, and becomes a gate once the existing pages pass.

### Screenshots

`pnpm docs:screenshots` stays the one command, from the seeded demo data. Before each release the maintainer runs the Docs screenshots workflow and opens a pull request with the images it returns, so no release ships a picture of an older screen. The images are reproducible from the demo data, so CI does not compare them.

### Changes to ADR 0048

The Build on NorthMES tab replaces the single API group in `docs.json`. The SDK reference is generated from API Extractor's doc model, and the generated references grow by the error codes, the REST reference per module and the event catalog, each landing with its surface as before. `ci / docs` runs the snippet checks and lychee after `pnpm docs:generate`. The rest of ADR 0048 stands.

### Changes to ADR 0049

The rule that generated and module docs are updated in each task and extension point docs in the task that changes the extension point is now checked by `pr docs`, not only stated. The rule that user guides come in one docs task per epic stands, which is why the screens are not in `.github/docs-paths`. The rest of ADR 0049 stands.

### Consequences

* Good, because a pull request that changes a surface without its page fails before anyone reads it.
* Good, because the hand-written pages hold intent and steps, so a drift is a wrong sentence, not a wrong number.
* Good, because the tutorials are the example plugins, which CI builds and loads in the end-to-end run.
* Good, because the review step reads the page that the diff made stale instead of guessing from the diff.
* Bad, because every pull request body gains a section, and an author writes a reason when no page changes.
* Bad, because `.github/docs-paths` is one more file to keep in step with the folders, which its meta test checks.
* Bad, because the gen stage for examples adds markers to the example sources.

### Confirmation

* `scripts/ci/pr-docs.mjs` with its test: a body without a `## Docs` section fails; a section that says none without a reason fails; a diff that touches a mapped path with a reason that names no mapped surface fails; a change under `docs/` alone does not count as a docs change; Renovate's and release-please's pull requests pass.
* `test/meta/docs-paths.test.ts`: every pattern in `.github/docs-paths` matches a tracked file, every page an entry names exists under `apps/docs`, and `apps/backend/src/http/`, `packages/sdk/`, `packages/web-sdk/`, every `modules/<id>/`, every `modules/*/contracts/` and every `examples/*/` has an entry.
* `test/meta/security-docs.test.ts` or a test beside it: the pull request template has the `## Docs` section.
* `pr docs` is wired like the other pull request checks: a job in `pr.yml` that `pr gate` needs, its entries in `test/meta/workflows.test.ts`, and the main ruleset's required checks updated with its merge ([ADR 0069](0069-require-each-ci-job-as-a-status-check-on-main.md), `scripts/repo/check-ruleset.mjs`).
* The code-reviewer agent's report names the pages it read for the docs step, or says that the diff touched no mapped surface.
* A test per hand-written page that states a value reads the page and compares it with the exported constant; the GraphQL API page's limits table is the first.
* `ci / docs`: `pnpm docs:generate` leaves no diff; every GraphQL block under `apps/docs` validates against `schema/api.graphql`; every backticked permission, error code and configuration key exists; lychee finds no broken link.
* `pnpm gen --check` fails when a tutorial's code block differs from its example source.
* The release process in plan 13 has the step that runs the Docs screenshots workflow and opens the pull request with the images.

## Pros and cons of the options

### A Docs section per pull request checked in CI, the review step reading the mapped pages, generated references, executable examples and screenshots per release

* Good, because each layer catches what the others miss: the check catches a skipped page, the review catches a wrong sentence, the generators catch a stale value, the snippet checks catch a broken example.
* Neutral, because the check judges the body, not the page: a section that names a page the author did not fix passes the check and waits for the review.
* Bad, because it adds a section, a mapping file, an agent step and gen stages.

### An agent review of the diff for documentation drift, with no check on the pull request body

* Good, because it needs no new section or file.
* Bad, because detection drops by 21 to 43 points when the page is not in the diff, and an unscoped review flags most functions.
* Bad, because a review finding is advisory and nothing stops a pull request whose author ignores it.

### A warning on the pull request when a feature changes no docs

* Good, because it is what GitLab runs, and it does not block.
* Bad, because a warning is for a person, and here the author is an agent that reads a failing check and nothing else.

### A freshness bot that flags pages by days since their last edit

* Good, because it needs no mapping.
* Bad, because age is not staleness: a correct page ages, a wrong page can be new, and the one tool found (docdecay) has had no release since 2020.

## More information

* Related ADRs: [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md), [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md), [0048](0048-documentation-on-docs7-at-docs-northmes-dev.md), [0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md), [0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md), [0064](0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md), [0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md), [0073](0073-one-module-contract-for-rest-webmcp-and-later-mcp-with-oauth-clients-and-tokens.md), [0075](0075-plugin-installs-from-signed-archives-into-a-plugin-volume-with-plugin-screens-loaded-at-run-time.md), [0069](0069-require-each-ci-job-as-a-status-check-on-main.md), [0076](0076-secure-development-lifecycle-with-a-security-note-per-change-a-controls-index-and-an-internal-audit-each-release.md) (the Security section that the Docs section follows), [0086](0086-risk-tiered-review-and-merge-of-agent-pull-requests.md).
* API Extractor's doc model and API report: https://api-extractor.com/pages/setup/generating_docs/ and https://api-extractor.com/pages/overview/demo_api_report/.
* Plan: [13 delivery and GitHub](../plan/13-delivery-and-github.md) (documentation site, release process), [01 product and scope](../plan/01-product-and-scope.md) (developer-first).
* Sources: De Michele and Tantithamthavorn, Documentation Drift in AI-Generated Pull Requests, 2026, https://arxiv.org/abs/2610.27381. Ulfat, Sabit and Hossain, Measuring LLM Trust Allocation Across Conflicting Software Artifacts, 2026, https://arxiv.org/abs/2604.03447. Xu, Wahab, Holmes and Lemieux, DocPrism, ISSTA 2026, https://arxiv.org/abs/2511.00215. API Extractor API reports: https://api-extractor.com/pages/overview/demo_api_report/. GitLab documentation workflow: https://docs.gitlab.com/development/documentation/workflow/ and its `tooling/danger/documentation.rb`. Django contribution checklist: https://docs.djangoproject.com/en/dev/internals/contributing/writing-code/submitting-patches/. Snippet type checks: https://github.com/solana-mobile/solana-mobile-docs/pull/70 and https://github.com/tauri-apps/tauri-docs/pull/4172. lychee: https://github.com/lycheeverse/lychee-action.
* Revisit when external plugins ship their own docs, when the MCP tools land, at 2.0 when versioned docs begin, or if the `pr docs` check passes pull requests whose pages are wrong more often than the review catches them.
