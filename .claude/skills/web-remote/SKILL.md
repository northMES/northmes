---
name: web-remote
description: NorthMES recipe for a module's web remote under modules/<id>/web, built through defineRemoteConfig and loaded by the runtime shell. Use when adding a remote, a route, a screen or a link entry, when a remote's build fails a northmes guard, or when the shell logs that it could not load a module.
---

# Web remote

Each module ships its screens as one Module Federation remote under `modules/<id>/web` (ADR 0019). The shell in `apps/web` is a pure `@module-federation/runtime` host: it fetches the web module list from the server, registers each listed remote, loads its `./module` entry, checks it with `validateWebModule` and mounts its routes under `/$plant`. The shell hands every remote its own React, router, Apollo Client and `@northmes/web-sdk`, the singletons in `packages/web-build/shared.mjs`, so a remote bundles none of them. A remote bundles its own copy of `zod`, `@northmes/contracts` and the contracts packages it imports (ADR 0062). The planning remote is the first; the files below are that remote.

## Files

The remote, in the order a new one builds them:

1. `modules/planning/contracts/src/links.ts`: `planningLinks = defineModuleLinks('planning', { board: { path: 'board' } })`, the module's link manifest (ADR 0062). The first argument is the module id, which `linkEntry(planningLinks).path` returns.
2. `modules/planning/web/package.json`: `@northmes/planning-web`, AGPL and private, with the scripts `build` (`vite build`), `lint` and `typecheck`. `dependencies` hold what the remote bundles: `@northmes/contracts`, `@northmes/planning-contracts` and `zod`. `devDependencies` hold `@northmes/web-build`, the singleton packages with their peers (`@northmes/web-sdk`, `react`, `react-dom`, `@tanstack/react-router`, `@apollo/client`, `graphql`, `graphql-ws`, `rxjs`) for types and tests, `vite` and the test libraries.
3. `modules/planning/web/vite.config.ts`: `export default defineRemoteConfig({ id: 'planning', version })` from `@northmes/web-build/remote`, with `version` imported from `modules/planning/package.json`, the file the module manifest reads its version from.
4. `modules/planning/web/tsconfig.json`: includes `src`, `test` and `vite.config.ts`, with `allowJs`, because `@northmes/web-build` is `.mjs` with JSDoc types.
5. `modules/planning/web/src/routes.tsx`: `planningRoutes(plantRoute)`. The top route's path is `linkEntry(planningLinks).path` and the board route's is `linkEntry(planningLinks.board).path`, nested under it, so each path is written once, in the link manifest.
6. `modules/planning/web/src/module.tsx`: the default export `defineWebModule({ id: 'planning', version: '0.0.0', routes: planningRoutes })`. The version is a string literal equal to the version in `modules/planning/package.json`; the build compares the two.
7. `modules/planning/web/src/board-screen.tsx`, `board.graphql.ts` and `release.graphql.ts`: the screen and its typed documents, `gql` from `@apollo/client` as a `TypedDocumentNode` with hand-written types until GraphQL codegen arrives. Hooks come from `@apollo/client/react`. Each row, and each cell the end-to-end specs read, carries a `data-testid` named after the order number. The screen imports no stylesheet.
8. `modules/planning/northmes.module.ts`: `web: { label: 'Planning', order: 20 }` puts the module in the web module list and the menu.

The tests of the remote, all in the `web` project:

- `modules/planning/web/test/module.test.tsx`: the module passes `validateWebModule` for the entry the server lists (id `planning`, the version of `modules/planning/package.json`), and `planningLinks.board({ plant }).href` opens the board stub in a router built with `createShellRoutes` inside a `MockedProvider`.
- `modules/planning/web/test/routes.links.test.tsx`: the fullPath of every route in the shell's tree equals `/`, `/$plant` or the pattern of a `planningLinks` entry, and every entry has its route.
- `modules/planning/web/test/board-screen.test.tsx`: the screen with a `MockedProvider` that answers each document once.

What every remote shares:

- `packages/web-build/remote.mjs`: `defineRemoteConfig`. It sets `base` to `/modules/<id>/<version>/`, names the remote after the module id in camel case (`production-start` becomes `productionStart`), writes `remoteEntry.js` and `mf-manifest.json`, exposes `./module` with `dts: false` and runs the three guards.
- `packages/web-build/shared.mjs`: the singleton list, each key shared with `import: false` and `requiredVersion: false`. `apps/web/src/federation.ts` registers the shell's own module for each key, and `apps/web/test/shared.test.ts` keeps the two lists equal.
- `packages/web-build/guards.mjs`: `northmes:no-bundled-singletons`, `northmes:no-remote-css` and `northmes:web-module-version`, tested in `packages/web-build/test/guards.test.ts` on the fixture remotes in `packages/web-build/test/fixtures/`.
- `packages/web-sdk/src/web-module.ts` and `routes.ts`: `defineWebModule`, `validateWebModule`, `createShellRoutes` and the `PlantRoute` type.
- `apps/web/src/federation.ts`, `shell.tsx` and `menu.tsx`: `loadModules`, the placeholder route of a module that failed to load, and the menu.
- `apps/server/src/web/static-mounts.ts` and `served-web.ts`: the server serves `web/dist/` of the module's package at `/modules/<id>/<version>/` and lists the module with the SHA-384 of its `mf-manifest.json`, or `integrity: null` when that file or a file it lists is missing.
- `scripts/lint/path-literals.mjs`, run by `test/meta/path-literals.test.ts`: fails an app path written as a literal in a `to` or `href`, a `navigate` or `redirect` option, or a `goto` call. A path comes from a link builder's `to` or `href`.

## Commands

- `pnpm exec turbo run build --filter=@northmes/planning-web`: the remote and the packages it builds against. It writes `modules/planning/web/dist/` with `mf-manifest.json`, `remoteEntry.js` and `assets/`. A plain `vite build` in the package resolves the contracts packages to their `dist/`, so build through turbo, which builds them first.
- `pnpm build`: every package, the shell and every remote.
- `pnpm exec vitest run --project web modules/planning/web/test`: the remote's tests.
- `pnpm exec vitest run --project unit packages/web-build/test/guards.test.ts`: the guard tests.
- `pnpm --filter @northmes/planning-web run typecheck`; `lint` runs the same way.
- `pnpm check`: the gate before the work is handed over. It does not build the remotes.

## Building a remote

1. Declare the module's link manifest in its contracts package with `defineModuleLinks('<id>', entries)` and export it from `src/index.ts`. Write each entry's `path` below its parent, each segment a literal or one `$param`.
2. Write `modules/<id>/web/package.json` as above. Add only workspace packages (`workspace:*`) and catalog entries (`catalog:`), then run `pnpm install`.
3. Write `vite.config.ts` with `defineRemoteConfig({ id, version })` and the version imported from the module's `package.json`, and `tsconfig.json` with `allowJs`.
4. Write `routes.tsx`. Take every route's path from `linkEntry(<id>Links...)`, the top route's from the manifest itself, and nest each route under the route of its parent entry. A route's component is the screen.
5. Write `module.tsx` with `defineWebModule({ id, version, routes })`. Repeat the module's version as a string literal.
6. Write the screens. Import singleton packages through their share keys only: `react`, `react-dom`, `react/jsx-runtime`, `@tanstack/react-router`, `@apollo/client`, `@apollo/client/react` and `@northmes/web-sdk`. Test files may import other subpaths, such as `@apollo/client/testing/react`, because the build never sees them. Read the plant with `useShell()` and build links with the link manifest's builders.
7. Add `web: { label, order }` to the module manifest.
8. Test the module with `validateWebModule`, the routes against the link manifest, and each screen with `MockedProvider`. Start each test name with the story id, such as `E02-S05`.
9. Build through turbo and check that `dist/` holds `mf-manifest.json` and `remoteEntry.js`.

A test that runs `vite build` on a remote stubs `MFE_VITE_NO_TEST_ENV_CHECK` to `true`: `@module-federation/vite` returns no plugins when it finds `VITEST` in the environment.

## Errors and their meaning

### Build

Vite prints the plugin's name before the message, such as `[plugin northmes:no-bundled-singletons]`.

- `this remote bundles <packages>. The shell provides the singleton packages and graphql once (ADR 0019)...`, followed by one line per package with a file and the chunk that holds it: a chunk holds code from a singleton package or from `graphql`. The usual cause is an import of a subpath outside the share keys, such as `@apollo/client/cache`, which also pulls in `graphql`, or a path into a workspace package's `src/`. Import the share key instead. A subpath every remote needs joins `shared.mjs` and the shell's `shellModules` together.
- `this remote emits CSS (<files>). A remote under modules/*/web imports no stylesheet...`: a module of the remote, or a package it bundles, imports a stylesheet. Remove the import; the shell's one stylesheet covers the remote's classes.
- `defineWebModule in ./src/module.tsx declares version <a>, but the module manifest declares version <b> (ADR 0003).`: change the literal in `module.tsx` together with the version in the module's `package.json`.
- `the build reads the version as a string literal from defineWebModule in ./src/module.tsx, and finds none...`: the version is an expression or an import. Write it as a string literal.
- `Could not find a declaration file for module '@northmes/web-build/remote'` from `tsc`: the remote's `tsconfig.json` lacks `allowJs`.

### Load in the shell

The shell logs `NorthMES could not load the <id> module: <problem>` in the browser console. Every path under `/$plant/<id>` then shows `The <label> module could not be loaded.`, the menu shows `<label> (unavailable)` at the module's position, and the other modules work. The problems:

- `[ Federation Runtime ]: Failed to get manifest. #RUNTIME-003`, with the `manifestUrl` in its args: the server answered the manifest URL with something other than a manifest, usually a 404 because the remote is not built and its `web/dist/` is missing. The module list then shows the module with `integrity: null`.
- `[ Federation Runtime ]: Failed to load script resources. #RUNTIME-008`, with the `resourceUrl` of `remoteEntry.js`: the manifest loaded, but the entry did not. The runtime takes the entry's URL from the manifest's `publicPath`, so a `dist/` built before the module's version changed asks for `/modules/<id>/<old version>/remoteEntry.js`, which the server does not mount; build again. With the current version in the URL, `dist/` is incomplete.
- `[ Federation Runtime ]: The getter for the shared module is not a function... #RUNTIME-012`: the remote asked for a share key, declared with `import: false`, that the shell did not register. `shared.mjs` and the shell's `shellModules` disagree, which `apps/web/test/shared.test.ts` fails on.
- `version is <a>, expected <b> from the server entry`: the remote's `defineWebModule` declares another version than the manifest the server read. A build through `defineRemoteConfig` fails on that, so the remote was built some other way.
- `id is <a>, expected <b> from the server entry`: the `id` in `module.tsx` differs from the manifest's id.
- `the top route path is <a>, expected the module id <b>`: the top route does not take its path from `linkEntry(<id>Links).path`, or `defineModuleLinks` got another id.
- `the module is missing, expected an object`, `routes is missing, expected a function` or `routes did not return a route`: `module.tsx` has no default export, or it does not come from `defineWebModule` with a `routes` function that returns the module's top route.

### Screens and tests

- `useShell() found no ShellProvider: the shell and this module hold two copies of @northmes/web-sdk`: in the shell, the remote bundled `@northmes/web-sdk`, which the build guard fails on. In a test, the screen rendered outside a `ShellProvider`.
- `routes.links.test.tsx` lists a pattern the routes lack, or a fullPath with no entry: a link entry has no route, a route takes a path that is not its entry's, or a route hangs under the wrong parent.
- `path-literals` reports `<file>:<line>: <literal>`: an app path is written as a literal. Build it with the link manifest, or list it in `scripts/lint/path-literals.allow.json` with a reason.
