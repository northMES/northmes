# Example plugin: article log

A drop-in plugin that writes a line to the server log, and a row to its own table, each time an article is created, updated, archived or restored. NorthMES never deletes an article: archiving takes its place. Use it to try out a plugin install, and as a starting point for a plugin that reacts to events.

What it shows:

- An event consumer. `src/server.ts` lists one `EventConsumer` per article event from `@northmes/core-contracts`. The host runs each consumer once per event, after the command commits, on the worker (ADR 0014).
- A plugin's own schema. `migrations/` creates `example_article_log.entry`. `northmes migrate` runs the file as the plugin's own owner role, `nm_mod_example_article_log`. Row-level security keeps each row at the article's edit scope.
- Writing in the consumer's transaction. A consumer writes through `ctx.tx`. That transaction runs at the event's scope and also records the event in `core.inbox`, so a job that runs twice writes one row.

## Build and install

From the repository root:

```sh
pnpm plugin:build example-article-log
```

This builds `dist/` and copies the installable package (`package.json`, `dist/`, `migrations/`) to `plugins/example-article-log/`. To load the plugin:

1. List the folder in `northmes.config.json` at the repository root:

   ```json
   { "plugins": ["plugins/example-article-log"] }
   ```

2. Run `pnpm northmes migrate`. It creates the plugin's schema and table.
3. Restart the server.

Create or edit an article, and the server log shows a line such as:

```text
[ExampleArticleLog] core.article.updated BR-140 Wall bracket, left (version 2)
```

A Docker Compose installation gets plugins through the `plugins` volume and npm, as the [plugin guide](../../apps/docs/plugins.mdx) describes. That route arrives in a release after 0.0.1. Once it is in place, this example installs the same way from its packed file.

## Test

```sh
pnpm exec vitest run --project integration examples/plugin-article-log
```

The test loads the plugin from source next to core and runs its migration. It then creates, updates, archives and restores an article, and reads the four entries back.
