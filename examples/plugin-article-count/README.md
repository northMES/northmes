# Example plugin: article count widget

A drop-in plugin with one dashboard widget: Article count, which shows how many articles the plant has. Use it to try out a plugin install, and as a starting point for a widget of your own.

What it shows:

- A contribution in the manifest. `src/manifest.ts` lists the widget under `web.contributes`, with its id, the slot `core/dashboard/widgets/v1`, its label, its order and the permission a user needs to see it, `core.article:read` (ADR 0068). The host reads this data before any plugin code runs.
- The widget's code by the same id. `src/web.tsx` default-exports a web module whose `contributions` hold the widget's component under `example-article-count.count`. The web module has no routes, so the plugin adds no page and no sidebar group.
- A read through the shell. The widget imports `gql` and `useQuery` from `@apollo/client`, which the web app's import map hands it (ADR 0075), so the query runs through the shell's client: signed in as the user, at the plant in the URL, and under the same permission checks as any other read.

## Build and install

From the repository root:

```sh
pnpm plugin:build example-article-count
```

This builds `dist/manifest.js` and `web/entry.js` and copies the installable package to `plugins/example-article-count/`. To load the plugin:

1. List the folder in `northmes.config.json` at the repository root:

   ```json
   { "plugins": ["plugins/example-article-count"] }
   ```

2. Restart the server. The plugin has no migrations.

Sign in, open a dashboard tab you may change, such as My shift, and select Edit layout, then Add widget. The catalog lists Article count under the plugin's label. Add it and select Done. The widget shows the number of articles at the plant that are not archived, the same number the Articles list shows.

A user without `core.article:read` at the plant does not see the widget in the catalog. A placed widget whose plugin is removed or does not load says it is unavailable, and the rest of the dashboard works as before.

## Test

```sh
pnpm build && pnpm exec playwright test e2e/plugin-widget.spec.ts
```

The spec's server builds and loads the plugin. It then signs in, adds the widget to My shift, saves the tab and reloads it. `pnpm e2e` runs it with the other specs.
