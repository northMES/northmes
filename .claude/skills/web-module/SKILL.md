---
name: web-module
description: NorthMES recipe for a module's screens in apps/web/src/modules/<id>, the one static web app. Use when adding a module's web part, a route, a screen, a component or a link entry, when naming or placing a web file, when the module boundary check fails, or when the web cannot reach the API.
---

# Web module

The web is one Vite React app in `apps/web`, built once to static files. Each module's screens live in `apps/web/src/modules/<id>`, and `apps/web/src/modules.ts` lists the modules the web is built with. One TanStack Router tree holds every module's routes under `/$plant`, and each module's screens load lazily as one chunk. The files below are the planning module's; [Naming and folders](#naming-and-folders) lays out a module's folders with core's articles pages.

## Files

- `apps/web/src/modules/planning/index.ts`: the module's public api, `planningModule = defineWebModule({ id, version, routes })`. The shell and other modules import the module from this file only.
- `routes.tsx`: `planningRoutes(plantRoute)`. Each route's path comes from `linkEntry(planningLinks...)`, the top route's from the manifest itself (ADR 0062). Each component is `lazyRouteComponent(() => import('./screens.ts'), '<Screen>')`.
- `screens.ts`: re-exports every screen from its folder's `index.ts`, so the build puts them in one chunk.
- `screens/board/`: `board-screen.tsx`, its row `order-row.tsx`, and the typed documents `board.graphql.ts` and `release.graphql.ts`, `gql` from `@apollo/client` as a `TypedDocumentNode`.
- `apps/web/src/modules.ts`: one `{ module, label, order, links }` entry per module. It is the only source of the menu's label and order, since the backend modules carry no manifest (ADR 0070); each link is a sidebar entry with its `label`, its `icon` (a name from `navIconNames` in `ui/lib/nav-icon-names.ts`, ADR 0067) and its link builder.
- `apps/web/src/shell/`: the D2 shell (`docs/design/shell/shell-190-navigation.md`) that the `$plant` route renders: `shell.tsx` (`createShellRouter`, the skip link, focus on a path change), `shell-sidebar.tsx` (the module groups, the rail and the 320 px sheet on shadcn's Sidebar), `shell-top-bar.tsx` and `shell-user-menu.tsx`. A screen's `PageFrame` renders its breadcrumb and page actions into the top bar, so a screen passes `crumbs` for the pages between its module and itself.
- `apps/web/src/config.ts`: `loadWebConfig` reads `/config.json` at boot. `{ "apiUrl": "https://mes.example.com" }` sends the client's requests to `<apiUrl>/graphql`; without the file the API is on the page's origin.
- `apps/web/components.json`: the shadcn CLI's config (Base UI, Tailwind 4, the `#ui/*` alias of `apps/web/package.json`). A primitive in `apps/web/src/ui/primitives` comes from `pnpm -C apps/web exec shadcn add <component>`, never written by hand; its helpers and hooks land in `apps/web/src/ui/lib`. A generated file is edited only for the D1 tokens or a NorthMES rule, with a `NorthMES edit:` comment, and `pnpm exec biome check --write apps/web` formats it. Every file imports `cn` from the `cn` package. A NorthMES rule that shadcn lacks, such as IconButton's required label, is a component in `ui/components` built on the primitives.
- `apps/web/vite.config.ts`: in dev, proxies `/graphql` and `/api` to `NORTHMES_API_ORIGIN`, WebSockets included, and resolves workspace packages to their source (ADR 0058).

Tests:
- `apps/web/test/modules/planning/`: the board link opens the board, every `planningLinks` entry matches a route `fullPath`, and the screen with a `MockedProvider` that answers each document once.
- `apps/web/test/ui/primitives/`, `components/` and `lib/`: one test file per `src/ui` piece, in the folder that mirrors its own.
- `apps/web/test/shell.test.tsx`, `config.test.ts`, `vite-config.test.ts`, `build.test.ts`: the shell, config.json, the dev proxy, and a build whose manifest has `src/modules/<id>/screens.ts` as a dynamic entry.
- `test/meta/module-boundaries.test.ts` runs `scripts/lint/module-boundaries.mjs`.
- `test/meta/path-literals.test.ts` runs `scripts/lint/path-literals.mjs`: an app path comes from a link builder's `to` or `href`, never a literal.

## Naming and folders

Core's articles pages show the layout:

```text
apps/web/src/
  modules/core/
    index.ts, routes.tsx, screens.ts     public api and wiring
    article.graphql.ts, use-article.tsx  read by more than one screen
    article-list-search.ts               the list's URL search, read by routes.tsx
    screens/
      articles/      index.ts, articles-screen.tsx, articles.graphql.ts
      article/       index.ts, article-screen.tsx
      new-article/   index.ts, new-article-screen.tsx, create-article.graphql.ts
      edit-article/  index.ts, edit-article-screen.tsx, update-article.graphql.ts
    components/
      article-form/  index.ts, article-form.tsx, article-form-reload-button.tsx, article-save-errors.ts
  ui/
    primitives/  button.tsx, input.tsx, field.tsx, input-group.tsx, table.tsx, tooltip.tsx, ... (shadcn)
    components/  icon-button/, text-field/, search-field/, data-table/, page-frame/, error-summary/
    lib/         field-id.ts, announce.ts, use-zod-form.ts
```

Names and places:

- Directory and file names are kebab-case. A component file is named after the component it exports: `article-form.tsx` exports `ArticleForm`.
- A component carries a domain name and lives in its module's folder. `apps/web/src/ui` holds the domain-free pieces: `ui/primitives` shadcn's single-concern ones, one file each; `ui/components` the composites, one folder each; `ui/lib` the helpers and hooks that render nothing. A module's composite moves to `ui/components` once two modules render it identically.
- Each screen has its folder `screens/<screen>/`: `<screen>-screen.tsx`, the documents only that screen runs (`<operation>.graphql.ts`, one named operation per file), its helpers and parts, and `index.ts`, which exports the screen.
- A composite component has its folder `components/<component>/`: `index.ts`, `<component>.tsx`, its parts as `<component>-<part>.tsx` (`article-form-reload-button.tsx`, a `<component>-row.tsx`), and `<operation>.graphql.ts` for the documents only that component runs.
- Code in `src` imports a screen or component folder through its `index.ts`, and a `ui/primitives` or `ui/lib` file by its own path. Tests under `apps/web/test` import a document they mock from the file that holds it.
- The module root holds the wiring and the code that `routes.tsx` or several screens read: a shared document, a hook, a list's URL search. `routes.tsx` imports root files only and the screens through the lazy `screens.ts`, which keeps every screen in the module's chunk.

Behaviour:

- A component is self-contained. The component that triggers an action runs its mutation and cache update: `OrderRow` releases its order, and `NewArticleScreen` writes the created article into `CoreArticle`'s cache. A screen or component imported through an `index.ts`, the shared form below aside, takes ids and runs its own query when it needs data, as each article screen calls `useArticle()`. The parts in a screen's or component's folder (files its `index.ts` does not export) take the record or the rows that the screen's or component's query returned: `Identity` in `article-screen.tsx` takes the article, `OrderRow` takes its order.
- A form that a create and an edit screen share takes values and handlers, not ids, because each screen runs a different command: its form state belongs to each screen. Each screen holds the form state (`useZodForm` with its command's contract), the mutation and its cache update, and passes `ArticleForm` the form, the save and the Cancel target; the form draws the fields, the summary and the buttons.
- A `ui` piece owns no data: it takes values and callbacks, such as `DataTable`'s `onSortChange`.
- Every component that shows data has a loading, an empty and a populated state. A screen hands `PageFrame` a `PageState`: loading shows the content's own skeleton, marked busy; empty names what is missing and the action that leads on; error offers Try again.
- Errors take the shared paths. A failed save goes to the form: `setServerErrors` from `ui/lib/use-zod-form.ts` places the server's `extensions.fieldErrors` on their fields and the rest on the error summary, which `showSaveError` in the article form does. A failed load goes to `PageFrame`'s error state. The shell has no global error handler yet; it comes with the shell's shared toast, which echoes what the page shows inline (plan 06).

## Adding a module's web part

1. Declare the module's link manifest in its contracts package with `defineModuleLinks('<id>', entries)` and export it from `src/index.ts`.
2. Write `apps/web/src/modules/<id>/routes.tsx`, `screens.ts`, `index.ts` and a folder per screen, as [Naming and folders](#naming-and-folders) lays them out. Add the contracts package to `apps/web/package.json` (`workspace:*`) and run `pnpm install`.
3. Add the module to `apps/web/src/modules.ts` with its menu label and order.
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
