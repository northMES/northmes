---
status: "proposed"
date: 2026-10-09
decision-makers: proposed by the operating session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors, coding agents
release: "1"
needs-confirmation: ""
---

# Core's pages at the plant root and the company settings root

## Context and problem statement

[ADR 0003][adr-0003] makes a module's id its URL segment, `/$plant/<id>`, and [ADR 0066][adr-0066] puts a module's company settings pages at `/settings/$companyId/<id>`. Core follows both, so the articles list is `/plant-a/core/articles`, its breadcrumb reads "Plant A > Core > Articles", and the users list is `/settings/<company id>/core/users`. Core is the platform's own module: articles, people, users and roles are what every installation has, and the word core tells a planner nothing about the page.

On 2026-10-09 Krister Johansson looked at `/plant-a/core/articles` in the dev app and asked to lose "core" from the URL and the breadcrumb.

This ADR decides where core's web pages sit, what the breadcrumb shows for them, what happens to the old URLs, and which module ids the host refuses so that no module lands on a page of core or the shell. It covers core's link manifest, `createShellRoutes` in `@northmes/web-sdk`, the shell's breadcrumb, page not found and error pages in `apps/web`, and the backend's catalog check. REST paths under `/api/v1/core/` are not web URLs and do not change.

## Decision drivers

* Krister Johansson's request of 2026-10-09.
* A URL and a breadcrumb name what the user works with, not how the code is packaged.
* Every other module keeps its id as its segment and its module crumb, so a module's pages stay grouped and a page never belongs to two modules.
* A path is written once, in the link manifest ([ADR 0062][adr-0062]).
* Bookmarks and links already shared keep working.
* The host refuses a module that would collide with another part of the system at boot, as it refuses `web`, `station` and `auth` ([ADR 0003][adr-0003]).

## Considered options

* Core's pages at the plant root and at the company settings root, without the module id
* Keep `/$plant/core/...` and hide only the breadcrumb crumb
* A shorter segment for core, such as `/$plant/c/...`

## Decision outcome

Chosen option: "Core's pages at the plant root and at the company settings root, without the module id", because it is the only option that removes core from both the URL and the breadcrumb, and the host can keep the rest of the URL space safe by refusing the few ids core and the shell take.

* Core's web pages sit at the plant root, `/$plant/<page>`, such as `/plant-a/articles`, `/plant-a/articles/<id>`, `/plant-a/articles/new` and `/plant-a/people` for People in plant settings.
* Core's company settings pages sit at the company settings root, `/settings/$companyId/<page>`, such as `/settings/<company id>/users` and `/settings/<company id>/roles`.
* Core's link manifest comes from `defineCoreLinks(entries, { settings })` in `@northmes/contracts`, which builds the same builders as `defineModuleLinks` with the patterns `/$plant/...` and `/settings/$companyId/...`. Every other module keeps `defineModuleLinks('<id>', ...)`.
* Core's web routes are pathless routes under the `$plant` route and the company settings route. `createShellRoutes` checks that core's top routes have no path and that every other module's top route has its id as its path.
* The shell treats a path whose first segment under the plant is not another module's id as core's. The breadcrumb leaves out the module crumb for core ("Plant A > Articles", "Plant A > Settings > People"), and the document title follows. An unknown path at the plant root is the plant's own page not found, with Go to Plant A. The way out of a core page that failed is Go to Articles, or See all pages on Articles itself.
* Every other module keeps its id as its path segment and its module crumb: `/plant-a/planning/board` reads "Plant A > Planning > Planning board".
* The old URLs `/<plant>/core/...` and `/settings/<company id>/core/...` redirect, with their search and hash, to the same page without `core`.
* The host refuses a module id equal to one of core's top-level web segments (today `articles`, `people`, `users` and `roles`) or the shell's own segments (`all-pages` and `settings`). `createShellRoutes` reads core's segments from its routes and the shell's from its plant routes; the backend catalog check reads core's from `coreLinks` and lists the shell's.

### Consequences

* Good, because a planner sees `/plant-a/articles` and "Plant A > Articles", which name the page and nothing else.
* Good, because a new core page, such as plants or onboarding, reserves its segment without a change to the host, since both checks read core's segments from core's routes and links.
* Good, because old bookmarks land on the new page.
* Neutral, because core's sidebar group keeps its label Core.
* Bad, because the plant root and the company settings root are shared between core, the shell and the module ids, so a module id that a later core page takes must be renamed. In release 1 every module is in this repository, so the catalog check finds such a clash in CI.
* Bad, because the shell has one rule more: a path whose first segment is no module id is core's.

### Confirmation

* `packages/contracts/test/define-module-links.test.ts`: "defineCoreLinks builds core's pages at the plant root and its settings pages at the company settings root, without a module segment (ADR 0074)".
* `modules/core/contracts/test/links.test.ts`: coreLinks builds `/plant-a/articles` and `/settings/<company id>/users`.
* `packages/web-sdk/test/shell-routes.test.tsx`: core's routes mount at the plant root and the company settings root; a module other than core whose routes sit at another path than its id is rejected, and so is core with a path; a module whose id is a top-level path segment of core's or the shell's routes is rejected.
* `apps/backend/test/catalog.test.ts`: the module ids `articles`, `people`, `users`, `roles`, `all-pages` and `settings` are refused as reserved, and the message names the id.
* `apps/web/test/shell-core.test.tsx`: the breadcrumb of a core page has no module crumb, an unknown path at the plant root is the plant's page not found, and the plant switcher leads from an article to the other plant's articles list.
* `apps/web/test/modules/core/routes.links.test.tsx`: an old list, detail and settings URL each redirect to the new one.

## Pros and cons of the options

### Core's pages at the plant root and at the company settings root, without the module id

* Good, because both the URL and the breadcrumb lose core.
* Good, because the link manifest still writes each path once.
* Bad, because core and the shell share the plant root with module ids, which the host must guard.

### Keep `/$plant/core/...` and hide only the breadcrumb crumb

* Good, because no URL changes and nothing needs reserving.
* Bad, because the URL still says core, which the request asked to lose.
* Bad, because the breadcrumb no longer mirrors the URL.

### A shorter segment for core, such as `/$plant/c/...`

* Good, because the module id rule stays as it is.
* Bad, because the URL still has a segment that tells the user nothing.

## More information

### Changes to ADR 0003

Under "One id, derived names", the id is the URL segment `/$plant/<id>` of every module except core, whose web routes sit at the plant root and at the company settings root without a segment. Beside `web`, `station` and `auth`, the host refuses a module id equal to one of core's top-level web segments or the shell's own segments, such as `articles`, `people`, `users`, `roles`, `all-pages` and `settings`. The catalog test gains the case for these ids.

### Changes to ADR 0066

Core's company settings pages sit at `/settings/$companyId/<page>` instead of `/settings/$companyId/core/<page>`, and core's plant settings pages at `/$plant/<page>`, so the planned plants page and wizards are `/settings/$companyId/plants`, `/settings/$companyId/onboarding` and `/$plant/onboarding`. A module other than core keeps `/settings/$companyId/<id>`.

### Changes to ADR 0062

A link manifest's root is `/$plant/<id>` for every module except core, whose manifest comes from `defineCoreLinks` and has the roots `/$plant` and `/settings/$companyId`.

The plan states core's URLs in [06 web and UX](../plan/06-web-and-ux.md), [03 modules and extensibility](../plan/03-modules-and-extensibility.md) and [14 roadmap](../plan/14-roadmap.md). Revisit this decision if plugins outside the repository start to ship web pages, since a plugin built before core takes a new segment could then hold that id.

[adr-0003]: 0003-module-package-shape-and-the-definemodule-manifest.md
[adr-0062]: 0062-web-form-contracts-url-view-state-and-module-link-manifests.md
[adr-0066]: 0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-company-settings-at-settings-and-an-onboarding-wizard-before-a-plant-opens.md
