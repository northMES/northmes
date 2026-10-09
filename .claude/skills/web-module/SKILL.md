---
name: web-module
description: NorthMES recipe for a module's screens in apps/web/src/modules/<id>, the one static web app. Use when adding a module's web part, a route, a screen or a link entry, when the module boundary check fails, or when the web cannot reach the API.
---

# Web module

The web is one Vite React app in `apps/web`, built once to static files. Each module's screens live in `apps/web/src/modules/<id>`, and `apps/web/src/modules.ts` lists the modules the web is built with. One TanStack Router tree holds every module's routes under `/$plant`, and each module's screens load lazily as one chunk. The planning module is the first; the files below are its.

## Files

- `apps/web/src/modules/planning/index.ts`: the module's public api, `planningModule = defineWebModule({ id, version, routes })`. The shell and other modules import the module from this file only.
- `routes.tsx`: `planningRoutes(plantRoute)`. Each route's path comes from `linkEntry(planningLinks...)`, the top route's from the manifest itself (ADR 0062). Each component is `lazyRouteComponent(() => import('./screens.ts'), '<Screen>')`.
- `screens.ts`: re-exports every screen, so the build puts them in one chunk.
- `board-screen.tsx`, `board.graphql.ts`, `release.graphql.ts`: the screen and its typed documents, `gql` from `@apollo/client` as a `TypedDocumentNode`.
- `apps/web/src/modules.ts`: one `{ module, label, order }` entry per module. `label` and `order` repeat the web block of the module's manifest.
- `apps/web/src/config.ts`: `loadWebConfig` reads `/config.json` at boot. `{ "apiUrl": "https://mes.example.com" }` sends the client's requests to `<apiUrl>/graphql`; without the file the API is on the page's origin.
- `apps/web/vite.config.ts`: in dev, proxies `/graphql` and `/api` to `NORTHMES_API_ORIGIN`, WebSockets included, and resolves workspace packages to their source (ADR 0058).

Tests:
- `apps/web/test/modules/planning/`: the board link opens the board, every `planningLinks` entry matches a route `fullPath`, and the screen with a `MockedProvider` that answers each document once.
- `apps/web/test/shell.test.tsx`, `config.test.ts`, `vite-config.test.ts`, `build.test.ts`: the shell, config.json, the dev proxy, and a build whose manifest has `src/modules/<id>/screens.ts` as a dynamic entry.
- `test/meta/module-boundaries.test.ts` runs `scripts/lint/module-boundaries.mjs`.
- `test/meta/path-literals.test.ts` runs `scripts/lint/path-literals.mjs`: an app path comes from a link builder's `to` or `href`, never a literal.

## Adding a module's web part

1. Declare the module's link manifest in its contracts package with `defineModuleLinks('<id>', entries)` and export it from `src/index.ts`.
2. Write `apps/web/src/modules/<id>/routes.tsx`, `screens.ts`, the screens and `index.ts` as planning does. Add the contracts package to `apps/web/package.json` (`workspace:*`) and run `pnpm install`.
3. Add the module to `apps/web/src/modules.ts` with the label and order of its manifest's web block.
4. Test the routes against the link manifest and each screen with `MockedProvider`. Start each test name with the story id.
5. Add the module's screens chunk to `apps/web/test/build.test.ts`.

## Commands

- `pnpm dev`: the stack, the server and one Vite dev server for the web, and the board URL of the seeded plant.
- `pnpm exec turbo run build --filter=@northmes/web`: builds the workspace packages the web imports, then writes `apps/web/dist/` with `index.html` and `assets/`. A host adds `config.json` next to `index.html` when the API is on another origin.
- `pnpm exec vitest run --project web --project unit apps/web/test`: the web's tests.
- `pnpm check`: the gate before the work is handed over.

## Errors and their meaning

- `<file>:<line> imports ../<other>/<path>` from `module-boundaries`: a module imports another module's internal file. Import from the other module's `index.ts` or `api.ts`, and export what you need there.
- `NorthMES failed to start: config.json: apiUrl must be an absolute http or https URL, got <value>`: the host's `config.json` names a relative or non-http URL. Write the full URL or leave `apiUrl` out.
- A screen that loads but whose queries fail with a network error in dev: `NORTHMES_API_ORIGIN` is unset, so the dev server forwards nothing. Start the web through `pnpm dev`.
