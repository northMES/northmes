# Example plugin: sidebar page

A drop-in plugin with screens only: it adds a Hello group to the sidebar, with one entry that opens its own page under the plant. Use it to try out a plugin install, and as a starting point for a plugin with screens.

What it shows:

- The manifest's `web` block. `src/manifest.ts` gives the sidebar group's label, its icon by lucide name (ADR 0067) and its place among the modules' groups. The plugin has no server part, so the manifest has no `server` entry.
- A web part. `src/web.tsx` default-exports a web module, `defineWebModule` from `@northmes/web-sdk`, whose routes add one page at `/<plant>/example-sidebar-page`.
- Shared packages. The page imports `react`, `@tanstack/react-router` and `@northmes/web-sdk` by name. The plugin build leaves those imports in place, and the web app's import map hands the plugin the web app's own copies, so hooks such as `useShell` work inside the shell (ADR 0075). The shared names are `HOST_PROVIDED_WEB` in `@northmes/web-sdk`. The build bundles any other package, and fails when it cannot.

## Build and install

From the repository root:

```sh
pnpm plugin:build example-sidebar-page
```

This builds `dist/manifest.js` and `web/entry.js` and copies the installable package (`package.json`, `dist/`, `web/`) to `plugins/example-sidebar-page/`. To load the plugin:

1. List the folder in `northmes.config.json` at the repository root:

   ```json
   { "plugins": ["plugins/example-sidebar-page"] }
   ```

2. Restart the server. The plugin has no migrations, so `pnpm northmes migrate` has nothing to do for it.

Sign in, and the sidebar shows Hello after the in-repo modules. Its page says hello, and Say hello counts.

When the server starts, it serves the plugin's `web/` folder at `/api/v1/web/plugins/example-sidebar-page/<version>/`. After sign-in, the web app reads the list of plugins with screens from `/api/v1/web/plugins` and imports each entry before it builds its routes. A plugin that does not load shows an "(unavailable)" entry and a page that says so, and the rest of NorthMES works as before.

A Docker Compose installation gets plugins through the `plugins` volume and npm, as the [plugin guide](../../apps/docs/plugins.mdx) describes. That route arrives in a release after 0.0.1.

## Test

```sh
pnpm exec playwright test e2e/plugins.spec.ts
```

The spec's server builds and loads the plugin. It then signs in, opens Hello from the sidebar, and presses Say hello. `pnpm e2e` runs it with the other specs.
