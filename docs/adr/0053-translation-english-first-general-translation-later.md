---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 13, 16, 21 and 33
informed: contributors, coding agents, module and plugin authors
release: "1"
needs-confirmation: ""
---

# Translation: English first, General Translation later

## Context and problem statement

The product owner wants NorthMES in all European languages. The earlier attempt at this product paid a translation tax: every task's definition of done carried Swedish and English strings. Krister Johansson decided that the UI ships in English first, that General Translation (`gt-react`) is added later, and that translatable master data keeps a translations column from the start.

Pilot master data is Swedish (article names, customer names, ERP free fields) inside an English UI, which WCAG 2.2 success criterion 3.1.2 (language of parts) asks the page to mark. This ADR decides how UI text is written until translation arrives, how translatable master data is stored and resolved, how the language of data is marked, and the rules for adding General Translation later. It covers the web shell and remotes, the master-data kit, the `localizedText` value type in `@northmes/contracts` and a company setting.

## Decision drivers

* Release 1 is full; translating every string now costs time in every task.
* Adding a translations column to every register later means a migration per table and a GraphQL contract change.
* The accessibility target is WCAG 2.2 AA, including 3.1.1 and 3.1.2 ([ADR 0021](0021-accessibility-target-wcag-2-2-aa.md)).
* A self-hoster must be able to build NorthMES without a hosted translation service.
* `gt-react` is MIT and reads bundled translation files at run time with no CDN request; `gt generate` writes templates for hand translation without the General Translation API, while `gt translate` needs an account.

## Considered options

* English only now, `gt-react` later, the translations column now
* Wire `gt-react` from the first screen
* English only now, add translations columns when translation arrives
* Another library (i18next with react-i18next, Lingui, react-intl)

## Decision outcome

Chosen option: "English only now, `gt-react` later, the translations column now", because it keeps release 1 free of translation work while the one part that is expensive to add later, the data shape of translatable master data, exists from the first migration.

UI text in release 1:

* The UI ships in English only. The shell renders `<html lang="en">`; it takes the user's language when General Translation arrives.
* User-facing text stays literal in JSX, and labels in manifests, settings and definitions are plain strings. Code does not assemble sentences from fragments. Wrapping the text for `gt-react` later is then mechanical.

Translatable master data:

* `localizedText` in `@northmes/contracts` is `name` plus `translations`, an array of `{ field, locale, text }` with any BCP 47 tag. Resolution for a requested locale: the exact tag, then its base language, then `name`.
* A register declares translatable fields with `localizedName` in its `defineMasterData` definition ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)). Its first migration has `name text not null` and `translations jsonb not null default '[]'`.
* GraphQL exposes `name` resolved for the request's locale and `translations: [Translation!]!`, where `Translation` is an SDK value type marked `@shareable`, so modules never copy their own localized types.

Language of data:

* A company data-language setting gives master data text its `lang` attribute; a translated value carries its translation's `lang`.
* Board block names are built through `aria-labelledby` from visible spans that carry `lang`, so a Swedish article name keeps its language inside an English accessible name.

Adding General Translation later:

* `gt-react` wraps the literal JSX text. `gt-next` is never installed (NorthMES has no Next.js, and it pulls LGPL-licensed binaries); the license gate's never-installed list gains it in the same task.
* Before translation work starts, the project decides whether contributors translate by hand with `gt generate` or through a General Translation account with `gt translate`.
* Translation files are committed, so a self-hoster builds without the service and the running app makes no request to it.

### Consequences

* Good, because no task in release 1 writes or reviews translated strings.
* Good, because every register already has the column, the resolution rule and the GraphQL type when a customer needs a second data language.
* Good, because screen readers pronounce Swedish master data with Swedish rules inside the English UI.
* Bad, because the UI stays English-only for the pilot, even where operators would prefer Swedish.
* Bad, because the literal-text rule has to hold in every task until translation starts; a sentence built from fragments makes later wrapping harder.
* Neutral, because the hand or account decision for translators waits until translation work is planned.

### Confirmation

* Unit tests for `localizedText` resolution: a `sv-SE` translation answers `sv-SE`; a request for `sv-FI` falls back to `sv`; a locale with no translation returns `name`.
* The master-data kit contract suite fails when a register that declares `localizedName` has no `translations jsonb not null default '[]'` column, and checks that GraphQL returns `name` and `translations`.
* A Playwright test asserts `<html lang="en">` on every shell route.
* A component test: with the company data language set to `sv`, an article name in a list, a detail page and a board block carries `lang="sv"`, and a translated value carries its own locale.
* Review checklist for UI tasks: user-facing text is literal JSX, not concatenated in code.
* When `gt-react` is added: the web build runs with no network access to General Translation and still produces every committed locale; the license gate fails on `gt-next`.

## Pros and cons of the options

### English now, column now, `gt-react` later

* Good, because only the data shape, the part that is hard to change, is paid for now.
* Bad, because the UI is English-only at the pilot.

### `gt-react` from the first screen

* Good, because the UI could ship in Swedish at the pilot.
* Bad, because every UI task carries translation work, which the earlier attempt showed is a steady tax.

### Columns added when translation arrives

* Good, because release 1 tables are slightly simpler.
* Bad, because every register then needs a migration and every type a contract change, and modules tend to copy their own localized types.

### Another library

* Good, because i18next, Lingui and react-intl need no service for any path.
* Bad, because Krister Johansson chose General Translation, which also works without its service at run time and for hand translation.

## More information

* Related ADRs: [0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md), [0019](0019-web-shell-with-react-module-federation-remotes.md), [0021](0021-accessibility-target-wcag-2-2-aa.md), [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md), [0040](0040-dependency-license-policy-ci-gate-and-sbom.md).
* Plan: [06 web and UX, language](../plan/06-web-and-ux.md#language), [03 modules and extensibility](../plan/03-modules-and-extensibility.md).
* General Translation, storing translations: https://generaltranslation.com/en-US/docs/react/guides/storing-translations. `gt generate`: https://generaltranslation.com/en-US/docs/cli/reference/commands/generate. WCAG 2.2: https://www.w3.org/TR/WCAG22/.
* Revisit before translation work starts (hand translation or an account), and when a customer needs a UI language other than English.
