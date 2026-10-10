---
status: "proposed"
date: 2026-10-10
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson; internal research notes 08, 19 and 32; the planning session's comparison of VS Code, Mattermost, Grafana, Backstage with Red Hat Developer Hub, Directus, Discourse and WordPress; the planning session's import map spike of 2026-10-10, kept with the internal research spikes
informed: plugin authors, hosting partners, pilot IT, contributors and coding agents
release: "1"
needs-confirmation: "maintainer (how a hosting partner controls plugin installs, left open; core.plugin:manage as a company-level permission that Company admin holds under M-61, for an install that reaches every company of the installation, with the requests in one installation-wide table; the plugin archive format, its signing scheme, trusted keys bound to plugin ids and the indexes as installation settings, with no project key in release 1; plugin screens as ES modules through one hashed import map, with the plugin list behind a session and a full page load after sign-in; the host step plugins.sh on a systemd timer with an apply window, a host lock and the one-off plugins service; the part of the UI kit that becomes MIT @northmes/ui; @northmes/plugin-build as an MIT package; the plugin drift of northmes apply with exit 4; the ADR 0055 ledger rows); lawyer (the ADR 0056 exception and bundling clause for plugin archives installed at run time and handed out through an index; the trademark policy for a NorthMES plugin index)"
---

# Plugin installs from signed archives into a plugin volume, with plugin screens loaded at run time

## Context and problem statement

[ADR 0037][adr-0037] decided that plugins are drop-in packages loaded at boot into the official image, and that the pilot's supported path is a site image `FROM ghcr.io/northmes/northmes:<v>` with `COPY plugins/`, tagged per upgrade, so that a rollback returns to the previous site image. Proposed [ADR 0070][adr-0070], as first drafted in PR #368, built plugin web contributions into `apps/web` in release 1. Both paths needed a build: a site image for any plugin, and a web build for a plugin's screens. On main at efcb6feb the backend reads plugin paths from `northmes.config.json`, `pnpm plugin:build` builds a manifest and a server part only, and nothing signs, downloads or installs a plugin.

On 2026-10-10 Krister Johansson stated the goal. A customer whose NorthMES runs as a hosted service, or in a Docker container, may have no access to the source code and must still be able to install a plugin. A customer who hosts NorthMES, clones the repository, installs packages and modifies the code can do that too, but then owns making upgrades work. This ADR reads it as: a plugin installs into the official, unmodified image, hosted or self-hosted, without the source code and without a rebuild, the way VS Code installs an extension. Forking and modifying NorthMES stays possible, and whoever forks owns the upgrades.

Asked who installs a plugin, he answered "yes the admin". He added that a hosting partner which hosts customer installations and guarantees their uptime may want control, so that a customer does not install plugins freely, and asked whether such a partner could keep the top admin role and give the customer a normal admin role that can create items. Asked whether plugin screens load at run time already in release 1, he answered "yes have it in release 1".

In the same conversation the planning session proposed one signed archive per plugin version, installation from an index, a link or a file, a plugin volume beside the unchanged image, the install steps, a check before a NorthMES upgrade, and full trust inside one customer's installation, and he did not object. Those proposals and the details this ADR adds to them wait for his confirmation.

This ADR decides how a plugin reaches an installation, where its files live, who installs it and how, how its screens reach the page, what is checked when, and how a rollback restores plugins. It covers `@northmes/plugin-build` and `pnpm plugin:build`, the `northmes plugin` CLI commands, a one-off Compose service and a host script in the release bundle, core's Plugins page, its commands and its request table, the boot steps that load plugins, the plugin list, staging and file routes under `/api/v1/web/plugins`, the shell's plugin loader and import map in `apps/web`, `@northmes/web-sdk`, `@northmes/ui`, the Compose services of [ADR 0044][adr-0044] and the upgrade and rollback scripts of [ADR 0045][adr-0045]. It builds on proposed ADR 0070 and waits for it.

## Decision drivers

* Krister Johansson's goal of 2026-10-10: a plugin installs into the official, unmodified image without the source code and without a rebuild.
* His answer "yes the admin": the customer's admin installs a plugin.
* His decision "yes have it in release 1": plugin screens load at run time in release 1, and adding a plugin's screens needs no web build.
* The official image stays unchanged and signed ([ADR 0037][adr-0037], [ADR 0050][adr-0050]).
* `app` holds no database owner password and runs with a read-only file system, and migrations run only in the one-off `migrate` service ([ADR 0047][adr-0047], [ADR 0044][adr-0044], [ADR 0002][adr-0002]).
* Nest builds the schema once, so every plugin change restarts the process ([ADR 0037][adr-0037], [ADR 0070][adr-0070]).
* A rollback restores the plugin files that belong to the image it returns to. The stress test found this gap before ADR 0037 closed it with the site image (internal research note 32).
* A restart that stops the plant's users runs between shifts, and never in the week of a daylight saving change ([ADR 0045][adr-0045]).
* A plant may have no internet access ([ADR 0044][adr-0044]).
* No role sits above a company, and the installation-wide settings belong to the CLI on the host (M-60, [ADR 0066][adr-0066]).
* An item enters release 1 only through the ledger of [ADR 0055][adr-0055].

## Considered options

How a plugin reaches an installation:

* Plugin archives in a plugin volume: signed archives installed beside the official image, from an index, a link or a file, by an admin on a Plugins page or by the CLI, and applied by a host step
* A site image: an image built `FROM` the official image, as ADR 0037 decides for the pilot
* CLI-only installs: plugin archives in a plugin volume, installed only through the CLI on the host

How plugin screens reach the page:

* An import map: native ES modules, with the shared packages bound through one inline import map
* Module Federation: the Module Federation 2 runtime
* A host registry: a registry on `globalThis`, with binding code that the plugin build generates
* Built into apps/web: plugin web contributions built into `apps/web`, as the first draft of proposed ADR 0070 decided
* Iframes: each plugin's screens in a sandboxed iframe

## Decision outcome

Chosen option for how a plugin reaches an installation: "Plugin archives in a plugin volume", because it is the only option in which a customer without the source code, a build tool or shell access to the host adds a plugin to the official image, while `app` keeps its read-only file system and holds no owner password.

Chosen option for plugin screens: "An import map", because it needs no runtime code in `apps/web`, a stock Vite library build produces the plugin's web part, and a spike showed one React instance and no CSP violation across two origins in Chromium and Firefox. Module Federation would bring back what ADR 0070 removes, and iframes cannot share the Apollo cache or host the dense slot kinds of [ADR 0068][adr-0068].

### The plugin archive

A plugin version ships as one signed archive. File names are proposed.

```text
<id>-<version> archive
  northmes-plugin.json   id, version, the NorthMES range, the path and SHA-384 of every other file, the plugin inventory
  northmes-plugin.sig    the publisher's signature over northmes-plugin.json, with the key id
  package.json           exports["./manifest"] and the peer dependency on @northmes/sdk (ADR 0037)
  dist/manifest.js
  dist/server.js         when the plugin has a server part
  migrations/*.sql       its own schema only (ADR 0037)
  web/entry.js           when the plugin has screens, with its hashed chunks and web/style.css
```

* `@northmes/plugin-build` (MIT, name proposed) builds a plugin's server part and web part, packs the archive, signs it and runs the checks of [Build and development loop](#build-and-development-loop), as a library with a command-line entry. A plugin author outside the repository uses it with MIT code only ([ADR 0056][adr-0056]). In the repository, `pnpm plugin:build` and `pnpm plugin:sign` call it.
* `pnpm plugin:build <id>` writes the archive. `northmes-plugin.json` takes the range from `peerDependencies['@northmes/sdk']`, as [ADR 0038][adr-0038] decides for the manifest, and the inventory that `pnpm plugin:check` prints ([ADR 0068][adr-0068]). The installer reads the id, the range and the inventory as data, so it runs no plugin code before an admin accepts the plugin.
* `pnpm plugin:sign <archive> --key <path>` adds the signature, so the private key stays out of the build. The proposal is one compressed tar file per version with `northmes-plugin.sig` inside it, and one Ed25519 key pair per publisher, which Node's `crypto` verifies without a dependency. The archive format, its file extension and the signing scheme wait for the maintainer.
* The file list is exact. The install check, the host step and boot refuse a file that the list lacks, a listed file that is missing, two paths that are equal, also after case folding, an absolute path, a `..` segment, and any entry that is not a regular file or a directory. The unpacker writes only listed files.
* A version never changes: the install check refuses an id and version that an earlier request or a plugin set in the volume recorded with another archive digest.
* An earlier version that lacks a migration which the installed version applied is refused at install, because boot step 5 of [ADR 0002][adr-0002] would refuse the database as newer than the plugin.

### Where plugins come from

* A plugin index: a JSON document at a URL that lists plugins, their versions, each version's NorthMES range, the archive's URL and its digest. NorthMES's own marketplace is one index; a partner or a customer may publish another. The installation reads the indexes listed in the installation setting `plugins.indexes`.
* A direct link to an archive.
* A file, uploaded on the Plugins page or passed to the CLI. A plant without internet access installs this way.

Downloads from an index or a link follow the outbound URL rule for admin-set URLs of [ADR 0047][adr-0047] and the proxy settings of [12 operations and security](../plan/12-operations-and-security.md). The source never decides trust; the signature does.

### The plugin volume and the plugins service

```text
plugins volume           NORTHMES_PLUGIN_DIR; read-write only in the plugins service
  archives/<digest>      each verified archive, named by its digest
  <id>/<version>/        the unpacked archive
  sets/<n>.json          each plugin set: id, version, archive digest and the SHA-384 of northmes-plugin.json per plugin
  current                the number of the set that boot loads
plugin staging volume    NORTHMES_PLUGIN_STAGING_DIR; read-write in app and the plugins service
  <staging id>           an archive that app or the CLI received and checked, which a request names
```

* `plugins` (name proposed) is a one-off Compose service from the same official image as `app`, with `restart: "no"`, like `migrate`. It runs only the `northmes plugin` commands, which read archives, signatures, file lists and inventories as data and never import plugin code. It is the only service that mounts the plugin volume read-write, and it mounts the staging volume read-write. It receives `db_app_password`, to read the installation settings and the plugin requests and to record commands as `nm_app` ([ADR 0072][adr-0072]), and no `db_owner_password`.
* `app` mounts the plugin volume read-only and the staging volume read-write, and keeps `read_only: true` ([ADR 0044][adr-0044]).
* `migrate` mounts the plugin volume read-only and no staging volume. `northmes migrate` and `migrate --check` import every plugin's manifest and server code ([ADR 0002][adr-0002] steps 3 and 6), so plugin code runs there; the read-only mount keeps it from rewriting another plugin's files.
* The official image stays as released. Names and paths are proposed.
* Boot loads the plugins of the current set, plus any plugin that `northmes.config.json` lists by path. A path in the config is a plugin that the host pins: a developer's `plugins/` folder, a CI job, or a host that bind-mounts a built package. The catalog check already refuses a duplicate id ([ADR 0002][adr-0002] step 4), so a pinned plugin and an installed plugin never share one.
* Boot checks each volume plugin before it imports any manifest ([ADR 0002][adr-0002] step 3): the SHA-384 of its `northmes-plugin.json` equals the one the current set records, its signature verifies with the key that `plugins.trustedKeys` binds to its id today, and its files match the file list exactly. A plugin with a server part that fails any check stops boot, as [ADR 0037][adr-0037] decides for a plugin that fails to load. A web-only plugin that fails is listed as unavailable, and boot continues. `northmes plugin list` makes the same checks and reports each result.
* Every role of [ADR 0002][adr-0002] mounts the same volume read-only, so API and worker processes load the same plugins.

### Installing, upgrading and removing

#### The Plugins page

* Core's company settings page Plugins sits at `/settings/$companyId/plugins`, under core's settings root ([ADR 0074][adr-0074]), which makes `plugins` a reserved module id under that ADR's rule.
* It lists the installed plugins with version, source, state and signing key, marks a pinned plugin "Pinned by the host" with no actions, lists the plugins of the configured indexes, offers Install from link and Install from file, and shows the installation's request history: who asked, from which company, when, and the result.
* Install from link, Install from file and an index entry send the archive to `POST /api/v1/web/plugins/staged` (name proposed), a first-party route that accepts the web's JWT ([ADR 0073][adr-0073]). It checks `core.plugin:manage` at the request's company before it reads the body or fetches a URL, and answers 403 otherwise. It streams the archive into the staging volume and refuses, while streaming, an archive above 50 MiB, an unpacked size above 200 MiB or more than 2,000 entries (limits proposed). An admin holds at most one unconfirmed staged archive: a new one replaces it, and `app` deletes it when a check refuses it or one hour after staging when no request names it.
* `app` then makes the checks under [Signature and version checks](#signature-and-version-checks) and shows the plugin inventory of [ADR 0068][adr-0068] from `northmes-plugin.json`: the slots it fills, the commands it vetoes, the events it consumes, the fields it adds, and its permissions, roles, settings and tables. The page also states that the plugin runs with full access in the server and in the page, that it is installed for every company of the installation, that Company admins receive its permissions (M-61), and that NorthMES restarts. For an upgrade it marks what changed against the installed version's inventory.
* The admin confirms with a reason and a time, now or later; the host step applies the request at that time, or at the start of the next apply window after it. The page runs `core.requestPluginInstall` (name proposed), an audited command ([ADR 0051][adr-0051] rule 7).
* An installation has one pending request at a time. A second request is refused, except that a removal request replaces a pending install or upgrade of the same plugin. `core.cancelPluginRequest` (name proposed) cancels a pending request, so a request scheduled for later never blocks an urgent removal.
* To remove, the page runs `core.requestPluginRemoval` (name proposed) after it shows the plugin's inventory and that its tables stay ([ADR 0037][adr-0037]). It refuses to remove a plugin that another installed plugin's `dependsOn` names.
* After the restart the page shows the request's result: applied, or failed with the message of the failed check or boot.

#### Requests, scope and audit

* Each request, cancellation and result is a command whose row carries the scope node of the requesting admin's company, so that company's audit trail shows it. The results that the host step records run with the system principal `core.cli` in the same scope.
* A plugin reaches every company, so each request also has a row in `core.plugin_request` (name proposed): the plugin id, version, archive digest, source, requesting company, due time, state, the set number it produced, the backup label and the result. The row has no scope node. Every company's Plugins page reads the table, and only the plugin commands and the host step write it, through a row-level security allowlist entry with a reason, as [ADR 0066][adr-0066] does for `core.installation_setting`. The one-pending check and the digest check read this table, so both span every company of the installation.
* Each request, cancellation, applied change, failed apply and rollback also records a security event with no scope node, as `northmes installation set` does under ADR 0066: `plugin.install_requested`, `plugin.removal_requested`, `plugin.request_cancelled`, `plugin.applied`, `plugin.removed`, `plugin.apply_failed` and `plugin.rolled_back` (names proposed).

#### The CLI and the host step

```text
plugins.sh install <file | URL | index id[@version]> --reason <text> [--at <time>] [--dry-run] [--json]
plugins.sh remove <id> --reason <text> [--at <time>] [--dry-run] [--json]
plugins.sh cancel <request id> --reason <text> [--json]
plugins.sh list [--json]
plugins.sh apply [--timer]
plugins.sh rollback --reason <text>
```

`plugins.sh` (name proposed) ships in the release bundle beside `upgrade.sh` ([ADR 0044][adr-0044]). It runs on the host, and runs each container step with `docker compose run --rm` in the service the table names. For a file on the host it mounts the file read-only into the `plugins` container.

| Container command | Service | Does |
|---|---|---|
| `northmes plugin install`, `remove`, `cancel` | `plugins` | the checks of the page, the inventory printed, and the same request or cancellation with `core.cli` and the required reason, as the CLI commands of [ADR 0066][adr-0066] do; `--dry-run` checks and prints, records nothing and leaves nothing in staging |
| `northmes plugin list` | `plugins` | the installed and pinned plugins, the current set and the boot checks of each volume plugin |
| `northmes plugin due [--timer]` | `plugins` | the due request, if any, under the apply window and the daylight saving rule below |
| `northmes plugin stage <request id>` | `plugins` | verifies the staged archive again, moves it to `archives/`, unpacks its listed files into `<id>/<version>/` and writes set n+1 without making it current; for a removal, writes set n+1 without the plugin |
| `northmes migrate --check --plugin-set <n>` | `migrate` | runs boot steps 1 to 10 with set n without listening, and compares each plugin's inventory, computed as `pnpm plugin:check` computes it, with the signed inventory in its `northmes-plugin.json` |
| `northmes plugin switch <n>` | `plugins` | makes set n current |
| `northmes migrate` | `migrate` | runs the migrations of the current set |
| `northmes plugin record <request id>` | `plugins` | records the result, the set number and the backup label on the request with `core.cli`, and the security event |
| `northmes plugin check` | `plugins` | the plugin compatibility check of [Before a NorthMES upgrade](#before-a-northmes-upgrade) |

Exit codes follow ADR 0066: 0 done, 1 unexpected error, 2 usage error or invalid archive, 3 refused.

A systemd timer runs `plugins.sh apply --timer`, as a timer runs hostcheck ([12 operations and security](../plan/12-operations-and-security.md#hostcheck)). An operator can run `plugins.sh apply` by hand. The host step:

1. takes the host lock, `flock` on `/run/northmes/stack.lock` (name proposed), without waiting, and exits when it cannot, or when `upgrade-state.json` shows an upgrade in progress. `upgrade.sh`, `rollback.sh`, `restore.sh`, the restore drill and the backup timers take the same lock, so no two of them stop `app`, switch plugin sets or take a backup at once;
2. runs `northmes plugin due` and exits when no request is due;
3. runs `northmes plugin stage`, which refuses an archive that fails a check again, because `app` wrote it;
4. runs `northmes migrate --check --plugin-set <n+1>` while `app` still runs, so a plugin that fails to load, fails a catalog check or declares an inventory other than the signed one stops here;
5. runs the pre-flight of `upgrade.sh` step 1: disk space, the last backup under 26 hours old, and `pgbackrest check` ([ADR 0045][adr-0045]);
6. stops `app`, so Caddy's maintenance page answers; when the request runs a migration, takes the labelled backup of `upgrade.sh` step 4; writes `plugin-apply-state.json` (name proposed) beside `upgrade-state.json` with the label, set n, set n+1 and the time; runs `northmes plugin switch <n+1>` and `northmes migrate`; starts `app`; and waits for `/health/ready`;
7. on a failure in step 6, runs `northmes plugin switch <n>`. When migrations ran, it first restores to the backup label, which is exact because nothing wrote after `app` stopped, as for the restore class of `rollback.sh` ([ADR 0045][adr-0045]). Then it starts `app`;
8. runs `northmes plugin record` with the result.

* The apply window: `plugins.applyWindow` (name proposed) holds the weekly times in which the timer applies requests, for example between shifts, and the host sets it with `northmes installation set` once the product owner confirms the window ([ADR 0045][adr-0045]). Until the host sets it, the timer applies nothing, and an operator applies by hand.
* In the week of a daylight saving change in the zone of any plant of the installation, `northmes plugin due` returns no install or upgrade, by timer or by hand, as ADR 0045 rules for NorthMES upgrades. A removal still applies, so a misbehaving plugin can go.
* `plugins.sh rollback` undoes the last applied request after the fact. It refuses when the current set is not set n+1 of `plugin-apply-state.json`. When that apply ran migrations, it runs the restore-class steps of `rollback.sh`: it exports the `audit.command` and `production_start.report` rows written since to a CSV, restores to the label, makes set n current, runs `migrate`, starts `app`, writes the security event and shows the 24-hour banner. Without migrations it makes set n current and restarts `app`. It records a request with `core.cli` and the required reason, so `core.plugin_request` holds the set that is current.
* Every user and station loses the connection while `app` restarts, as during an upgrade. `x-northmes-build` changes with the plugin set, so an open tab shows the reload dialog of [ADR 0018][adr-0018].

### Who may install

* Proposed: a core permission `core.plugin:manage` (name proposed), checked at the company node and listed in core's `companyPermissions`, so that Plant admin lacks it ([ADR 0066][adr-0066]). Company admin holds it under M-61.
* A plugin reaches every company of the installation. M-60 gives installation-wide settings to the CLI on the host because no role sits above a company. This ADR reads Krister Johansson's answer "yes the admin" as making the plugin set the exception to M-60 (M-78, to be confirmed): a Company admin of any company of the installation installs for all of them. Under one installation per customer ([ADR 0072][adr-0072]), these companies belong to one customer. The other installation settings stay with `northmes installation set`.
* Three installation settings, set on the host with `northmes installation set` (M-60), bound every install. Names are proposed.
  * `plugins.trustedKeys`: the publisher keys whose signatures the installation accepts, each with the plugin ids, or the one id prefix, that it may sign. `installation set` refuses two entries that cover the same id, so each plugin id has one publisher key, and moving an id to another key is a change on the host. A change that removes a key, or an id from a key, lists the installed plugins that the key signed and is refused until each of them has a removal request.
  * `plugins.indexes`: the indexes the Plugins page lists.
  * `plugins.applyWindow`: the apply window above.
* A new installation trusts no publisher key and lists no index. The host adds them. NorthMES's own index and the project's publisher key wait for their trigger (see [What is release 1 and what waits](#what-is-release-1-and-what-waits)).

### Signature and version checks

| Where | What it checks | On failure |
|---|---|---|
| Install, on the Plugins page and in `northmes plugin install` | the signature by the key that `plugins.trustedKeys` binds to the plugin's id; the exact file list and the SHA-384 of every file; that the range covers this NorthMES version, with `semver.satisfies` and `includePrerelease` ([ADR 0038][adr-0038]); the id's format, the reserved ids of [ADR 0074][adr-0074] and [ADR 0064][adr-0064], and no pinned plugin with that id; no other digest recorded for the id and version; for an earlier version, every migration the installed version applied | refused before any request is recorded; the message names the check and the value |
| The host step | the same checks on the staged file, then `northmes migrate --check` with set n+1, including the inventory computed from the plugin's manifest against its signed inventory | refused, and set n stays current |
| Boot | the hash of each `northmes-plugin.json` against the current set, the signature against today's `plugins.trustedKeys`, the exact file list and the file hashes; then the catalog checks of [ADR 0002][adr-0002] with the range and `peerDependencies` ([ADR 0038][adr-0038]) | a failed check stops boot for a server plugin and makes a web-only plugin unavailable; a failed catalog check stops boot, except a web-only plugin on a removed slot, which is `incompatible` ([ADR 0037][adr-0037]) |
| Shell | that the plugin's range covers the web build's own version, because the shared instances come from the web build, which ADR 0070 lets run apart from the API; that id and version equal the plugin list entry | the plugin is not imported and shows its placeholder |

In 0.x a range covers one minor, so every minor upgrade excludes plugins built for the previous minor until they are rebuilt ([ADR 0038][adr-0038], M-13). This ADR adds no range override.

### Plugin screens at run time

#### Shared singletons

* `apps/web/index.html` carries one inline `<script type="importmap">` before the entry module. It maps the eight shared specifiers of [ADR 0019][adr-0019] to generated files under `/shared/`: `react`, `react-dom`, `react/jsx-runtime`, `@tanstack/react-router`, `@apollo/client`, `@apollo/client/react`, `@northmes/web-sdk` and `@northmes/ui`.
* `apps/web/src/plugins/host-shared.ts` imports each namespace and defines a non-writable property under `Symbol.for('northmes.shared')` on `globalThis` before any plugin loads. Each file under `/shared/` reads that object and re-exports every name of its package, so a plugin's `import { useState } from "react"` reaches the web build's own React.
* `pnpm gen` writes `apps/web/public/shared/*.js` and `shared-exports.json`, the export names of each specifier for this NorthMES version, which ships with `@northmes/web-sdk`. `pnpm gen --check` keeps them current. The shim files have fixed names, so the import map and its hash change only when the shared list changes, and the release notes say when it does.
* `@northmes/web-sdk` (MIT) exports `HOST_PROVIDED_WEB`, the eight specifiers, beside the server's `HOST_PROVIDED` of [ADR 0037][adr-0037]. Any other specifier, such as `react-dom/client` or `@apollo/client/cache`, is not shared; the plugin build refuses it, and in the browser it makes the plugin's import fail.
* `@northmes/ui` becomes the MIT package that [ADR 0056][adr-0056] lists. Today the kit is `apps/web/src/ui`, where 46 of 73 files carry an AGPL header. The proposal moves what `example-widget` uses into `packages/ui` and grows it with each need; relicensing those files is the copyright holder's decision.

#### Serving, headers and the CSP

* The backend serves each plugin's web part at `/api/v1/web/plugins/<id>/<version>/<file>`, from `<id>/<version>/web/` in the plugin volume, and only for plugins of the current set. `dist/server.js`, `migrations/`, `package.json` and the versions of earlier sets answer 404. The static web host never holds plugin files, so adding a plugin leaves the web build unchanged. In the pilot, Caddy's proxy for `/api` already covers the path on the web's origin, and so does the Vite dev proxy.
* `GET /api/v1/web/plugins` lists, for each plugin of the current set with a web part, its id, version, range, entry URL, stylesheets, the entry's SHA-384, its label, icon and order, and its contributions from `web.contributes` ([ADR 0068][adr-0068]). It is `no-store` and accepts the web's JWT or the station cookie (proposed). On main, sign-in navigates to the return path in place (`router.navigate` in `apps/web/src/shell/shell.tsx`). This ADR changes that: after sign-in the shell loads the return path with a full page load, so its boot runs again with the session and fetches the plugin list.
* File responses carry `text/javascript` or `text/css`, `X-Content-Type-Options: nosniff` and `Cache-Control: immutable`, because a version never changes. The mount does not fall through, and it refuses a path or a link that leaves the plugin's `web/` folder, as `static-mounts.ts` does today.
* A module script carries no bearer JWT, so the files are public and anonymous, like the web build. The file mount is an Express static mount registered before the app initialises, so it does not pass through Nest middleware, guards or `PrincipalResolver`. It is a named exception in the route inventory test of proposed [ADR 0011][adr-0011] and has an anonymous row in the credentials table of proposed [ADR 0073][adr-0073]. A browser fetches a module script from another origin in CORS mode with no credentials, so the mount applies the `webOrigins` rule of `WebOriginsModule` itself.
* The CSP admits the import map by its hash and the plugin files by path. Caddy sets it in the pilot, an operator's static host sets it elsewhere, and `ShellController` sets it while the backend still serves the web build:

  ```text
  default-src 'self'; script-src 'self' <api>/api/v1/web/plugins/ 'sha256-<import map>';
  style-src 'self' <api>/api/v1/web/plugins/; connect-src 'self' <api> <wss api>;
  img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
  ```

  On one origin, only the hash is new.
* The browser floor of [ADR 0019][adr-0019] (Chrome and Edge 111, Firefox 128, Safari 16.4) supports import maps, which arrived in Chrome 89, Firefox 108 and Safari 16.4. Import map integrity needs Chrome 127, Firefox 138 or Safari 18 (both per the support table of the es-module-shims README), so on the floor the browser cannot pin plugin files. The server checks the signature and the file hashes instead. es-module-shims could pin them only by running modules from blob URLs, which the CSP excludes.

#### Shell boot and failures

1. Read `config.json` and open the session.
2. Register the shared instances.
3. Call `GET /api/v1/web/plugins`.
4. Insert each plugin's stylesheet and call `import()` on every entry in parallel, with the timeouts of [ADR 0019][adr-0019]: 10 s in the planner layout, 30 s in the station layout, and a loading indicator after 2 s.
5. Check each module with `validateWebModule` and its range against the web build's version.
6. Create the router once, with the in-repo modules and the loaded plugins.

* Plugins load before the router exists, because TanStack Router builds its route tree when the router is created, and replacing the tree later is untested (internal research note 19). The plugin set changes only with a restart, which already means a page load.
* A rejected or timed-out import gives a placeholder route `/$plant/<id>/$` with a title and an `h1`, an "(unavailable)" sidebar entry at the plugin's manifest order, and contribution fallbacks named by their manifest labels ([ADR 0068][adr-0068]).
* Each contribution renders inside its own error boundary, each plugin's route subtree has an `errorComponent`, and `defaultErrorComponent` stays. A lazy chunk that answers 404 after a change shows Reload page.
* The page stays one document with one React tree, so the accessibility services of [ADR 0021][adr-0021] apply to plugins unchanged: `screenRoute` with a required title, `PageFrame`, dialogs from `@northmes/ui` in the host document, and one polite region through `useHost(slot).announce`.
* A loaded plugin can patch globals, read `sessionStorage`, which holds the session token ([ADR 0070][adr-0070]), or block the main thread. This is the full trust of [ADR 0037][adr-0037].

#### Build and development loop

* `@northmes/plugin-build` builds the web part with Vite 8 in library mode (`formats: ['es']`, entry `entry.js`, `HOST_PROVIDED_WEB` as externals), `@vitejs/plugin-react` with the automatic runtime, and the prefixed Tailwind sheet without preflight ([ADR 0019][adr-0019]). The server part keeps Rolldown with `HOST_PROVIDED` as externals.
* The build fails when a bare import left in the output is not a key of `HOST_PROVIDED_WEB`; when a chunk holds code of a shared package or of `graphql`; when a named import from a shared specifier is missing from `shared-exports.json`; when the keys of `contributions` differ from `web.contributes` or a kind differs from its slot's kind ([ADR 0068][adr-0068] piece 3); and when a selector in `style.css` lacks the plugin prefix.
* In development, `pnpm plugin:build <id> --watch` rebuilds the web part, and a page reload loads it. In-repo modules keep Fast Refresh; a plugin's web part has none across its boundary in release 1.

### Before a NorthMES upgrade

* `upgrade.sh` step 2 runs `northmes plugin check` from the new image, in the new bundle's `plugins` service, against the current plugin set, before `northmes migrate --check` ([ADR 0045][adr-0045]). This is the plugin compatibility check. For each installed plugin it reports one of: compatible; a version in the plugin's index whose range covers the new release; or no compatible version.
* The new image's catalog checks are the check against its extension points: they refuse a validator whose command or payload version is gone and mark a web-only plugin on a removed slot `incompatible` ([ADR 0037][adr-0037]), so release 1 needs no separate point snapshot file.
* `upgrade.sh` stops before the maintenance page when an installed plugin has no compatible version, and names it; the operator waits for a new version or removes the plugin.
* With `--with-plugin-updates`, `upgrade.sh` stages the compatible versions through the new image's `plugins` service, records one request per plugin with `core.cli`, the operator's reason and the set number, prints each plugin's inventory change, writes set n+1 and runs `migrate --check` with it, so one restart upgrades NorthMES and its plugins. When a plugin migration that will run carries the `contract` marker, `upgrade.sh` reports the `restore` rollback class ([ADR 0045][adr-0045]).
* In 0.x the range decides, so every installed plugin needs a new version at each minor upgrade ([ADR 0038][adr-0038]), and the point check tells whether that version is only a bump. At 1.0 the rule of [ADR 0068][adr-0068] applies: the image accepts a plugin when it serves every point version the plugin uses.
* A partner runs the same `upgrade.sh` for each installation ([ADR 0072][adr-0072]).

### Rollback and backups

* A failed apply switches back to the previous set by itself (step 7 of the host step), and `plugins.sh rollback` undoes the last apply after the fact.
* An admin also rolls back a plugin by removing it, or by installing an earlier version that holds every migration the installed version applied.
* `upgrade.sh` records the set it started from and the set it made current in `upgrade-state.json`. `rollback.sh` refuses when the current set differs from the one the upgrade made current, and names `plugins.sh rollback`, so a NorthMES rollback never rewinds over a later plugin apply. Otherwise it makes the starting set current again before it starts the previous image, for both rollback classes of [ADR 0045][adr-0045].
* `core.plugin_request` holds each apply's set number, so the restore runbook makes current the set that the restored database last applied.
* The plugin volume keeps the files of earlier sets, so each of these switches finds them. The file backups of [ADR 0045][adr-0045] cover the plugin volume beside `caddy_data`, the bundle and the secrets directory.

### Trust

* A plugin runs with full trust in the server process and in the page ([ADR 0037][adr-0037], [ADR 0068][adr-0068]), and only inside one customer's installation ([ADR 0072][adr-0072]). Its server code also runs in `migrate`, which holds `db_owner_password`, because `northmes migrate` and `migrate --check` load every plugin, as they do under ADR 0037 and ADR 0045. The Plugins page and `SECURITY.md` say so before an admin installs one.
* The signature shows which publisher key signed the archive. It does not show what the code does beyond the inventory it declares ([ADR 0068][adr-0068]).
* No third-party plugin runs on the pilot installation ([ADR 0037][adr-0037], M-13).

### What stays the same

* Veto-only command validators, versioned slots and the slot kinds of [ADR 0037][adr-0037] and [ADR 0068][adr-0068].
* `HOST_PROVIDED` and the resolve hook on the server; a new shared web singleton still needs a new image.
* Every plugin change restarts the process; a server plugin that fails to load stops boot; a web-only plugin on a removed slot degrades to `incompatible`.
* A removed plugin leaves its schema, and System health lists it.
* Release 1 knows only "installed": an install reaches the whole installation, and per-organization enablement waits ([ADR 0037][adr-0037]).
* `northmes migrate` syncs installed permissions into Company admin and Plant admin (M-61, [ADR 0066][adr-0066]).

### Open: how a hosting partner controls installs

Krister Johansson raised that a hosting partner which guarantees uptime may want to stop a customer from installing plugins freely. This ADR leaves the answer open and builds nothing for it in release 1. The options to weigh when the trigger fires:

* The partner holds core's Company admin and gives the customer's admins a custom role without `core.plugin:manage`, as Krister Johansson suggested. Under the grant rule of [ADR 0010][adr-0010], an editor adds to a role only permissions it holds, so the customer's admins cannot get the permission back. No role sits above the company ([ADR 0066][adr-0066], [GLOSSARY.md](../../GLOSSARY.md)), so the partner's role is Company admin itself, held by a partner user in each company, and every company keeps an active Company admin under ADR 0066.
* The host turns the Plugins page's install actions off with an installation setting, so only the CLI on the host installs. Mattermost, Grafana and WordPress keep such a switch in server configuration rather than in the admin UI.
* The host narrows `plugins.trustedKeys` and `plugins.indexes`, which this ADR already puts on the host. That limits where plugins come from, not whether the customer's admin installs one. `plugins.applyWindow` already decides when.
* `northmes apply` turns the `plugins` list of the customer file into install requests, so the partner keeps the plugin set under version control ([ADR 0072][adr-0072]). Today `apply` installs nothing.

The trigger: the first hosting partner that hosts a customer installation running plugins, or a partner that asks to control installs.

### What is release 1 and what waits

| Part | Release | Reason or trigger |
|---|---|---|
| Plugin screens at run time: the import map, the shared files, the plugin list and file routes, the CSP hash, the loader and its placeholders, the full page load after sign-in | 1 | Krister Johansson's decision of 2026-10-10; read by `example-widget` in the `plugin-outside` job and in the Playwright plugins spec |
| The plugin archive with its file list and signature, `@northmes/plugin-build`, `pnpm plugin:build` packing and `pnpm plugin:sign` | 1, proposed | read by the `plugin-outside` job and the nightly Compose test, which install the example archives |
| The plugin volume, plugin sets, the `plugins` service, `northmes plugin`, `plugins.sh` with its timer, apply window and host lock | 1, proposed | read by the nightly Compose test, which installs `example-validator` with `plugins.sh` |
| The Plugins page, the staging route, `core.requestPluginInstall`, `core.requestPluginRemoval`, `core.cancelPluginRequest`, `core.plugin_request` and `core.plugin:manage` | 1, proposed | read by the Playwright step that installs `example-widget` through the page; Krister Johansson's answer "yes the admin" named who installs, not the release |
| The plugin compatibility check in `upgrade.sh`, the plugin set in `rollback.sh`, and `plugins.sh rollback` | 1, proposed | read by the upgrade fixture test and the nightly Compose test; no third-party plugin runs on the pilot ([ADR 0037][adr-0037]) |
| NorthMES's own plugin index, the project's publisher key and its release signing | later | the first plugin published for more than one customer |
| A hosting partner's control over installs | open | [Open: how a hosting partner controls installs](#open-how-a-hosting-partner-controls-installs) |
| Import map integrity in the browser | later | the browser floor reaches Chrome 127, Firefox 138 and Safari 18 |
| Fast Refresh across the plugin boundary, `northmes plugin dev` | later | after the pilot ([ADR 0068][adr-0068]) |
| An init container that fills the plugin volume on Kubernetes | later | Helm values ([ADR 0055][adr-0055] trigger: a partner) |
| Removing the files of old plugin sets | later | the plugin volume passes 1 GiB (limit proposed); this is not `northmes plugin purge`, which drops a removed plugin's schema ([ADR 0037][adr-0037]) |
| Per-organization enablement | later | unchanged ([ADR 0037][adr-0037]) |

### Parts of accepted ADRs this decision changes

The files below keep their text. Once this ADR is accepted, it holds over the parts listed here, and the rest of each ADR stands. Where ADR 0070 changes the same part, this ADR builds on ADR 0070's text.

#### Changes to ADR 0037

[ADR 0037][adr-0037], plugins:

| Section | Before | After |
|---|---|---|
| Install | "Build the plugin package, place it in `plugins/<id>/` or a layer of a site image, list it in `northmes.config.json`, run `northmes migrate`, restart." | An admin installs a signed plugin archive on the Plugins page or with `northmes plugin install`, and the host step `plugins.sh apply` unpacks it into the plugin volume, migrates and restarts. A host may still pin a built package by its path in `northmes.config.json`. Every plugin change still means a restart |
| Install, package contents | "...; `migrations/*.sql` for its own schema only; `web/dist/` with the remote." | ...; `migrations/*.sql` for its own schema only; `web/` with `entry.js`, its chunks and `style.css`, built as ES modules. The package ships inside one plugin archive whose signed `northmes-plugin.json` holds the id, version, NorthMES range, the path and SHA-384 of every file and the plugin inventory |
| Install, host-provided packages | "The SDK exports `HOST_PROVIDED`: ..." | Unchanged, and `@northmes/web-sdk` exports `HOST_PROVIDED_WEB`, the eight shared web specifiers that the shell's import map binds to the web build's copies |
| Install, the pilot path | "For the pilot the supported path is a site image `FROM ghcr.io/northmes/northmes:<v>` with `COPY plugins/` and the config, tagged per upgrade, so a rollback returns to the previous site image" | For the pilot the supported path is the official image with the plugin volume. A rollback makes the previous plugin set current with the previous image |
| Install, failure table | "a plugin's remote files are missing or its manifest hash differs: the module list marks it, and the shell shows a placeholder" | A web-only plugin's files are missing, differ from its signed file list, or its signature fails against today's trusted keys: the plugin list marks it unavailable, and the shell shows a placeholder named by its manifest label. A plugin with a server part that fails these checks stops boot |
| The example plugins | `example-widget`: "manifest and web remote only" | manifest and web part only, loaded at run time |
| The example plugins | "`pnpm plugin:build <id>` builds them (Rolldown with `HOST_PROVIDED` externals, `@northmes/web-build` for the remote)" | `pnpm plugin:build <id>` builds them with `@northmes/plugin-build` (Rolldown with `HOST_PROVIDED` externals for the server part, Vite library mode with `HOST_PROVIDED_WEB` externals for the web part) and writes their archives, which CI signs with a key it generates for each run and no installation trusts by default |
| Consequences | "a plugin installs into the signed official image with no generator, and a rollback returns to the previous site image tag" | a plugin installs into the signed official image with no generator and no build, and a rollback makes the previous plugin set current |
| Confirmation | "`plugin-outside` CI job: packs the MIT packages, installs an example from those tarballs in a directory outside the repository, builds it, drops it into a plugins directory, boots and runs the example e2e spec" | `plugin-outside` CI job: packs the MIT packages, `@northmes/plugin-build` included, installs an example from those tarballs in a directory outside the repository, builds, packs and signs it with `@northmes/plugin-build` and a key generated for the run, installs the archive into a plugin volume with the container commands of `plugins.sh apply`, boots and runs the example e2e spec |
| Confirmation | "Nightly Compose test with `example-validator` in a site image: `northmes migrate` applies its migration and `app` reaches ready." | Nightly Compose test: `plugins.sh install` and `plugins.sh apply` install the `example-validator` archive into the official image's stack, its migration runs and `app` reaches ready |

#### Changes to ADR 0002

[ADR 0002][adr-0002], after the change that proposed ADR 0070 makes to it:

| Section | Before | After |
|---|---|---|
| Process roles | role `api` serves no web files (ADR 0070) | role `api` serves no web files except the web parts of the current plugin set, from the plugin volume under `/api/v1/web/plugins/` |
| Boot sequence, step 1 | "read `northmes.config.json`" | read `northmes.config.json`, the current plugin set and the installation setting `plugins.trustedKeys`, and check each volume plugin's file list hash, signature and files before step 3 imports any manifest; a server plugin that fails a check fails hard |
| Boot sequence, step 9 | none (ADR 0070: role `api` serves no web files) | `/api/v1/web/plugins/<id>/<version>/` per plugin of the current set with a web part |
| Degrade rules | none (ADR 0070 removes the rule for remote files) | A web-only plugin's files are missing, differ from its file list or fail the signature check: `/api/v1/web/plugins` lists it as unavailable, and the shell shows a placeholder |

#### Changes to ADR 0003

[ADR 0003][adr-0003]: a plugin's screens ship as a web part of ES modules in its archive instead of a Module Federation remote, and the remote build check becomes the checks of `@northmes/plugin-build`. The manifest gains no key.

#### Changes to ADR 0013 and ADR 0051

The configuration revision ([ADR 0013][adr-0013], [ADR 0051][adr-0051] rule 15) folds in each volume plugin's archive digest beside its id, version and manifest hash, and `northmes config export` lists the digest with the plugin. Installing, upgrading and removing a plugin are audited commands, which rule 7 asks for plugin enablement.

#### Changes to ADR 0018

[ADR 0018][adr-0018], after ADR 0070's change: the build value in `x-northmes-build` carries the hash of the current plugin set beside the schema hash, so an open tab reloads after a change to a web-only plugin, which leaves the schema as it was.

#### Changes to ADR 0038

[ADR 0038][adr-0038], versions and releases:

| Section | Before | After |
|---|---|---|
| Decision drivers | "A mismatch between image, config, plugin and remote fails at boot or in CI with both values named, never at run time on the plant." | Unchanged, and a mismatch between a plugin archive and the installation also fails at install on the plant, before anything changes |
| One version | "The shell drops its own range check and checks only that each remote's id and version equal the server's module list entry." | The shell checks that each plugin's id and version equal its entry in `/api/v1/web/plugins` and that its range covers the web build's own version, because the web build provides the shared instances |
| One version | "`/api/web/modules` checks each remote's shared versions: ..." | The import map binds every plugin to the web build's shared copies, and `@northmes/plugin-build` checks each named import against the web build's `shared-exports.json`. The Playwright run of the previous release's example widget on pull requests that touch the shared list stays |

#### Changes to ADR 0044

[ADR 0044][adr-0044], on-prem deployment:

| Section | Before | After |
|---|---|---|
| Services, `app` | "`ghcr.io/northmes/northmes:<version>@sha256:<digest>`, or the site image built from it" | the official image only, pinned by digest; it mounts the plugin volume read-only and the plugin staging volume read-write, and keeps `read_only: true` |
| Services, `migrate` | "the same image as `app`" | the same image as `app`; it mounts the plugin volume read-only |
| Services, `plugins` | none | the same image as `app`; runs only the `northmes plugin` commands, which import no plugin code; `restart: "no"`; the only service that mounts the plugin volume read-write; mounts the staging volume read-write; receives `db_app_password` and no `db_owner_password`; `plugins.sh` and `upgrade.sh` run it with `docker compose run --rm` |
| Release bundle | "the scripts, the systemd units and a release manifest" | the scripts with `plugins.sh`, the systemd units with the timer that runs `plugins.sh apply --timer`, and a release manifest |
| Site files | "Plugins reach the pilot as a site image `FROM ghcr.io/northmes/northmes:<version>`, tagged per upgrade" | Plugins reach the pilot through the plugin volume (see [The plugin volume and the plugins service](#the-plugin-volume-and-the-plugins-service)); no site image is built |
| Confirmation, Compose contract test | the listed assertions | also: `app` runs the official image reference and mounts the plugin volume read-only; only `plugins` mounts it read-write; `plugins` has no `db_owner_password` |
| Confirmation, site files test | "a rollback starts the previous site image" | a rollback starts the previous image and makes the previous plugin set current |

#### Changes to ADR 0050

[ADR 0050][adr-0050], supply chain. Release 1 adds no long-lived signing key: the project publishes no plugin in release 1, and CI signs the example archives with a key it generates for each run. The release run signs nothing new. When NorthMES's own index comes (trigger in [What is release 1 and what waits](#what-is-release-1-and-what-waits)), the planning session proposes:

| Section | Before | After |
|---|---|---|
| Runners | "Release, image push, signing, attestations, SBOMs, npm publish, ...": GitHub-hosted | Unchanged; the release job also signs the project's plugin archives and the index, on a GitHub-hosted runner in the `release` environment |
| Offline image bundle and its verification | "GitHub artifact attestations cover the image digests, the SBOMs, the `docker save` tarballs and the Compose bundle." | They also cover the project's plugin archives and the index |
| Release verification at the plant | keyless attestations, with cosign optional and checksums as the minimum | Unchanged for images and the bundle. An installation verifies a plugin archive offline with an Ed25519 publisher key, because `plugins.trustedKeys` must work without internet. The project's private key is a secret of the `release` environment, whose required reviewer is the owner, and only the release job reads it. The image carries the project's public keys for the ids the project publishes. A rotation adds the new public key in one release and signs with it from the next minor; the old public key leaves the image one minor later, by which time each project plugin has a version signed with the new key, because in 0.x each minor needs one. A compromised key leaves the image in a patch release, and `upgrade.sh` names the installed plugins it signed |

#### Changes to ADR 0055

[ADR 0055][adr-0055], release 1 scope. An item enters release 1 only by the maintainer's decision, recorded in the ledger. The first row is Krister Johansson's decision of 2026-10-10; the others enter when he confirms them. None has an estimate until the stories of its reader exist, as for the rows of [ADR 0068][adr-0068].

| Addition | Estimate (raw days) |
|---|---|
| ADR 0075: plugin screens loaded at run time (import map, shared files, plugin list and file routes, CSP hash, loader and placeholders, the full page load after sign-in, `@northmes/ui` for what `example-widget` uses) | not estimated |
| ADR 0075: the plugin archive, `@northmes/plugin-build`, `pnpm plugin:build` packing and `pnpm plugin:sign` | not estimated |
| ADR 0075: the plugin volume and sets, the `plugins` service, `northmes plugin`, `plugins.sh` with its timer, apply window and host lock | not estimated |
| ADR 0075: the Plugins page, the staging route, `core.requestPluginInstall`, `core.requestPluginRemoval`, `core.cancelPluginRequest`, `core.plugin_request` and `core.plugin:manage` | not estimated |
| ADR 0075: the plugin compatibility check in `upgrade.sh`, the plugin set in `rollback.sh`, and `plugins.sh rollback` | not estimated |

#### Changes to ADR 0056

[ADR 0056][adr-0056], the MIT packages, the exception and the trademark policy:

| Section | Before | After |
|---|---|---|
| The MIT package set | "`@northmes/contracts`, every `@northmes/<id>-contracts`, `@northmes/sdk`, `@northmes/web-sdk`, `@northmes/ui`, `@northmes/web-build`, `@northmes/testing` and the generator package." | `@northmes/plugin-build` takes the place of `@northmes/web-build`, which proposed ADR 0070 removes. It builds a plugin's server part and web part, packs and signs the archive, and checks the web part against `shared-exports.json` |
| The extension exception | "to convey the combination in object code (for example a site image built `FROM` the NorthMES image)" | the examples also name a plugin archive installed into the official image's plugin volume, and one handed out through a plugin index |
| The extension exception, bundling clause | "combining through the official build tooling (`@northmes/web-build` and the plugin build path) does not extend the AGPL to the plugin" | the official build tooling is `@northmes/plugin-build`, which `pnpm plugin:build` calls, with Vite's library mode for the web part |

The wording waits for the lawyer, who also reads the trademark policy's rule on an official offering against a NorthMES plugin index.

#### Changes to ADR 0060

[ADR 0060][adr-0060], the environment schema gains two rows. Without them the server loads no plugin from a volume.

| Variable | Read by | Value |
|---|---|---|
| `NORTHMES_PLUGIN_DIR` | server, `migrate`, `plugins` | the plugin volume's path: read-write for `plugins`, read-only for the others |
| `NORTHMES_PLUGIN_STAGING_DIR` | server, `plugins` | the plugin staging volume's path, read-write for both |

### Consequences

* Good, because a customer without the source code, a build tool or shell access installs a plugin into the official image, as Krister Johansson asked.
* Good, because `app` still holds no owner password, keeps a read-only file system and never runs a migration, and only the `plugins` service, which imports no plugin code, writes the plugin volume.
* Good, because the installer shows the inventory from signed data, runs no plugin code before an admin accepts the plugin, and refuses a plugin whose code declares more than its signed inventory.
* Good, because a failed install leaves the previous set running, a rollback restores the plugin set with the image, and `plugins.sh rollback` undoes an apply, so the gap that the site image closed stays closed.
* Good, because plugin screens need no web build and no runtime library in `apps/web`, and the dense slot kinds work, since plugin code runs in the host page with the host's React.
* Good, because a plant without internet installs from a file, and the source never decides trust.
* Bad, because a Company admin of one company changes what every company of the installation runs, which M-60 avoids for the other installation settings.
* Bad, because every install, upgrade and removal restarts NorthMES for every user and station, and an apply waits for the host's apply window.
* Bad, because the release bundle gains a host script, a timer, a host lock and a one-off service that act on the stack without a person at the host.
* Bad, because plugin code still runs in `migrate` with the owner password, as it does under ADR 0037.
* Bad, because a new installation trusts no publisher key, so each host adds the keys of the plugins it runs.
* Bad, because the plugin files are public, like the web build, and the browser on the floor cannot pin them; only the server checks signatures and hashes.
* Bad, because the eight shared packages become plugin API: a React, router or Apollo Client major means a NorthMES minor, which excludes plugins until they are rebuilt. The host keeps their whole namespaces, so they are not tree-shaken; the size cost is not measured.
* Bad, because every web deployment's CSP carries the import map hash, and the API's plugin path when the API sits on another origin.
* Bad, because the spike ran in Chromium and Firefox, and WebKit is untested.
* Bad, because a plugin's web part has no Fast Refresh in release 1.
* Neutral, because the hosting partner's control stays open until a partner hosts plugins.

### Confirmation

Test file names follow the existing layout and are proposed.

* `apps/backend/test/plugins/archive.test.ts`: "an archive signed by a key that plugins.trustedKeys lacks is refused and the message names the key id"; "an upgrade signed by another trusted key is refused naming both key ids"; "a file whose SHA-384 differs from northmes-plugin.json is refused naming the file"; "a file missing from northmes-plugin.json is refused naming the file"; "a listed file missing from the archive is refused naming it"; "two entries whose paths are equal after case folding are refused and nothing is unpacked"; "an entry with .., an absolute path or a symlink is refused and nothing is unpacked"; "a range >=0.6.0-0 <0.7.0-0 on NorthMES 0.7.0 is refused naming both versions"; "the id articles is refused as reserved"; "an id and version that an earlier request recorded with another digest is refused"; "an earlier version that lacks a migration the installed version applied is refused naming the file"; "the inventory of a fixture whose dist/manifest.js throws on import is read without importing it".
* `apps/backend/test/plugins/staged.int.test.ts`: "an upload or link fetch without core.plugin:manage answers 403 and writes nothing to staging"; "an archive above the cap is refused while streaming"; "a second staged archive of one admin replaces the first"; "an unconfirmed staged archive is deleted after one hour".
* `apps/backend/test/plugins/apply.int.test.ts` on Testcontainers Postgres: "plugin stage unpacks only listed files into <id>/<version>/ and writes set n+1 without making it current"; "migrate --check with set n+1 refuses a manifest permission absent from the signed inventory and set n stays current"; "plugin switch makes set n+1 current, migrate runs its migration as the plugin's owner role, and plugin record writes the result with principal core.cli and the security event plugin.applied"; "a plugin that throws on import fails migrate --check, set n stays current and the request records the boot message"; "plugin due --timer returns nothing outside plugins.applyWindow, and nothing for an install in the week of a daylight saving change in a plant's zone, but returns a removal in that week"; "plugin install --dry-run records no request, command row or security event and leaves nothing in staging"; "removing a plugin that another plugin's dependsOn names is refused"; "a removed plugin's schema stays".
* `apps/backend/test/boot/plugin-volume.int.test.ts`: "boot loads the current set and the plugins northmes.config.json pins"; "an id in both exits 1 naming it"; "a server plugin whose dist/server.js differs from its file list exits 1 naming the plugin and the file"; "a server plugin whose northmes-plugin.json differs from the hash in the current set exits 1"; "a server plugin whose signing key plugins.trustedKeys no longer holds exits 1 naming the plugin and the key id"; "a web-only plugin whose web/entry.js differs is listed unavailable and boot continues".
* `apps/backend/test/cli/installation-settings.int.test.ts` gains: "removing a key from plugins.trustedKeys lists the installed plugins it signed and exits 3 until each has a removal request"; "two plugins.trustedKeys entries that cover one id exit 2".
* `apps/backend/test/web/plugins.int.test.ts`: "GET /api/v1/web/plugins without a session answers 401"; "with a session it lists id, version, entry URL, label, order and contributions"; "a plugin file under web/ answers text/javascript, nosniff and immutable"; "dist/server.js answers 404"; "a version of an earlier set answers 404"; "a path with .. or a link out of the plugin folder answers 404"; "an Origin in webOrigins gets Access-Control-Allow-Origin without credentials, and another origin gets 403".
* `apps/backend/test/web/build-header.int.test.ts`: "x-northmes-build changes after a web-only plugin install, while the schema hash stays".
* `apps/backend/test/cli/config-export.int.test.ts`: "config export lists each volume plugin's archive digest, and the configuration revision changes when only the digest changes".
* `apps/backend/test/modules/core/plugin-requests.int.test.ts`: "core.requestPluginInstall without core.plugin:manage at the company is refused with 403 and records nothing"; "with it, one command row in the company's scope holds the archive digest and the reason, and the security event plugin.install_requested has no scope node"; "Plant admin lacks core.plugin:manage"; "a request from company A blocks a second request from company B and shows on company B's Plugins page"; "a removal request replaces a pending install of the same plugin"; "core.cancelPluginRequest cancels a pending request and records plugin.request_cancelled".
* `packages/plugin-build/test/build.test.ts`: "a web part that imports @apollo/client/cache fails naming the specifier"; "a chunk that holds React code fails"; "a named import missing from shared-exports.json fails"; "a selector without the plugin prefix fails"; "the archive lists the path and SHA-384 of every file and the range from peerDependencies".
* `apps/web/test/plugins/load-plugins.test.tsx`: "a plugin whose import rejects, times out or imports an unmapped specifier gets a placeholder route with an h1 and an (unavailable) sidebar entry at its manifest order, and the other plugins load"; "a plugin whose range excludes the web build's version is not imported"; "after sign-in the shell loads the return path with a full page load, fetches the plugin list with the session and loads the plugins".
* `apps/web/test/modules/core/plugins-page.test.tsx`: "before Install the page shows the inventory, that the plugin runs with full access, and that it reaches every company"; "Install stays disabled until a reason is typed"; "a pinned plugin shows Pinned by the host and no actions"; "an upgrade marks the permissions and slots that changed"; "after the restart the page shows the request's result"; "the history lists a request made from another company".
* `apps/web/test/plugins/host-shared.test.ts`: "each shared file's export list equals the keys of the namespace the host registers". `pnpm gen --check` covers `apps/web/public/shared/`.
* `apps/web/test/csp.test.ts`: "the sha256 in the CSP of the Caddyfile and of shell.controller.ts equals the hash of the import map in the built index.html".
* Playwright `e2e/plugins.spec.ts` in Chromium, Firefox and WebKit: an admin installs `example-widget` with Install from file on the Plugins page, the test runs the host step's container commands, and the plugin renders in `planning/board/side/v1` and its hook state updates on click; the page records no `securitypolicyviolation`; a plugin that throws at import shows its placeholder while the board keeps working.
* The `plugin-outside` CI job installs both example archives, signed with a key generated for the run, through `northmes plugin install`, `plugin stage`, `migrate --check`, `plugin switch` and `migrate`, boots and runs the example e2e spec. The accessibility route suite runs with both installed.
* Nightly Compose test: `plugins.sh install` with the `example-validator` archive and `plugins.sh apply` reach `/health/ready` with the plugin loaded; a fixture plugin that throws on import leaves the previous set running and the request failed; a fixture upgrade whose migration fails after it ran restores to the backup label, makes set n current, and `app` reaches ready with the rows written before the stop; `plugins.sh rollback` after an apply with a migration restores to the label and makes set n current; `plugins.sh apply` exits without acting while another script holds the host lock or `upgrade-state.json` shows an upgrade in progress.
* Script test with a stub `docker` binary: `plugins.sh apply` logs the pre-flight before "stop app"; `plugins.sh apply --timer` outside the apply window calls nothing after `plugin due`.
* Upgrade fixture test: an upgrade from a 0.1.0 fixture to a 0.2.0 fixture with a plugin whose range is `>=0.1.0-0 <0.2.0-0` stops before the maintenance page and names the plugin; with a 0.2 version in the fixture index and `--with-plugin-updates`, one restart upgrades both and one request per plugin is recorded with `core.cli`; a `contract` migration in that plugin version makes `upgrade.sh` report the `restore` class; `rollback.sh` makes the 0.1 set current again; after a later plugin apply, `rollback.sh` refuses and names `plugins.sh rollback`.

## Pros and cons of the options

### Plugin archives in a plugin volume

* Good, because it adds a plugin to the official image without a build, which the goal asks for, and keeps `app` read-only and without the owner password.
* Good, because Mattermost, Grafana and Red Hat Developer Hub keep plugins in a volume beside an unchanged official image, Directus loads them from an extensions folder or its marketplace (internal research note 08), and Red Hat Developer Hub, the closest stack, also restarts for every change.
* Bad, because the host step on a timer is the least proven part: Red Hat Developer Hub's in-app plugin management "is intended for testing and development environments only" and leaves the restart to the operator.

### A site image

* Good, because a rollback by image tag restores the plugin files, and it needs no new code.
* Bad, because a customer without the source, a build tool or shell access cannot add a plugin, and every upgrade rebuilds the site image.
* Bad, because the image that runs is no longer the signed official image.

### CLI-only installs

* Good, because it fits M-60 and needs no in-app path or permission.
* Bad, because Krister Johansson answered that the admin installs, and a hosted customer would need the partner for every plugin.

### An import map

* Good, because a spike in Chromium 153 and Firefox 146, with Vite 8.3.2, React 19.3.0 and Playwright 1.63.0, showed one React instance across the host and a plugin served from another origin, a plugin hook reading the host's context through the shared `@northmes/web-sdk`, zero CSP violations under the strict CSP with the hash, and an unmapped specifier, a throw at import and missing files each leaving the other plugins running.
* Good, because the plugin build is stock Vite with an `external` list, and `apps/web` gains no runtime library.
* Bad, because without the hash both browsers blocked the inline import map and every plugin failed, so every deployment's CSP must carry it.
* Bad, because the floor cannot check plugin files in the browser, and WebKit is untested: Playwright's WebKit build did not open a page in the spike.

### Module Federation

* Good, because internal research note 19 ran it end to end, with Fast Refresh across the boundary and a manifest hash through the runtime's `fetch` hook.
* Bad, because it brings back the runtime that ADR 0070 removes, at 19.2 kB gzip per remote (internal research note 19).
* Bad, because every plugin build depends on `@module-federation/vite`, whose shared-module code had 64 singleton issues among 131 opened from 2026-08-01 ([ADR 0019][adr-0019]).

### A host registry

* Good, because it needs no import map and no CSP hash.
* Bad, because the binding code sits in each plugin build, so a change in how the host hands over instances needs every plugin rebuilt.
* Neutral, because it stays the fallback if an engine on the floor refuses the hashed inline import map; plugin source would not change, only the output of `@northmes/plugin-build`.

### Built into apps/web

* Good, because plugin screens get types, tree shaking and Fast Refresh with the rest of the app.
* Bad, because adding a plugin's screens needs a web build, which ADR 0037 rejected and Krister Johansson's decision of 2026-10-10 rules out.

### Iframes

* Good, because an iframe contains a hostile plugin.
* Bad, because each frame has its own React and Apollo cache, so a plugin needs its own token or a GraphQL proxy over `postMessage`.
* Bad, because the field, item and banner kinds of [ADR 0068][adr-0068] run plugin code inside the owner's components, which a frame cannot do.
* Bad, because a second document clips popovers, moves focus across the frame and needs live regions bridged ([ADR 0021][adr-0021]).

## More information

* What the comparison took from other platforms:

  | Source | Taken | Left out |
  |---|---|---|
  | VS Code | one package per version; install from a marketplace, a file or the CLI; a signature checked at install; a compatibility range checked at install | an extension host apart from the page; an allow list per user |
  | Mattermost | a volume beside the official image; extra signing keys only in server configuration, never set from the admin UI | activation without a restart; uploads off by default |
  | Grafana | a manifest of per-file hashes under one signature; plugins listed in configuration that the UI cannot remove; the Server Admin installs while an Org Admin only configures; a compatibility range that needs tests, since Grafana's CLI stopped enforcing it for several releases | an opt-in frontend sandbox |
  | Red Hat Developer Hub and Backstage | a restart after each change; a step that fills the plugin volume before the backend starts; a backend that serves the plugins' web files; shared web singletons | an in-app install for test environments only |

  Sources: [VS Code extension marketplace](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace), [VS Code enterprise extensions](https://code.visualstudio.com/docs/enterprise/extensions), [Mattermost plugin management](https://docs.mattermost.com/developers/integrate/plugins/using-and-managing-plugins), [Mattermost plugin settings](https://docs.mattermost.com/administration-guide/configure/plugins-configuration-settings.html), [Grafana plugin management](https://grafana.com/docs/grafana/latest/administration/plugin-management/), [Grafana plugin signatures](https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-sign/), [Grafana npm dependencies](https://grafana.com/developers/plugin-tools/key-concepts/npm-dependencies), [Grafana 12.0 upgrade guide](https://github.com/grafana/grafana/blob/main/docs/sources/upgrade-guide/upgrade-v12.0/index.md), [Red Hat Developer Hub dynamic plugins](https://github.com/redhat-developer/rhdh/blob/main/docs/dynamic-plugins/installing-plugins.md), [Red Hat Developer Hub 1.7 release note: Introducing plugin management by using Extensions](https://docs.redhat.com/zh-cn/documentation/red_hat_developer_hub/1.7/html/red_hat_developer_hub_release_notes/feature-rhidp-6758), [WordPress wp-config](https://developer.wordpress.org/advanced-administration/wordpress/wp-config/), [es-module-shims README, browser support](https://github.com/guybedford/es-module-shims#browser-support).
* Related ADRs: [0002][adr-0002] roles and boot, [0003][adr-0003] the manifest, [0010][adr-0010] the grant rule, [0011][adr-0011] the route inventory, [0013][adr-0013] the configuration revision, [0018][adr-0018] the reload dialog, [0019][adr-0019] shared singletons, timeouts and the browser floor, [0021][adr-0021] accessibility, [0037][adr-0037] plugins, [0038][adr-0038] ranges, [0044][adr-0044] Compose, [0045][adr-0045] upgrades and rollback, [0047][adr-0047] secrets and outbound URLs, [0050][adr-0050] supply chain, [0051][adr-0051] rules 7 and 15, [0055][adr-0055] scope, [0056][adr-0056] the exception, [0060][adr-0060] configuration, [0064][adr-0064] route families, [0066][adr-0066] Company admin and M-60, [0068][adr-0068] extension points and the inventory, [0070][adr-0070] one backend and one web app, [0072][adr-0072] one installation per customer, [0073][adr-0073] credentials by surface, [0074][adr-0074] reserved ids.
* Proposed ADRs to update before they are accepted:
  * [0070][adr-0070] and [0072][adr-0072], edited on their own branches. ADR 0072 compares the customer file's `plugins` list with the installed plugins, reports a difference as `pluginDrift`, applies the other changes and exits 4, and names `core.plugin_request` and the plugin set as exceptions to its rule that nothing sits above the company.
  * [0011][adr-0011]: the plugin file mount under `/api/v1/web/plugins/<id>/<version>/` is a named exception in the route inventory test; `GET /api/v1/web/plugins` and `POST /api/v1/web/plugins/staged` are first-party routes.
  * [0045][adr-0045]: `upgrade.sh` step 2 runs the plugin compatibility check; `--with-plugin-updates` records one request per plugin and reports the `restore` class for a plugin `contract` migration; `upgrade-state.json` records the starting and resulting plugin sets, and `rollback.sh` refuses on a set it did not make current and names `plugins.sh rollback`; `upgrade.sh`, `rollback.sh`, `restore.sh`, the drill and the backup timers take the host lock; the file backups cover the plugin volume; the window between shifts and the daylight saving week hold for `plugins.sh apply` through `plugins.applyWindow` and the check in `northmes plugin due`.
  * [0047][adr-0047]: the `plugins` service receives `db_app_password` and no `db_owner_password`, in the secrets table and the Compose contract test.
  * [0066][adr-0066]: `core.plugin:manage` in `companyPermissions`; the plugin set as the one installation-wide setting a Company admin changes in the app; `plugins.trustedKeys` with keys bound to plugin ids, `plugins.indexes` and `plugins.applyWindow` as installation settings; `core.plugin_request` with a row-level security allowlist entry beside `core.installation_setting`; the plugin security events without a scope node.
  * [0068][adr-0068]: a remote reads as a plugin's web part, `/api/web/modules` as `/api/v1/web/plugins`, the remote build check as the checks of `@northmes/plugin-build`, and the per-remote dev servers as a watch build. The later items `northmes plugin check` in `upgrade.sh` and signed builds with the inventory shown at install move into release 1 as proposed here, and ADR 0068's `northmes plugin add` becomes `northmes plugin install` and moves into release 1. NorthMES's own index, which ADR 0068 calls a catalog, stays later, and its trigger changes from "after 1.0" to the first plugin published for more than one customer.
  * [0073][adr-0073]: the credentials table gains an anonymous row for the plugin files under `/api/v1/web/plugins/<id>/<version>/`; `GET /api/v1/web/plugins` accepts the web's JWT or the station cookie, and `POST /api/v1/web/plugins/staged` the web's JWT.
  * [0074][adr-0074]: its revisit trigger fires: its reserved-id check runs at install and in the plugin compatibility check, so a core page whose segment equals an installed plugin's id stops the upgrade and names the plugin.
* Plan documents and files to update once this ADR is accepted: [01 product and scope](../plan/01-product-and-scope.md), [02 architecture](../plan/02-architecture.md), [03 modules and extensibility](../plan/03-modules-and-extensibility.md), [06 web and UX](../plan/06-web-and-ux.md), [12 operations and security](../plan/12-operations-and-security.md), [14 roadmap](../plan/14-roadmap.md) (E21), [17 risks](../plan/17-risks.md), and the list of MIT packages in `AGENTS.md`.
* Open questions M-77 to M-85 in [16 open questions](../plan/16-open-questions.md#design-points-from-the-plan-documents) hold the maintainer's parts of needs-confirmation and their working defaults.
* Revisit when a hosting partner hosts a customer installation that runs plugins, when pilot IT reports a browser that refuses the hashed import map, when the browser floor supports import map integrity, and at 1.0.

[adr-0002]: 0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
[adr-0003]: 0003-module-package-shape-and-the-definemodule-manifest.md
[adr-0010]: 0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md
[adr-0011]: 0011-principals-credentials-and-same-origin-rules.md
[adr-0013]: 0013-audit-trail-written-in-the-command-transaction.md
[adr-0018]: 0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
[adr-0019]: 0019-web-shell-with-react-module-federation-remotes.md
[adr-0021]: 0021-accessibility-target-wcag-2-2-aa.md
[adr-0037]: 0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0038]: 0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0044]: 0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md
[adr-0045]: 0045-backups-restore-drills-upgrades-and-rollback.md
[adr-0047]: 0047-secrets-and-the-installation-key.md
[adr-0050]: 0050-github-organization-rulesets-ci-runners-and-supply-chain.md
[adr-0051]: 0051-regulated-readiness-no-regret-rules.md
[adr-0055]: 0055-release-1-scope-under-option-b-and-the-scope-rule.md
[adr-0056]: 0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md
[adr-0060]: 0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md
[adr-0064]: 0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md
[adr-0066]: 0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-company-settings-at-settings-and-an-onboarding-wizard-before-a-plant-opens.md
[adr-0068]: 0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md
[adr-0070]: 0070-one-nestjs-backend-with-one-graphql-schema-and-one-static-web-app.md
[adr-0072]: 0072-one-installation-per-customer-and-hosting-partners-run-many-with-a-customer-folder-northmes-apply-and-the-health-endpoints.md
[adr-0073]: 0073-one-module-contract-for-rest-webmcp-and-later-mcp-with-oauth-clients-and-tokens.md
[adr-0074]: 0074-core-pages-at-the-plant-root-and-the-company-settings-root.md
