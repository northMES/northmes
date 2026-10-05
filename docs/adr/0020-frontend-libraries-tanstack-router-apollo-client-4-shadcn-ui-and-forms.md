---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 03, 08, 13, 19, 21, 29, 32, 33
informed: NorthMES contributors
release: "1"
needs-confirmation: "maintainer (Base UI; token base)"
---

# Frontend libraries: TanStack Router, Apollo Client 4, shadcn/ui and forms

## Context and problem statement

The web shell loads one React remote per module at run time ([ADR 0019][adr-0019]). The shell and every remote need the same router, GraphQL client and cache, codegen, component primitives, forms, tables, virtualization and design tokens. Because React, the router, Apollo Client, `@northmes/web-sdk` and `@northmes/ui` are shared singletons, these choices are part of the runtime contract every plugin builds against. The page runs under a strict content security policy with `style-src 'self'`, and the app targets WCAG 2.2 AA ([ADR 0021][adr-0021]).

The Claude Design project where screens are designed is bound to a design system called Broadsheet, which fails contrast criteria. This ADR picks the libraries and the token base. It covers `apps/web`, `@northmes/ui`, `@northmes/web-sdk` and every `modules/*/web` package.

## Decision drivers

* A client-only SPA: no server rendering, no TanStack Start.
* One normalized GraphQL cache shared by every remote.
* No runtime style injection under `style-src 'self'`.
* Tokens that pass WCAG 1.4.3 and 1.4.11 in a light and a dark theme.
* `@northmes/ui` stays free of Apollo, TanStack Router and GraphQL imports, so later MCP Apps views can use it.
* Stable APIs that coding agents know well, with a single place to swap a library later.
* Licenses on the project's allow-list ([ADR 0040][adr-0040]).

## Considered options

* Router: TanStack Router with code-based routes; TanStack Router file routes with the router plugin; TanStack Start.
* GraphQL client: Apollo Client 4 as the only cache; Apollo Client 4 plus TanStack Query.
* Primitive library under shadcn 4: Base UI; Radix.
* Forms: react-hook-form 7 with the Standard Schema resolver; TanStack Form 1.
* Token base: shadcn neutral with contrast fixes, light and dark; Broadsheet, the design system bound to the Claude Design project.

## Decision outcome

Chosen options: TanStack Router with code-based routes, Apollo Client 4 as the only cache, shadcn 4 on Base UI, react-hook-form 7, and shadcn neutral tokens with contrast fixes, because together they run under the strict CSP, keep one cache across remotes and meet the contrast criteria. Base UI and the token base wait for the maintainer's confirmation.

Routing and data:

* TanStack Router with code-based routes. Remotes return route subtrees from `routes(plantRoute)`; `screenRoute` in `@northmes/web-sdk` declares route, title, nav entry and permission together. Each module has a type-only `register.ts` for typed links inside the module.
* Apollo Client 4 with `createQueryPreloader` in route loaders; the release-candidate TanStack Start integration is not used. The normalized cache is the only GraphQL cache; TanStack Query is not used.
* Instants stay ISO strings in the Apollo cache, because `@wry/equality` 0.5.7 returns false for two equal `Temporal.Instant` values; the board converts to epoch milliseconds once at the data edge ([ADR 0024][adr-0024]).
* GraphQL Code Generator with `typescript-operations` and `typed-document-node`, one generated file per web package from its closure schema, `.graphql` files next to the screens, data masking on (`@unmask` where the board needs raw speed), const enums, and the time scalars as branded strings. No generated hooks and no `client` preset, as Apollo advises.
* TanStack Table v9 with manual sorting, paging, filtering and grouping, and TanStack Virtual for long lists and board rows.

Components and forms:

* shadcn 4 in monorepo mode with `packages/ui` as `@northmes/ui`, on one locked primitive library: Base UI (`@base-ui/react`). The app is wrapped in `CSPProvider` with `disableStyleElements`, and the shell sheet carries Base UI's scrollbar rules.
* Module and plugin code never imports `@base-ui/*` or Radix directly; forms, tables, toasts and virtualization come through `@northmes/ui` exports.
* sonner gets a pnpm patch that removes its runtime style insertion (`__insertCSS`), and its CSS joins the `@northmes/ui` sheet.
* react-hook-form 7 with the Standard Schema resolver behind `useZodForm` in `@northmes/ui`, and `useCommandForm` in `@northmes/web-sdk`, which binds a form to a command mutation ([ADR 0017][adr-0017]).
* The React Compiler runs through its Babel preset in the shell and every remote, with `compilationMode` kept as a switch.
* Icons come from `lucide-react` through `@northmes/ui`; fonts are self-hosted, and the app makes no CDN calls.
* react-doctor is pinned, runs in CI only with `--no-telemetry`, and stays out of every published package's dependencies; its license is a modified MIT text that is not OSI open source.

Design tokens:

| Token | Fix in light and dark | Criterion |
|---|---|---|
| `--input` | OKLCH lightness 0.669 or lower in light, 0.478 or higher in dark | 1.4.11 |
| Focus indicator | a separate `--focus` token without the `/50` opacity, or the two-tone ring | 1.4.11, 2.4.7 |
| `--muted-foreground` | lightness 0.547 or lower where it sits on `--muted` | 1.4.3 |
| Accent and link text | at least 4.5:1 against their backgrounds | 1.4.3 |

Block and swatch text is pure black or pure white, whichever contrasts more with the fill (`textColorFor` in `@northmes/contracts`, at least 4.58:1 for any sRGB fill). Every board block has a foreground-colored border, and state markers use the text color. The order palette has 20 distinct colors whose values design task D1 sets; color groups but never carries state. Broadsheet is not used; design task D1 removes the binding or moves to a new design project.

### Consequences

* Good, because every remote reads one normalized cache, so a query or mutation result updates every screen that shows the entity.
* Good, because no library injects styles at run time, so the strict CSP holds without hashes or nonces.
* Good, because designs name shadcn components only, so nothing designed so far depends on Base UI or Radix, and the choice can still change before the first component ships.
* Good, because the token fixes are measured: the shadcn defaults gave 1.26:1 for `--input` in light, 1.54:1 (light) and 1.87:1 (dark) for the `ring/50` focus ring, and 4.34:1 for `muted-foreground` on `muted` in light.
* Bad, because react-hook-form 8 is in beta and TanStack Table v9 is recent, while most agent training material shows Table v8; a project skill holds one v9 pattern.
* Bad, because the sonner patch must be checked on every sonner upgrade.
* Bad, because Apollo Client 4 under the React Compiler was not verified.
* Neutral, because the router, Apollo Client and the primitive base become part of the plugin runtime contract; their majors move with NorthMES versions ([ADR 0038][adr-0038]).

### Confirmation

* Biome `noRestrictedImports`: `@base-ui/*`, `radix-ui` and `@radix-ui/*` imports fail in `modules/*/web` and `examples/*/web`.
* A unit test fails if the installed sonner contains `__insertCSS(`.
* CSP fixture in Playwright: a toast shows and each overlay opens with zero `securitypolicyviolation` events, and the toaster has `position: fixed`.
* Token contrast test in `packages/ui` with `culori` (`toGamut("rgb", "oklch")`, then `wcagContrast`): text pairs at 4.5:1 and input border, focus ring halves and block border on lane at 3:1, in light and dark. It runs before the first component.
* Property test: `textColorFor` reaches 4.5:1 over random colors and the 20 palette colors.
* Vitest in the Temporal polyfill project: writing an identical board result twice into the cache causes zero extra block layer renders.
* `pnpm gen --check` covers the typed documents per web package.
* `test/meta/forbidden-deps.test.ts` (proposed name): fails when `@tanstack/react-query` or `@apollo/client-integration-tanstack-start` appears in any workspace `package.json`.
* CI runs react-doctor with `--no-telemetry`; a check (proposed) fails if react-doctor appears in the dependencies of any published `@northmes/*` package.

## Pros and cons of the options

### TanStack Router with code-based routes

* Good, because remotes create their own route subtrees at run time.
* Good, because links and params are typed inside a module through its `register.ts`.
* Bad, because typed links stop at the module boundary.

### TanStack Router file routes with the router plugin

* Good, because route files and generated trees are familiar to agents.
* Bad, because they assume a build step that sees every module's routes, which runtime remotes do not have.

### TanStack Start

* Bad, because the decision excludes it and a federation shell must be client-only.

### Apollo Client 4 as the only cache

* Good, because one normalized cache serves every remote, and query and mutation results update every screen that shows the entity.
* Bad, because Apollo Client 4 under the React Compiler was not verified.

### Apollo Client 4 plus TanStack Query

* Bad, because a second cache would hold copies of the same entities.

### Base UI

* Good, because it is shadcn's default for new projects since July 2026.
* Good, because its `CSPProvider` turns off style elements under `style-src 'self'`.

### Radix

* Good, because it is not deprecated and every shadcn component still ships for it.
* Bad, because its `react-style-singleton` needs a hash or a nonce under `style-src 'self'`.

### react-hook-form 7 with the Standard Schema resolver

* Good, because its API has been stable for years and agents know it well.
* Bad, because version 8 is in beta, so a major upgrade is ahead; it touches only `useZodForm` and the field wrappers.

### TanStack Form 1

* Good, because it accepts Standard Schema validators directly.
* Bad, because its v2 alpha changes the validator and listener model.

### shadcn neutral tokens with contrast fixes

* Good, because they match the components, have a dark theme and pass once fixed.
* Bad, because NorthMES owns the fixes and must re-check them when shadcn changes its defaults.

### Broadsheet

* Good, because the design project already uses it.
* Bad, because it fails 1.4.3 for links, primary buttons and muted text (3.65:1 on its background), fails 1.4.11 for input borders, has no dark theme and loads its font from a CDN.

## More information

* Related ADRs: [0016][adr-0016] (lists that `DataTable` renders), [0017][adr-0017] (Zod forms), [0018][adr-0018] (per-plant client), [0019][adr-0019] (shell and singletons), [0021][adr-0021] (accessibility), [0022][adr-0022] (package map), [0024][adr-0024] (time scalars), [0038][adr-0038], [0040][adr-0040], [0049][adr-0049] (Claude Design per task).
* Plan: [06-web-and-ux.md](../plan/06-web-and-ux.md) (shared packages, UI patterns, forms, design tokens, Claude Design order of work).
* Sources: https://ui.shadcn.com/docs/monorepo, https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default, https://www.apollographql.com/docs/react/data/suspense.
* Revisit when the maintainer confirms or rejects Base UI and the token base, when react-hook-form 8 or TanStack Form 2 is stable, and when a test shows Apollo Client misbehaving under the React Compiler.

[adr-0016]: 0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md
[adr-0017]: 0017-zod-contracts-as-the-single-source-for-inputs.md
[adr-0018]: 0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
[adr-0019]: 0019-web-shell-with-react-module-federation-remotes.md
[adr-0021]: 0021-accessibility-target-wcag-2-2-aa.md
[adr-0022]: 0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md
[adr-0024]: 0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md
[adr-0038]: 0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0040]: 0040-dependency-license-policy-ci-gate-and-sbom.md
[adr-0049]: 0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md
