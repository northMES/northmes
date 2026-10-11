---
status: "proposed"
date: 2026-10-11
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (the Argos plan and its cost; when the Argos check becomes required; which screenshots leave the repository for Argos)"
---

# Visual regression snapshots with Argos from the Playwright specs

## Context and problem statement

On 2026-10-11 Krister Johansson set testing requirements for the web app: visual regression testing with Argos, accessibility checks against WCAG 2.2 AA, stable tests and both in CI. The accessibility part follows ADR 0021 and is built in #506. The end-to-end specs ([ADR 0041][adr-0041]) assert roles, names and text, so a change that moves, hides or restyles an element without changing its text passes them. Krister created an Argos account for the repository and stored `ARGOS_TOKEN` as a repository secret.

This ADR decides how screenshots are taken, compared and reviewed. It covers the Playwright specs in `e2e/`, the `e2e` CI job and the review of a pull request that changes the UI.

## Decision drivers

* A reviewer sees every visual change of a pull request beside its baseline, without running the app.
* Snapshots are stable: the same commit gives the same pixels, or the check is ignored.
* No customer data leaves the repository; the e2e specs use only the fictional seed ([plan 17](../plan/17-risks.md)).
* The pages and states that `checkA11y` covers are the ones a snapshot covers, so one walk through a page serves both.

## Considered options

* Argos with `@argos-ci/playwright`, uploading from the `e2e` job
* Playwright's `toHaveScreenshot` with baselines committed to the repository
* Chromatic or Percy

## Decision outcome

Chosen option: "Argos with `@argos-ci/playwright`", because it compares each pull request against the baseline from `main`, shows the changes in a review page linked from the pull request, and keeps the images out of the repository. Krister chose it.

### How snapshots are taken

* The `checkA11y` fixture of `e2e/fixtures.ts` calls `argosScreenshot(page, name)` from `@argos-ci/playwright` once axe passes, so each state a spec checks is also a screenshot. The name is the state in kebab case, such as `the-articles-list-grouped-by-stock-unit`.
* Argos's reporter, added to `playwright.config.ts`, uploads the screenshots only when CI runs and `ARGOS_TOKEN` is set. A local run and a pull request from a fork take the screenshots and upload nothing.
* Stability:
  * the specs run in one Chromium with a fixed viewport, locale, time zone and color scheme, and with the launch args `--disable-lcd-text` and `--font-render-hinting=none` that Argos asks for;
  * `argosScreenshot` waits for fonts, images and `aria-busy` to settle and hides the caret; a state that is busy on purpose, such as a list while it loads, skips the `aria-busy` wait;
  * the screenshot is full page with sticky elements made static, so the scroll position does not move the Save bar;
  * "Created" and "Last changed" times are hidden and masked, and the codes a spec creates come from the test's title, so they are the same in every run.
* The shell's content security policy blocks the script and the styles that `argosScreenshot` injects. The specs serve it with Argos's script allowed by the hash Argos publishes and with inline styles allowed, rather than Playwright's `bypassCSP`, so any other inline script stays blocked in the e2e run ([ADR 0019][adr-0019]).
* A snapshot that differs on an unchanged commit is a flake: it is fixed in the spec, not accepted.

### How changes are reviewed

* The Argos GitHub app posts a check on each pull request whose `e2e` job uploads screenshots, so not on a fork's until a maintainer reruns it on a branch of the repository. A visual change sets it to "changes detected" until someone approves the change in Argos.
* The check is not required at first. It becomes a required check of the `main` ruleset once it has been stable for two weeks (M-92).
* `main` is the baseline: a merged pull request's screenshots become the reference for the next ones.

### Secrets and data

* `ARGOS_TOKEN` is a repository secret. Only the `e2e` job reads it, as an environment variable of its test step. Workflows never use `pull_request_target`, so a fork's pull request gets no token ([ADR 0050][adr-0050]).
* Screenshots show only the fictional seed of `scripts/stack/seed.mjs` and the records a spec creates. No pilot export, customer name or recorded request appears in a spec.
* The Argos upload is a new trust boundary, from the `e2e` job to a third-party service. ADR 0076 gives it a row in the threat model, `docs/security/threat-model.md`, which #485 writes; until that file exists, the row is recorded here and #485 carries it over:
  * Assets: the screenshots, `ARGOS_TOKEN`, and the approved baselines in Argos.
  * Spoofing and tampering: a leaked token could upload builds or change what a pull request is compared with. The token is Argos's project token, which uploads to this one project and grants nothing in GitHub. Only the `e2e` test step reads it, workflows never use `pull_request_target`, and a visual change counts only after a person approves it in Argos.
  * Information disclosure: the screenshots leave the repository. They hold only the fictional seed and the records a spec creates (M-93).
  * Repudiation: Argos records who approved each change.
  * Denial of service: the Argos check is not required at first (M-92), so an Argos outage blocks no merge.

### Consequences

* Good, because every UI pull request shows its visual changes beside the baseline, and an unintended change is caught before merge.
* Good, because the images live in Argos, so the repository and its clones stay small.
* Good, because one walk through a page gives both the accessibility check and the snapshot.
* Bad, because screenshots of the app leave the repository for a third-party service. Only fictional data is in them, and the dependency is a test tool that the product does not ship.
* Bad, because a pull request from a fork gets no visual check until a maintainer reruns it on a branch of the repository.
* Bad, because the free plan's screenshot quota may not cover every run, and a paid plan costs money (M-91).

### Confirmation

* `test/meta/workflows.test.ts` gains "ADR0077 only the e2e job reads ARGOS_TOKEN, as an environment variable of its test step". The existing rule against `pull_request_target` stays.
* `e2e/articles.spec.ts` gains "ADR0077 each state that checkA11y checks also takes an Argos screenshot", with the task that adds the reporter.
* `test/meta/e2e.test.ts` (new): "ADR0077 playwright.config.ts uploads to Argos only in CI", read from the config's reporter options.
* `test/meta/e2e.test.ts`: "ADR0077 the e2e project pins the viewport, locale, time zone, color scheme and font rendering" and "ADR0077 the specs' pages allow Argos's script by its hash and inline styles, and block any other inline script".

## Pros and cons of the options

### Argos with `@argos-ci/playwright`

* Good, because the review page and the GitHub check come with it, and baselines follow `main`.
* Good, because `@argos-ci/playwright` is MIT and runs inside the existing specs.
* Bad, because it is a third-party service with a quota.

### Playwright's `toHaveScreenshot`

* Good, because it needs no service and no secret.
* Bad, because the baselines are binary files in the repository, each change rewrites them, and a reviewer compares images by hand.
* Bad, because baselines depend on the operating system and font rendering, so a developer's machine and CI produce different pixels.

### Chromatic or Percy

* Good, because both offer the same review flow.
* Bad, because Chromatic centres on Storybook, which NorthMES does not use, and Krister chose Argos.

## More information

* Related ADRs: [0019][adr-0019] the content security policy, [0021][adr-0021] the accessibility target and the axe checks, [0041][adr-0041] the test strategy, [0050][adr-0050] the CI rules, [0076][adr-0076] the security note per change.
* Plan: [11 quality and testing](../plan/11-quality-and-testing.md), [16 open questions](../plan/16-open-questions.md) M-91 to M-93.
* Issues: #506 (the axe checks that the snapshots follow).
* Revisit when the free quota runs out, when a fork-heavy contribution flow starts, or if Argos changes its terms.

[adr-0019]: 0019-web-shell-with-react-module-federation-remotes.md
[adr-0021]: 0021-accessibility-target-wcag-2-2-aa.md
[adr-0041]: 0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md
[adr-0050]: 0050-github-organization-rulesets-ci-runners-and-supply-chain.md
[adr-0076]: 0076-secure-development-lifecycle-with-a-security-note-per-change-a-controls-index-and-an-internal-audit-each-release.md
