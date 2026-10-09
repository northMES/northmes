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
- `screens/board/`: `board-screen.tsx`, its row `order-row.tsx`, and the operations `board.graphql.ts` and `release.graphql.ts`, each with the typed document that `pnpm gen` writes next to it (`board.graphql.gen.ts`, `release.graphql.gen.ts`). See [Queries and mutations](#queries-and-mutations).
- `apps/web/src/modules.ts`: one `{ module, label, order, links }` entry per module. It is the only source of the menu's label and order; the backend modules carry no manifest (ADR 0070). Each link is a sidebar entry with its `label`, its `icon` (a name from `navIconNames` in `ui/lib/nav-icon-names.ts`, ADR 0067) and its link builder.
- `apps/web/src/shell/`: the D2 shell (`docs/design/shell/shell-190-navigation.md`) that the `$plant` route renders: `shell.tsx` (`createShellRouter`, the skip link, focus on a path change), `shell-sidebar.tsx` (the module groups, the rail and the 320 px sheet on shadcn's Sidebar), `shell-top-bar.tsx`, `shell-user-menu.tsx` and `shell-plant-switcher.tsx` (the switcher at the top of the sidebar, ADR 0067). The shell reads the user's companies and plants with `companies.graphql.ts` through an Apollo client that names no plant, names the plant in the first crumb and the title, and shows Plant not found for a slug that is none of the user's plants. The `$plant` segment is the plant's slug: a screen reads it as `useShell().plant` and passes it to its link builders as `plant`, and the plant's Apollo client sends it in `x-northmes-plant`. A screen's `PageFrame` renders its breadcrumb and page actions into the top bar, so a screen passes `crumbs` for the pages between its module and itself.
- `apps/web/src/auth/`: sign-in (#391). `auth-session.ts` keeps Better Auth's session token in the tab's sessionStorage and mints the API's short-lived JWT from `/api/auth/token`; `createShellRouter` takes the session, signs every Apollo request in with the JWT, sends a viewer without a session to `/sign-in` with the page in `redirect`, and does the same on a 401. `sign-in-link.ts` holds `signInPath`; `sign-in-screen/` is the page (D2, SI1 to SI9 and SI19). A test renders the shell with `fakeSession()` from `apps/web/test/auth/fake-session.ts`.
- `apps/web/src/config.ts`: `loadWebConfig` reads `/config.json` at boot. `{ "apiUrl": "https://mes.example.com" }` sends the client's requests to `<apiUrl>/graphql`; without the file the API is on the page's origin.
- `apps/web/components.json`: the shadcn CLI's config (Base UI, Tailwind 4, the `#ui/*` alias of `apps/web/package.json`). A primitive in `apps/web/src/ui/primitives` comes from `pnpm -C apps/web exec shadcn add <component>`, never written by hand; its helpers and hooks land in `apps/web/src/ui/lib`. A generated file is edited only for the D1 tokens or a NorthMES rule, with a `NorthMES edit:` comment, and `pnpm exec biome check --write apps/web` formats it. Every file imports `cn` from the `cn` package. A NorthMES rule that shadcn lacks, such as IconButton's required label, is a component in `ui/components` built on the primitives.
- `apps/web/codegen.ts`: the GraphQL Code Generator config that `pnpm gen` runs, with the `typescript-operations` and `typed-document-node` plugins and the options Apollo Client's codegen guide recommends.
- `apps/web/vite.config.ts`: in dev, proxies `/graphql` and `/api` to `NORTHMES_API_ORIGIN`, WebSockets included, and resolves workspace packages to their source (ADR 0058).

Tests:
- `apps/web/test/modules/planning/`: the board link opens the board, every `planningLinks` entry matches a route `fullPath`, and the screen with a `MockedProvider` that answers each document once.
- `apps/web/test/ui/primitives/`, `components/` and `lib/`: one test file per `src/ui` piece, in the folder that mirrors its own.
- `apps/web/test/codegen.test.ts`: one `.graphql.gen.ts` per operation file, a field the schema drops fails `pnpm gen`, and a field whose type changes fails the typecheck of the screen that reads it.
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
    restore-article.graphql.ts           run by the article and edit screens
    article-list-search.ts               the list's URL search, read by routes.tsx
    screens/
      articles/      index.ts, articles-screen.tsx, articles.graphql.ts
      article/       index.ts, article-screen.tsx, article-actions.tsx, archive-article.graphql.ts
      new-article/   index.ts, new-article-screen.tsx, create-article.graphql.ts
      edit-article/  index.ts, edit-article-screen.tsx, update-article.graphql.ts
    components/
      article-form/  index.ts, article-form.tsx, article-form-summary-button.tsx, article-save-errors.ts
  ui/
    primitives/  button.tsx, input.tsx, field.tsx, input-group.tsx, table.tsx, tooltip.tsx,
                 checkbox.tsx, badge.tsx, alert-dialog.tsx, ... (shadcn)
    components/  icon-button/, text-field/, search-field/, data-table/, page-frame/, error-summary/,
                 confirm-dialog/
    lib/         field-id.ts, announce.ts, use-zod-form.ts
```

Names and places:

- Directory and file names are kebab-case. A component file is named after the component it exports: `article-form.tsx` exports `ArticleForm`.
- A component carries a domain name and lives in its module's folder. `apps/web/src/ui` holds the domain-free pieces: `ui/primitives` shadcn's single-concern ones, one file each; `ui/components` the composites, one folder each; `ui/lib` the helpers and hooks that render nothing. A module's composite moves to `ui/components` once two modules render it identically.
- Each screen has its folder `screens/<screen>/`: `<screen>-screen.tsx`, the documents only that screen runs (`<operation>.graphql.ts`, one named operation per file, each with its generated `<operation>.graphql.gen.ts`, which the tree above leaves out), its helpers and parts, and `index.ts`, which exports the screen.
- A composite component has its folder `components/<component>/`: `index.ts`, `<component>.tsx`, its parts as `<component>-<part>.tsx` (`article-form-summary-button.tsx`, a `<component>-row.tsx`), and `<operation>.graphql.ts` for the documents only that component runs.
- Code in `src` imports a screen or component folder through its `index.ts`, and a `ui/primitives` or `ui/lib` file by its own path. Tests under `apps/web/test` import a document they mock from the file that holds it.
- The module root holds the wiring and the code that `routes.tsx` or several screens read: a shared document, a hook, a list's URL search. `routes.tsx` imports root files only and the screens through the lazy `screens.ts`, which keeps every screen in the module's chunk.

Behaviour:

- A component is self-contained. The component that triggers an action runs its mutation and cache update: `OrderRow` releases its order, and `NewArticleScreen` writes the created article into `CoreArticle`'s cache. A screen or component imported through an `index.ts`, the shared form below aside, takes ids and runs its own query when it needs data, as each article screen calls `useArticle()`. The parts in a screen's or component's folder (files its `index.ts` does not export) take the record or the rows that the screen's or component's query returned: `Identity` in `article-screen.tsx` takes the article, `OrderRow` takes its order.
- A form that a create and an edit screen share takes values and handlers, not ids, because each screen runs a different command: its form state belongs to each screen. Each screen holds the form state (`useZodForm` with its command's contract), the mutation and its cache update, and passes `ArticleForm` the form, the save and the Cancel target; the form draws the fields, the summary and the buttons.
- A `ui` piece owns no data: it takes values and callbacks, such as `DataTable`'s `onSortChange`.
- Every component that shows data has a loading, an empty and a populated state. A screen hands `PageFrame` a `PageState`: loading shows the content's own skeleton, marked busy; empty names what is missing and the action that leads on; error offers Try again.
- Errors take the shared paths. A failed save goes to the form: `setServerErrors` from `ui/lib/use-zod-form.ts` places the server's `extensions.fieldErrors` on their fields and the rest on the error summary, which `showSaveError` in the article form does. A failed load goes to `PageFrame`'s error state. The shell has no global error handler yet; it comes with the shell's shared toast, which echoes what the page shows inline (plan 06).

## Queries and mutations

An operation file `<operation>.graphql.ts` holds one named operation and re-exports what `pnpm gen` generates for it into `<operation>.graphql.gen.ts` next to it: the typed document, renamed to the operation's name, and the result and variable types. `core/article.graphql.ts`:

```ts
import { gql } from '@apollo/client';
import type { CoreArticleQuery } from './article.graphql.gen.ts';

export {
  CoreArticleDocument as CoreArticle,
  type CoreArticleQuery,
  type CoreArticleQueryVariables,
} from './article.graphql.gen.ts';

/** An article with the fields the articles pages show and the version an edit sends. */
export type Article = NonNullable<CoreArticleQuery['coreArticle']>;

// What the operation is for. pnpm gen writes its typed document to article.graphql.gen.ts; this
// block never runs.
if (false) {
  gql`
    query CoreArticle($id: ID!) {
      coreArticle(id: $id) { id code name version }
    }
  `;
}
```

To add a query or mutation:

1. Create `<operation>.graphql.ts` in the folder of the screen or component that runs it (the module root when several screens run it), with the operation inside `if (false) { gql`...` }`. Name the operation after its root field in PascalCase: `coreArticles` is `CoreArticles`. Biome allows the constant condition in `*.graphql.ts` files only.
2. Add the `export { <Operation>Document as <Operation>, type <Operation>Query, type <Operation>QueryVariables } from './<operation>.graphql.gen.ts'` lines (`Mutation` and `MutationVariables` for a mutation).
3. Run `pnpm gen`. It prints the backend's schema to `schema/api.graphql`, then writes `<operation>.graphql.gen.ts` for every operation file. Commit both.
4. Pass the document to Apollo's hooks without type arguments: `useQuery(CoreArticle, { variables })`. A type the screen needs comes from the generated types, as `Article` above or `type ArticleRow = CoreArticlesQuery['coreArticles']['edges'][number]['node']`; never write a result or variable type by hand.

After a change to the backend's schema, run `pnpm gen` and fix the typecheck errors it leads to. `pnpm gen --check`, part of `pnpm check`, fails while a generated file differs from what `pnpm gen` writes. Never edit `schema/api.graphql` or a `*.gen.ts` file by hand; on a merge conflict in one, run `pnpm gen`. Biome skips both.

Each `.gen.ts` reads only its own operation file, so it holds the input and enum types its operation uses, and an operation cannot spread a fragment from another file yet.

A custom scalar gets its TypeScript type from `scalars` in `apps/web/codegen.ts`: `DateTime` is a `string`, the ISO 8601 instant the API sends. A scalar without a mapping is `unknown`, so a new scalar in the schema needs its line there.

## Adding a module's web part

1. Declare the module's link manifest in its contracts package with `defineModuleLinks('<id>', entries)` and export it from `src/index.ts`.
2. Write `apps/web/src/modules/<id>/routes.tsx`, `screens.ts`, `index.ts` and a folder per screen, as [Naming and folders](#naming-and-folders) lays them out. Add the contracts package to `apps/web/package.json` (`workspace:*`) and run `pnpm install`.
3. Add the module to `apps/web/src/modules.ts` with its menu label and order.
4. Test the routes against the link manifest and each screen with `MockedProvider`. Start each test name with the story id.
5. Add the module's screens chunk to `apps/web/test/build.test.ts`.

## Commands

- `pnpm gen`: prints the backend's schema to `schema/api.graphql` and writes every operation's `<operation>.graphql.gen.ts`; `pnpm gen --check` names each generated file that differs.
- `pnpm dev`: the stack, the server and one Vite dev server for the web, and the board URL of the seeded plant.
- `pnpm exec turbo run build --filter=@northmes/web`: builds the workspace packages the web imports, then writes `apps/web/dist/` with `index.html` and `assets/`. A host adds `config.json` next to `index.html` when the API is on another origin.
- `pnpm exec vitest run --project web --project unit apps/web/test`: the web's tests.
- `pnpm check`: the gate before the work is handed over.

## Errors and their meaning

- `Cannot query field "<field>" on type "<Type>"` from `pnpm gen`: an operation file selects a field the schema does not have. Fix the operation, or the backend's resolver if the field should exist.
- `gen --check: <n> generated files differ from what pnpm gen writes` with `- <path> is out of date`, `is missing` or `is stale: no stage writes it`: run `pnpm gen` and commit the result. A stale `.gen.ts` belongs to an operation file that was moved or deleted; `pnpm gen` removes it.
- `the backend did not build` from `pnpm gen`: the schema stage builds `apps/backend` through turbo first; fix the build error it prints.

- `<file>:<line> imports ../<other>/<path>` from `module-boundaries`: a module imports another module's internal file. Import from the other module's `index.ts` or `api.ts`, and export what you need there.
- `NorthMES failed to start: config.json: apiUrl must be an absolute http or https URL, got <value>`: the host's `config.json` names a relative or non-http URL. Write the full URL or leave `apiUrl` out.
- Every page under a plant shows the sign-in page: the tab has no session. Sign in as the seed's dev admin, `admin` with the password in `scripts/stack/seed.mjs`; the session lasts until the tab closes.
- A screen that loads but whose queries fail with a network error in dev: `NORTHMES_API_ORIGIN` is unset, so the dev server forwards nothing. Start the web through `pnpm dev`.
