---
status: "proposed"
date: 2026-10-09
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors, coding agents, pilot IT, hosting partners
release: "1"
needs-confirmation: "maintainer (the customer folder layout; the customer file format and the command name northmes apply; northmes apply and the partner hosting docs waiting for a hosting partner instead of entering release 1; metrics waiting for a trigger; whether several installations may share one host; the rollback class and contract migrations in the release notes)"
---

# One installation per customer, and hosting partners run many with a customer folder, northmes apply and the health endpoints

## Context and problem statement

[ADR 0007][adr-0007] says that one installation serves one customer, which may hold several companies, and rule 23 of [ADR 0051][adr-0051] records "One installation per customer" as decided. [ADR 0066][adr-0066] gives the hosting partner, a consultant or provider who installs and runs NorthMES for customers, scriptable CLI commands on the host to create a customer's companies and first company admins. It leaves for later "`northmes plant create` and a declarative onboarding file", with the trigger "a hosting partner sets up plants for several customers", and [ADR 0055][adr-0055] leaves "Helm values and partner hosting docs" for later, with the trigger "a partner".

On 2026-10-09 Krister Johansson asked how the first user of a new customer gets to sign in, and how a consultant company can manage and maintain many installations for different customers. The planning session answered from ADR 0066 and proposed a folder per customer, a declarative file applied idempotently, standard endpoints that a partner's own tools watch, and a documented upgrade procedure, instead of a fleet console. Krister Johansson then decided that each customer gets its own installation, and that NorthMES supports neither multi-tenant hosting nor a database shared between customers. Earlier the same day he decided that the web signs in with email only, which [#415](https://github.com/northMES/northmes/pull/415) built: every new user has an email, and the placeholder address under `.invalid` is gone.

This ADR records that decision and decides how a hosting partner runs many installations with ordinary tools: what a customer folder holds, the customer file and the `northmes apply` command that applies it, the endpoints a partner's monitoring reads, the upgrade procedure per installation, which parts are release 1, and what stays out with the trigger that would bring it in. It covers the CLI in the one-off migrate container, core's contracts for the customer file, the health endpoints of [ADR 0043][adr-0043], the release bundle and scripts of [ADR 0044][adr-0044] and [ADR 0045][adr-0045], the release notes of [ADR 0038][adr-0038] and the partner hosting docs.

## Decision drivers

* Krister Johansson's decision of 2026-10-09: one installation per customer, no multi-tenant hosting and no database shared between customers.
* The pilot runs on-prem on one host at the plant, which may have no internet access ([ADR 0044][adr-0044]). Nothing leaves the installation by default ([12 operations and security](../plan/12-operations-and-security.md#the-pilot-shape)).
* Validation happens per installation, and one compliance profile decides the policies of an installation ([ADR 0051][adr-0051], rules 14 and 23).
* Some settings span every company of an installation: the installation settings of `northmes installation set`, the plugins in `northmes.config.json`, and the upgrade window ([ADR 0066][adr-0066], [ADR 0037][adr-0037], [ADR 0045][adr-0045]).
* A restore, a rollback and an upgrade act on one Postgres cluster and one app at a time ([ADR 0045][adr-0045]).
* A hosting partner already has tools for many hosts (version control, configuration management, monitoring, secret stores). NorthMES gives those tools stable inputs and outputs instead of a tool of its own.
* Every write is a command with an audit row, CLI writes included ([ADR 0013][adr-0013], [ADR 0066][adr-0066]).
* The scope rule: a platform feature is built only when a release needs it, and an item enters release 1 only by the maintainer's decision recorded in the ledger ([ADR 0055][adr-0055]).

## Considered options

How customers share, or do not share, an installation:

* One installation per customer: its own app, its own Postgres cluster, its own secrets and its own upgrade
* One shared multi-tenant installation that holds the companies of several customers
* One shared Postgres cluster with a schema, or a database, per customer

How a hosting partner runs many installations:

* Ordinary tools per installation: a customer folder, a customer file applied by `northmes apply`, the health endpoints and the upgrade scripts
* A NorthMES fleet console that registers installations, shows their state and upgrades them centrally
* Shell scripts of the ADR 0066 commands only, with no customer file

## Decision outcome

Chosen option: "One installation per customer", because Krister Johansson decided it, and because it is the only option in which a restore, an upgrade, an installation setting, a plugin and a compliance profile each touch one customer. For running many installations, chosen option: "Ordinary tools per installation", because it adds one command and a file format to what ADR 0043, ADR 0044, ADR 0045 and ADR 0066 already decide, and lets each partner keep its own tools.

### One installation per customer

* An installation is one Compose project ([ADR 0044][adr-0044]) with its own `app`, `migrate` and `db` services, its own Postgres cluster, volumes, secrets, installation key, escrow and backups ([ADR 0047][adr-0047], [ADR 0045][adr-0045]). It serves exactly one customer.
* An installation may hold several companies of that customer, as [ADR 0007][adr-0007] and [ADR 0066][adr-0066] decide: the company is the root of the scope tree, and no node, role, table, column or setting sits above it.
* NorthMES does not support several customers in one installation, nor two installations on one Postgres cluster or database. The install guide and the partner hosting docs say so, and no table, column or code path holds a tenant id.
* A consultant who works for several customers has one user per installation. No sign-in, user or role spans installations.

### The customer folder

A hosting partner keeps one folder per installation, in its own private repository. NorthMES documents the folder in the partner hosting docs and prescribes no tool to manage it. Names are proposed.

```text
<customer>/
  northmes.version         the release version the installation runs and the sha256 of its bundle
  compose.override.yaml    the site's Compose changes (ADR 0044); mounts the customer file into migrate
  northmes.env             infrastructure settings only (ADR 0044, ADR 0060)
  northmes.config.json     the plugins and webOrigins of the installation (ADR 0037, ADR 0070)
  site.caddy               the site Caddyfile snippet: the host name and the TLS choice (ADR 0044)
  pgbackrest.conf          the backup repositories (ADR 0045)
  secrets.json             for each Compose secret, a reference to where the partner keeps it
  northmes.customer.json   the customer file (see below)
  Dockerfile               the site image FROM ghcr.io/northmes/northmes:<version>, when plugins run
```

* `northmes.version` pins the release. The bundle's `compose.yaml` pins each image by digest ([ADR 0044][adr-0044]), so the version and the bundle checksum together name every image the installation runs.
* `secrets.json` holds references, never values: for each secret that `install.sh` writes under the `_FILE` keys of [ADR 0060][adr-0060] (`db_app_password`, `db_auth_password`, `auth_secret`, `installation_key` and the others), it names the entry in the partner's secret store or in the escrow of [ADR 0047][adr-0047]. The folder never holds a secret value, a temporary password, a backup or the escrow itself.
* A customer folder describes one installation. A partner that runs ten customers has ten folders, and its own scripts loop over them.
* Once Helm values exist (see [Out of scope](#out-of-scope-with-the-trigger-that-revisits-each)), a values file takes the place of `compose.override.yaml`, and the rest of the folder stays.

### The customer file and northmes apply

The customer file declares what the CLI commands of [ADR 0066][adr-0066] create, so that a partner keeps a customer's setup under version control and applies it again after a change. `northmes apply` reads it in the one-off migrate container:

```text
docker compose run --rm migrate northmes apply \
  --file <path> --reason <text> [--dry-run] [--json]
```

```json
{
  "schemaVersion": 1,
  "installation": {
    "settings": { "mcp.enabled": false }
  },
  "plugins": [],
  "companies": [
    {
      "id": "0199b8f2-4c1e-7a3b-9d2e-5f6a7b8c9d0e",
      "name": "Acme AB",
      "admins": [
        { "username": "alex.lund", "email": "alex.lund@example.com", "name": "Alex Lund" }
      ],
      "plants": [
        {
          "id": "0199b8f2-4c20-7d5e-9f6a-7b8c9d0e1f2a",
          "name": "Plant A",
          "slug": "plant-a",
          "timeZone": "Europe/Stockholm",
          "productionDayStart": "06:00"
        }
      ]
    }
  ]
}
```

* A Zod schema in core's contracts validates the file ([ADR 0017][adr-0017]). An unknown key exits 2, so a file that holds a password, a secret or a field of a later version is refused before anything is read from the database. Every company and plant carries a fixed uuidv7 `id`, which makes each write idempotent as `--id` does in ADR 0066.
* `installation.settings` takes the keys of `northmes installation set` ([ADR 0066][adr-0066]). A key exists in the schema only once the task that reads it exists, as for `installation set`.
* `companies[].admins[]` names the company admins with username, email and name. The email is required, because the web signs in with email only. The first admin of a new company is the first admin of `company create`; each further admin goes through `company add-admin`.
* `companies[].plants[]` declares plants with the fields of `core.createPlant` ([ADR 0066][adr-0066]). The key enters the schema in the task that lets the CLI create a plant, which needs `core.createPlant` (E05-S15). A plant that `apply` creates is in onboarding like any new plant, and an admin opens it through the wizard once the plant gate exists (E06-S14).
* `plugins` lists the plugin ids the installation must run. Plugins arrive only through the site image and `northmes.config.json` ([ADR 0037][adr-0037]), so `apply` compares the list with the plugins the running image loads and never installs or removes one.

What `apply` does:

1. It validates the file and reads the installation: installation settings, companies, their company admins, plants and the loaded plugins.
2. It plans every change, in this order: installation settings, companies, company admins, plants. A change it may not make is refused with exit 3 before any write, and the output names each refused entry. A plugin list that differs from the running image is such a refusal.
3. It runs the existing commands for each planned change: `installation set` for a changed setting, `company create` for a new company id, `company add-admin` for an admin who lacks core's Company admin role at the company, `core.updateCompany` for a changed name, and `core.createPlant` for a new plant id. Each write is its own command with principal type `system`, the system principal `core.cli`, surface `cli`, the required `--reason` and the security event that the command writes ([ADR 0066][adr-0066]).
4. It prints the result: plain text, or with `--json` one object, for example `{ "dryRun": false, "changes": [{ "kind": "company", "id": "0199b8f2-4c1e-7a3b-9d2e-5f6a7b8c9d0e", "action": "create", "replayed": false }], "notInFile": [], "newUsers": [{ "username": "alex.lund", "temporaryPassword": "<printed once>" }] }` (shape proposed).

* `--dry-run` reads only, writes no command row and no security event, and prints the same plan with `create`, `update`, `unchanged` or `refused` per entry and the `notInFile` list. It exits 0 when `apply` would succeed and 3 when it would refuse.
* A second run of the same file writes nothing and exits 0. A run that failed halfway, for example between Better Auth's write and core's command, completes when it runs again, through the replay rules of `company create` and `company add-admin` ([ADR 0066][adr-0066]).
* A new user's temporary password appears once on standard output and nowhere else, as with `company create`, and must be changed at the first sign-in ([ADR 0051][adr-0051] rule 13). A script that runs `apply --json` treats the output as a secret.
* Exit codes follow ADR 0066: 0 done, 1 unexpected error, 2 usage error or invalid file, 3 refused. No prompt, and no password as a flag or in the file.

What `apply` never does:

* It deletes, archives or blocks nothing. A company, plant, user or role assignment that the file does not list stays as it is and appears in `notInFile`.
* It removes no company admin. Removing one happens in the app, under the rule that every company keeps an active Company admin ([ADR 0066][adr-0066]).
* It resets no password; `northmes admin reset-password` does.
* It changes no plant's slug, zone or production day start after the plant exists, and refuses such a difference with exit 3. Whether a slug can be renamed is open for E05-S03, and the zone rule is in [ADR 0066][adr-0066].
* It opens no plant and records no onboarding step. Calendars, machines, planning rules, connector and AI settings are entered in the onboarding wizard or the module's own screens.
* It installs, enables or removes no plugin, runs no migration and reads or writes no secret.

### The endpoints a partner's monitoring reads

* Health and readiness: `/health/live`, `/health/ready` and `/health`, as [ADR 0043][adr-0043] decides and story E16-S01 ([#143](https://github.com/northMES/northmes/issues/143)) builds. `/health/ready` carries the degraded list (backup age, WAL archiving, certificate expiry and the other entries of ADR 0043), and its 503 during shutdown. Main does not serve them yet: `apps/backend` reserves the `health` path segment in its shell controller and has no health route.
* Version: `/health` and `/health/ready` already report the version ([ADR 0043][adr-0043]), the one `imageVersion()` in `apps/backend/src/version.ts` reads from the backend's `package.json`. This ADR adds no separate version endpoint. A partner's script compares that version with `northmes.version` in the customer folder.
* Metrics: release 1 serves no metrics endpoint. Alerts reach a person through the degraded list of `/health/ready` or hostcheck's mail through the customer's SMTP relay, one of which is a go-live gate ([ADR 0046][adr-0046], [12 operations and security](../plan/12-operations-and-security.md#hostcheck)). When the trigger below fires, a new decision chooses between a Prometheus text endpoint and OpenTelemetry metrics through the optional observability profile of ADR 0046.
* NorthMES sends nothing to a partner. A partner's monitoring reaches these endpoints through the network path the customer grants it, such as a VPN or a probe inside the customer's network, through Caddy like every other client ([ADR 0044][adr-0044]).

### Upgrades per installation

A partner upgrades one installation at a time with the scripts of [ADR 0045][adr-0045]. NorthMES has no command that upgrades several installations.

1. Read the release notes: the rollback class (`image` or `restore`) and the contract migrations of the release.
2. Agree the window with the customer: between shifts, and never in the week of a daylight saving change ([ADR 0045][adr-0045], [ADR 0055][adr-0055]).
3. Set the new version and bundle checksum in `northmes.version`, fetch the bundle and its images, online or by the offline image transfer ([12 operations and security](../plan/12-operations-and-security.md#offline-image-transfer)), and commit the folder.
4. Run `upgrade.sh` on the host: pre-flight, `northmes migrate --check` from the new image, maintenance page, backup, `migrate` in the one-off container, `up`, wait for `/health/ready`, smoke check ([ADR 0045][adr-0045]).
5. Check that `/health` reports the pinned version, then run `northmes apply --dry-run` with the customer file once `apply` exists; it should report no change.
6. On a failure, run `rollback.sh`, which follows the rollback class ([ADR 0045][adr-0045]).

* Under the working answer of [ADR 0038][adr-0038], only the latest minor gets fixes before 1.0, so a partner keeps each installation on the latest minor.
* Release notes, proposed for release 1: the GitHub release text states the rollback class and names each contract migration, copied from the release manifest that [ADR 0045][adr-0045] already writes, so a partner can plan each customer's window before fetching the bundle.

### What is release 1 and what waits

| Part | Release | Reason |
|---|---|---|
| One installation per customer, no multi-tenant hosting, no database shared between customers | 1 | Krister Johansson's decision; it adds no work and removes the cases a shared installation would need |
| `northmes company create`, `company add-admin`, `company list`, `installation show` and `installation set` | 1 | Already in the ledger through [ADR 0066][adr-0066] (E05-S14) |
| `northmes admin reset-password` | 1 | [ADR 0011][adr-0011], [ADR 0066][adr-0066], E05-S05 |
| The forced password change at the first sign-in | 1 | Rule 13 of [ADR 0051][adr-0051]; the new password step of design D2 (SI16 to SI18) |
| `/health/live`, `/health/ready` and `/health` with the version | 1 | [ADR 0043][adr-0043], E16-S01 |
| `upgrade.sh`, `rollback.sh` and the release manifest's rollback class | 1 | [ADR 0045][adr-0045] |
| The rollback class and contract migrations in the release notes | 1, if the maintainer confirms | A step in the release workflow that copies the release manifest |
| The partner hosting docs with the customer folder | later | Trigger of [ADR 0055][adr-0055]: a hosting partner |
| The customer file and `northmes apply` | later | Trigger of [ADR 0066][adr-0066]: a hosting partner sets up companies and plants for several customers |
| A metrics endpoint | later | Trigger: a hosting partner's or pilot IT's monitoring needs time series that the degraded list does not give |
| Helm values | later | Trigger of [ADR 0044][adr-0044] and [ADR 0055][adr-0055]: a hosting partner asks for them |

Until `apply` exists, a partner scripts the ADR 0066 commands with fixed `--id` values and `--json`, as [ADR 0066][adr-0066] describes under Hosting partners.

### Out of scope, with the trigger that revisits each

| Item | Trigger |
|---|---|
| Multi-tenant hosting: several customers in one installation | A decision that the project offers NorthMES as a hosted service. It needs a new ADR that supersedes this one and changes [ADR 0007][adr-0007] and rule 23 of [ADR 0051][adr-0051] |
| Installations of several customers on one Postgres cluster, with a schema or database each | A hosting partner measures that one Postgres cluster per installation does not fit its hosts |
| A central fleet console that registers, watches or upgrades installations | A hosting partner runs more installations than its own tools manage and asks for one |
| Views across customers: reports, search or users that span installations | A partner asks for reporting across its customers; it would read each installation's reporting schema, which waits for a customer who asks for BI access ([01 product and scope](../plan/01-product-and-scope.md#out-of-release-1)) |
| Creating companies in the UI, with installation roles | A partner must create companies without shell access to the host ([ADR 0066][adr-0066]) |
| Onboarding data in the customer file: calendars, machines, planning rules | A partner sets up the same values for many plants |
| `northmes upgrade` and the app repository | After 1.0 ([ADR 0055][adr-0055]) |

### Consequences

* Good, because a restore, a rollback or a failed upgrade affects one customer, and each customer chooses its own upgrade window.
* Good, because installation settings, plugins and the compliance profile need no per-customer case, and a row-level security fault can reach only the companies of one customer.
* Good, because a plant slug that is unique per installation ([ADR 0066][adr-0066]) reveals nothing about another customer.
* Good, because a partner's customer folders, version control and monitoring work with any tool, and NorthMES ships one command and one file format for them.
* Good, because the customer file never deletes, so a wrong or partial file cannot remove a company, a plant or an admin.
* Good, because each customer is the controller of the data in its own installation, and a partner that hosts it is a processor for that installation alone ([12 operations and security](../plan/12-operations-and-security.md#gdpr-basics)).
* Bad, because each installation runs its own Postgres cluster, backups, certificates and upgrades, so a partner pays per customer in hosts, memory and upgrade time.
* Bad, because a partner builds its own loop over installations and its own dashboard from the health endpoints.
* Bad, because a consultant who works for several customers has one account per installation.
* Bad, because until `apply` exists a partner keeps its own scripts of the ADR 0066 commands, and a removal in the file does nothing in the installation.

### Confirmation

* Plan review checklist item: a design that adds a scope node, table, column or setting above the company, or that lets two installations share a Postgres cluster or database, is refused with a link to this ADR.
* `apps/backend/test/health/ready.int.test.ts` (E16-S01) gains: "/health and /health/ready report the version that imageVersion() reads".
* `apps/backend/test/cli/apply.int.test.ts`, with the task that builds `apply`: "apply creates the companies, admins and installation settings of the file, one command row with surface cli and principal core.cli each"; "a second apply of the same file writes nothing and exits 0"; "--dry-run writes no command row and lists create, update, unchanged and refused per entry"; "a company, plant or admin missing from the file is left as it is and listed in notInFile"; "a plant whose zone differs from the installation is refused with exit 3 before any write"; "a plugin list that differs from the running image exits 3 and changes nothing"; "a run that failed after Better Auth's write completes on the rerun and prints no password"; "the temporary password of a new admin appears once on standard output and in no command row, security event or log line".
* `modules/core/contracts/test/customer-file.test.ts`, with the same task: "a customer file with a password key or any unknown key fails validation"; "an admin without an email fails validation".
* Release workflow, if the maintainer confirms the release notes rule: the release job fails when the release text lacks the rollback class of the release manifest.

## Pros and cons of the options

### One installation per customer

* Good, because restore, rollback, upgrade window, plugins, installation settings and the compliance profile each belong to one customer.
* Good, because it runs on the customer's own plant network without internet, as the pilot needs ([ADR 0044][adr-0044]).
* Good, because it is what ADR 0007, ADR 0051 and the code on main already assume, so nothing changes.
* Bad, because the cost per customer is a whole stack, which a partner with many small customers feels.

### One shared multi-tenant installation

* Good, because one upgrade, one backup setup and one host serve many customers.
* Good, because row-level security already separates companies, so the data model would not change.
* Bad, because a point-in-time restore or a restore-class rollback rewinds every customer at once, since pgBackRest restores the whole Postgres cluster ([ADR 0045][adr-0045]).
* Bad, because installation settings such as `mcp.enabled`, `outbound.allowedHosts` and the security event retention, the plugins in `northmes.config.json` and the compliance profile would apply to every customer ([ADR 0066][adr-0066], [ADR 0037][adr-0037], [ADR 0051][adr-0051] rule 14).
* Bad, because the host operator who runs the CLI as `core.cli` creates company admins for every customer, and a plant slug clash tells one customer's admin that another customer uses the slug.
* Bad, because it cannot run on each customer's plant network, and validation per installation would cover several customers at once ([ADR 0051][adr-0051]).
* Bad, because Krister Johansson ruled it out.

### One shared Postgres cluster with a schema or database per customer

* Good, because one database server is tuned and monitored for many customers.
* Bad, because each module owns its Postgres schemas, such as `core`, `planning` and `auth` ([ADR 0002][adr-0002]), so a schema per customer would need every module schema once per customer and a migration runner that knows customers ([ADR 0006][adr-0006]).
* Bad, because Postgres roles are cluster-wide, so the login roles `nm_owner`, `nm_app`, `nm_auth` and `nm_ext` ([12 operations and security](../plan/12-operations-and-security.md#install-and-bootstrap)) would need a set per customer, each with its own secret files.
* Bad, because pgBackRest backs up and restores the whole cluster, so a restore for one customer rewinds the others ([ADR 0045][adr-0045]).
* Bad, because Krister Johansson ruled out a database shared between customers.

### Ordinary tools per installation

* Good, because a partner keeps its own version control, configuration management, secret store and monitoring.
* Good, because `apply` reuses the commands, audit rows and replay rules of ADR 0066 instead of a second write path.
* Bad, because NorthMES ships no overview across installations.

### A NorthMES fleet console

* Good, because a partner would see every installation's version and health on one page.
* Bad, because it needs a service outside every installation, credentials that reach every customer and a channel out of plant networks that send nothing out by default.
* Bad, because it is a new product for one developer before the pilot, which the scope rule keeps out ([ADR 0055][adr-0055]).

### Shell scripts of the ADR 0066 commands only

* Good, because it needs no new command and works as soon as E05-S14 is built.
* Bad, because each partner writes its own comparison of what exists with what it wants, and a script that runs twice depends on every `--id` being kept.

## More information

* Related ADRs: [0002][adr-0002] module schemas, [0006][adr-0006] the migration runner, [0007][adr-0007] tenancy, [0011][adr-0011] principals and the CLI, [0013][adr-0013] audit, [0017][adr-0017] Zod contracts, [0037][adr-0037] plugins, [0038][adr-0038] releases, [0043][adr-0043] health, [0044][adr-0044] Compose and TLS, [0045][adr-0045] backups and upgrades, [0046][adr-0046] observability, [0047][adr-0047] secrets, [0051][adr-0051] rules 13, 14 and 23, [0055][adr-0055] scope, [0058][adr-0058] the developer stack, which is a developer's installation and not a partner tool, [0060][adr-0060] secret files, [0066][adr-0066] the company commands, [0070][adr-0070] one backend and Caddy serving the web.
* This ADR changes no accepted ADR. It adds to the rule of [ADR 0007][adr-0007] and rule 23 of [ADR 0051][adr-0051] that no database is shared between customers.
* Proposed ADRs to update before they are accepted: [0066][adr-0066] (`company create` takes a required `--admin-email` and `company add-admin` a required `--email` for a new user, and the `.invalid` placeholder goes, as #415 built for every user that `core.createUser` creates; its Hosting partners section links this ADR; the later item "`northmes plant create` and a declarative onboarding file" becomes the customer file and `northmes apply` here).
* Plan documents to update once this ADR is accepted: [01 product and scope](../plan/01-product-and-scope.md#out-of-release-1) (the rows for partner hosting docs and the declarative onboarding file, and the new rows for metrics and the fleet console), [12 operations and security](../plan/12-operations-and-security.md#install-and-bootstrap) (the customer folder and the upgrade steps for partners) and the Hosting partner persona in the [plan README](../plan/README.md#personas).
* Revisit when one of the triggers above fires, or when the project decides to offer a hosted service.

[adr-0002]: 0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
[adr-0006]: 0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
[adr-0007]: 0007-tenancy-company-plants-and-the-scope-tree.md
[adr-0011]: 0011-principals-credentials-and-same-origin-rules.md
[adr-0013]: 0013-audit-trail-written-in-the-command-transaction.md
[adr-0017]: 0017-zod-contracts-as-the-single-source-for-inputs.md
[adr-0037]: 0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0038]: 0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0043]: 0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
[adr-0044]: 0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md
[adr-0045]: 0045-backups-restore-drills-upgrades-and-rollback.md
[adr-0046]: 0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md
[adr-0047]: 0047-secrets-and-the-installation-key.md
[adr-0051]: 0051-regulated-readiness-no-regret-rules.md
[adr-0055]: 0055-release-1-scope-under-option-b-and-the-scope-rule.md
[adr-0058]: 0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md
[adr-0060]: 0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md
[adr-0066]: 0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-company-settings-at-settings-and-an-onboarding-wizard-before-a-plant-opens.md
[adr-0070]: 0070-one-nestjs-backend-with-one-graphql-schema-and-one-static-web-app.md
