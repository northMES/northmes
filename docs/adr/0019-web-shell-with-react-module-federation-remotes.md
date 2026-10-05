---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 03, 08, 15, 16, 17, 19, 20, 32
informed: NorthMES contributors
release: "1"
needs-confirmation: "pilot IT (browser versions)"
---

# Web shell with React Module Federation remotes

## Context and problem statement

Krister Johansson decided that the NorthMES web app uses React Module Federation: each module ships its own frontend remote, a core shell loads them, and TanStack Start is not used. In release 1 the remotes are core, planning, production-start (the operator station) and the frontend widget example plugin. Later modules and customer plugins must add screens without a rebuild of the shell.

The earlier attempt at this product used Module Federation and failed in known ways: a white page when the shell's dev server built shared-module proxies from scanned barrel exports and ended up with separate React contexts, per-remote Tailwind sheets, and eleven remotes on eleven ports. Earlier research for this project assumed module routes mounted at build time (file routes, generated route shims); with remotes loaded at run time, no build step sees module routes, so the routes must come from the remotes themselves. This ADR decides the shell, the remote contract, shared singletons, serving, CSS, the plant switch and the browser floor. It covers `apps/web`, `@northmes/web-sdk`, `@northmes/web-build`, every `modules/*/web` package and the Nest routes that serve them.

## Decision drivers

* The decided shape: one remote per module, a core shell, no TanStack Start.
* One origin and a strict content security policy, so the session cookie works everywhere and no CORS exists.
* React, the router, Apollo Client and the shared NorthMES packages must exist once, or contexts and the normalized cache split.
* A failed or slow remote must leave the rest of the app working.
* A drop-in plugin remote joins after a restart, without rebuilding the shell ([ADR 0037][adr-0037]).
* One developer keeps one toolchain.
* Planner PCs and stations at the pilot run browsers whose versions are not yet known.

## Considered options

* One SPA built at build time with every module's routes mounted, without Module Federation.
* Module Federation with the shell built by the federation build plugin and remotes declared in its config, as in the earlier attempt.
* A pure runtime host: the shell runs `@module-federation/runtime` only, the server lists the remotes, and each remote returns code-based routes from `routes(plantRoute)`.
* A TanStack Start shell with server rendering.

## Decision outcome

Chosen option: "A pure runtime host", because the shell then scans no package exports, which removes the earlier white page's cause, and because a spike ran the whole path (runtime loading from Nest under a strict CSP, one Apollo cache and one React context across shell and remote, typed links inside a module, Fast Refresh across the boundary, a missing or tampered remote leaving the app working).

Shell and boot:

* `apps/web` is a Vite SPA with code-based TanStack Router routes and one `@module-federation/runtime` instance; it runs no federation build plugin. It hands its own copies of the shared packages to the runtime with `registerShared`.
* At boot it fetches `GET /api/web/modules?plant=<slug>`, registers the listed remotes and loads them in parallel with a timeout (10 s for the planner layout, 30 s for the station layout, a per-remote loading indicator after 2 s, and `@module-federation/retry-plugin` with its cache-busting query for retries).
* It validates each module with `validateWebModule` and checks that id and version equal the server's entry, calls `routes(plantRoute)` and checks that the returned route's path equals the module id, then creates the router once with `defaultErrorComponent`. A change in the set of loaded modules means a full page load.
* A module that fails gets a placeholder route and an "(unavailable)" menu entry at its usual position; `order` is required in the backend manifest. A minimal status route in the shell survives a broken core remote.
* Mount points: `/$plant` and `/station/$stationId`. There is no `web` role, no SSR and no TanStack Start.

Remote contract: each remote exposes one entry, `./module`, whose default export is `defineWebModule({ id, version, northmesRange, permissions, routes(plantRoute), stationRoutes?, nav, widgets, typePolicies? })` from `@northmes/web-sdk` (MIT). Labels are plain strings. Links into another module's screens use small link helpers from that module's MIT contracts package, because no TypeScript program sees every route.

Shared singletons: react, react-dom, react/jsx-runtime, @tanstack/react-router, @apollo/client, @apollo/client/react, @northmes/web-sdk and @northmes/ui. Every remote declares each as `{ singleton: true, import: false, requiredVersion: false }`, so a remote never bundles a fallback. One list, `packages/web-build/shared.mjs`, feeds the shell and every remote. Remotes are built with Vite 8 and `@module-federation/vite`, pinned exactly, through `defineRemoteConfig` in `@northmes/web-build`. Remotes set `dts: false` and do not use `@module-federation/bridge-react`.

Serving: Nest serves each installed remote at `/modules/<id>/<version>/` with immutable caching for hashed files and `no-cache` for the fixed-name manifest and entry. `/api/web/modules` lists only enabled, permitted and compatible remotes, each with a SHA-384 hash of its `mf-manifest.json`. At boot the server checks the files each manifest lists and marks a module degraded with `integrity: null` when one is missing. The shell takes remote URLs only from this endpoint. The CSP is strict `'self'`.

CSS:

* In-repo remotes (`modules/*/web`) import no stylesheet and emit no CSS.
* The shell builds one Tailwind sheet from generated `@source` lines that cover each remote's workspace dependency closure plus `packages/web-sdk/src`, never built `dist` JavaScript.
* Dynamic class names are banned by review rule; palette classes go through `@source inline()`, and board block colors are a CSS variable.
* Anything built through the plugin path (the examples, customer plugins) ships a sheet prefixed with the plugin prefix and no preflight.
* The forbidden-bundle list derives from `@northmes/ui`'s own dependencies, so a remote reaches sonner, the primitive library or react-hook-form only through `@northmes/ui`.

Plant switch: the shell context holds permissions per plant, returned with the module list. On a plant change the shell fetches `/api/web/modules?plant=<new>`. When the set of module ids and versions differs, it does a full navigation with `window.location.assign`; otherwise it swaps the permission set and the per-plant Apollo client ([ADR 0018][adr-0018]). Nav items and widgets filter on the current plant's permissions.

Browser floor: Chrome and Edge 111, Firefox 128 and Safari 16.4, declared in `@northmes/web-build` with an explicit `build.target`. `/assets/browser-check.js`, an external ES2017 file, checks `CSS.supports` for `color-mix()` and `@property` and shows a plain page naming the browser and the minimum version. Every browser needs HTTPS, because the manifest hash check uses `crypto.subtle` ([ADR 0044][adr-0044]). Caddy encodes zstd and gzip. Chrome and Edge 109 are the last versions on Windows 7 and 8.1, so pilot IT reports the OS and browser versions of station and planner PCs before go-live.

### Consequences

* Good, because the shell scans nothing and hands the runtime real module namespaces, and remotes cannot ship a second React, router or Apollo client.
* Good, because a remote that is missing, slow, tampered or throwing degrades to a placeholder while the rest of the app works.
* Good, because a remote edit reaches the page through Fast Refresh across the federation boundary with state kept (63 to 230 ms in the spike).
* Good, because a remote can switch bundler without a shell change: a remote built with Rsbuild loaded into the same shell in the spike, which makes Rsbuild the tested exit.
* Bad, because `@module-federation/vite` changes fast and its shared-module code has a high bug rate: internal research note 19 counted 131 issues opened from 2026-08-01, 64 of them about singletons, with most commits from one maintainer. The exact pin, a release-age gate, `import: false` everywhere and the contract suite contain that risk.
* Bad, because typed links stop at the module boundary.
* Bad, because the federation runtime is duplicated in every remote (19.2 kB gzip each in the spike).
* Bad, because a plugin remote runs with full page access; the CSP narrows where data can go but is no sandbox, and the docs say so.
* Bad, because internal research note 19 estimated federation at 2.5 to 4 weeks more than a build-time SPA.
* Bad, because PCs on Windows 7 or 8.1 cannot run NorthMES.

### Confirmation

* `@northmes/web-build` guard tests: a fixture remote that bundles an Apollo subpath fails `northmes:no-bundled-singletons`; a fixture remote importing sonner fails the build and names the package; a remote under `modules/*/web` that emits CSS bytes fails; every utility selector in a plugin sheet carries its prefix.
* Unit test: the shell's `registerShared` keys equal the list in `shared.mjs`.
* `validateWebModule` unit tests for each error case, including a contribution without `label`; a per-remote Vitest harness checks that every `nav[].to` matches a route in the module's tree.
* Playwright contract test on the built `all` process: every module validates and every nav entry renders without the error component.
* Degraded-path specs: one module's files missing and one wrong manifest hash give the placeholder and the "(unavailable)" entry, and the sidebar order equals a run with all remotes present.
* Slow remote spec: production-start delayed 12 s shows no placeholder at 10 s on the station mount, and a retry issues a new request.
* CSP fixture: zero `securitypolicyviolation` events while a toast shows and each overlay opens.
* Plant switch: Playwright with a role that grants production-start at one plant only records exactly one document navigation when the module set differs; a Vitest test shows `useShell().can(...)` changing with the plant param.
* `rest/web-modules.int.test.ts`: no cookie returns 401; an unauthorized plant returns 403; a disabled module never appears in any browser request.
* CSS source test: a class used only in a workspace package that planning web imports is present in the shell sheet.
* `browser-check.js` test: with `CSS.supports` mocked false it renders the message and loads no other script.

## Pros and cons of the options

### One SPA built at build time

* Good, because it has one bundle, one route tree with typed links everywhere, and no federation risk.
* Bad, because it contradicts the decided shape, and a plugin's screens need a rebuild of the web app.

### Federation with the build plugin in the shell

* Good, because it is the plugin's documented host mode.
* Bad, because the shell's share proxies come from scanned export names, the cause of the earlier white page.
* Bad, because the earlier attempt hard-coded its remotes in the shell's config and in a type file per remote, so adding a module meant a shell change.

### A pure runtime host

* Good, because every failure stays inside one remote, and the server decides what each user loads.
* Bad, because the shell maintains its own boot, validation and placeholder code.

### A TanStack Start shell with server rendering

* Good, because loaders and streaming come built in.
* Bad, because the decision excludes it, federation needs a client-only shell, and internal research note 03 found Start still in release candidate state with a broken PWA build.

## More information

* Related ADRs: [0003][adr-0003] (manifest `web` block, `order`), [0018][adr-0018] (per-plant client, stale tabs), [0020][adr-0020] (router, Apollo, UI libraries), [0021][adr-0021] (shell accessibility services), [0022][adr-0022] (shared web packages), [0037][adr-0037] (slots and plugins), [0038][adr-0038] (shared version checks), [0043][adr-0043] (browser errors reach the server), [0044][adr-0044] (mandatory TLS), [0050][adr-0050] (Renovate release-age gate).
* Plan: [06-web-and-ux.md](../plan/06-web-and-ux.md) (boot sequence, contract, singletons, CSS, serving, failure handling), [03-modules-and-extensibility.md](../plan/03-modules-and-extensibility.md).
* Module Federation runtime API: https://module-federation.io/guide/runtime/runtime-api.html. TanStack Router code-based routing: https://tanstack.com/router/latest/docs/framework/react/routing/code-based-routing.
* Waits until after the pilot: the experimental external runtime, the DTS plugin, import-map integrity for every chunk, a service worker, enabling plugins without a page reload, and the plugin template with a prefixed sheet.
* Revisit when pilot IT reports browser versions, when the federation plugin's singleton bug rate forces the Rsbuild path, and when the first plugin is built outside the repository.

[adr-0003]: 0003-module-package-shape-and-the-definemodule-manifest.md
[adr-0018]: 0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
[adr-0020]: 0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md
[adr-0021]: 0021-accessibility-target-wcag-2-2-aa.md
[adr-0022]: 0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md
[adr-0037]: 0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0038]: 0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0043]: 0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
[adr-0044]: 0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md
[adr-0050]: 0050-github-organization-rulesets-ci-runners-and-supply-chain.md
