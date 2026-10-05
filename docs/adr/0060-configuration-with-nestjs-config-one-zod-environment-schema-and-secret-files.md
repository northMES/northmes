---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors, plugin authors, coding agents and pilot IT
release: "1"
needs-confirmation: ""
---

# Configuration with @nestjs/config, one Zod environment schema and secret files

## Context and problem statement

NorthMES already splits configuration three ways. `northmes.env` holds infrastructure settings only ([ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)), secrets arrive as Compose secret files per service ([ADR 0047](0047-secrets-and-the-installation-key.md)), and behaviour switches are audited settings in the database ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)). The configuration reference is generated from "the Zod configuration schema" ([ADR 0048](0048-documentation-on-docs7-at-docs-northmes-dev.md)), and the config loader must refuse the stack script's dev secrets in production ([ADR 0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md)). No decision yet says how the server reads and validates the environment, where the schema lives or how code gets typed values.

This ADR covers `apps/server` in every role, the commands `northmes migrate`, `northmes db bootstrap`, `northmes admin create`, `northmes admin reset-password` and `northmes schema print`, the server parts of core modules, the stack script and tests. Plugins are out of scope: they never read the environment.

## Decision drivers

* A missing or invalid value stops boot with one message that names every bad key, like the other boot checks ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md)).
* One Zod schema gives validation, types and the configuration reference, as Zod contracts do for inputs ([ADR 0017](0017-zod-contracts-as-the-single-source-for-inputs.md)).
* Secret values never pass through `process.env`, logs or error messages.
* Dev, test and production read configuration the same way.
* Plugins get behaviour from settings, never from the environment.
* Every Nest developer can find the mechanism in the Nest documentation.

## Considered options

* `@nestjs/config` 12 with a Zod environment schema, a `secrets` namespace read from files and a typed `ConfigService`
* A plain provider: parse the environment once in `main.ts` and register the frozen object under an injection token
* `@nestjs/config` with class-validator classes

## Decision outcome

Chosen option: "`@nestjs/config` 12 with a Zod environment schema, a `secrets` namespace read from files and a typed `ConfigService`", because it is the mechanism the Nest documentation describes, version 12 accepts any Standard Schema such as a Zod schema, the earlier attempt used the same module, and it keeps Zod as the only validation library.

### The environment schema

* The server-only subpath `@northmes/sdk/config` (next to `@northmes/sdk/units`) exports `serverEnvSchema`, `migrateEnvSchema` and `bootstrapEnvSchema` with their inferred types, `loadEnv`, `readSecrets`, `secretsConfig` and `siteOnlyKeys`. `loadEnv(schema)` reads `process.env` itself, so no caller touches it.
* Each key carries Zod metadata: a description, an example, the entry points that read it, and whether it belongs in `northmes.env`. The configuration reference generator reads this metadata ([ADR 0048](0048-documentation-on-docs7-at-docs-northmes-dev.md)).
* The keys the plan names so far:

| Key | Read by | Rule |
|---|---|---|
| `NODE_ENV` | every entry point | `development`, `test` or `production`; default `production`. The stack script writes `development` into `.northmes/dev.env`, and the end-to-end fixture starts the built server with `test` |
| `NORTHMES_ROLE` | server | `all`, `api` or `worker`; default `all` |
| `PORT` | server | required, 0 to 65535. 0 lets the operating system pick a free port, which the server prints on stdout for the end-to-end fixture ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)). Compose and the stack script set it; the server has no default port, so it never takes 3000 ([ADR 0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md)) |
| `NORTHMES_PUBLIC_ORIGIN` | server | required; an origin with no path. It is `https://` when `NODE_ENV` is `production`; `development` and `test` also accept `http://localhost` or `http://127.0.0.1` with a port ([ADR 0011](0011-principals-credentials-and-same-origin-rules.md), [ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)) |
| `DATABASE_URL` | server, `migrate`, `db bootstrap`, `admin` | a Postgres URL with no user and no password. The login comes from the entry point: `nm_app` and `nm_auth` for the server, `nm_owner` for `migrate` and `admin`, the superuser for `db bootstrap` ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)) |
| `DATABASE_LISTEN_URL` | server in roles `all` and `api` | the direct connection for `LISTEN` ([ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md)), also without credentials, used with the `nm_app` login |
| `NORTHMES_DB_APP_PASSWORD_FILE`, `NORTHMES_DB_AUTH_PASSWORD_FILE` | server | the `nm_app` and `nm_auth` passwords (secrets `db_app_password` and `db_auth_password`, [ADR 0047](0047-secrets-and-the-installation-key.md)) |
| `NORTHMES_DB_OWNER_PASSWORD_FILE` | `migrate`, `admin` | the `nm_owner` password (secret `db_owner_password`) |
| `POSTGRES_PASSWORD_FILE` | `db bootstrap` | the superuser password ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)); bootstrap also reads the password file of each login role it creates |
| `NORTHMES_AUTH_SECRET_FILE`, `NORTHMES_INSTALLATION_KEY_FILE` | server | the Better Auth secret and the installation key ([ADR 0047](0047-secrets-and-the-installation-key.md)) |
| `NODE_EXTRA_CA_CERTS` | Node, checked by the server | optional path to the `customer_ca` secret; the file must exist and hold at least one PEM certificate, because Node only warns ([ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)) |
| `HTTPS_PROXY`, `NO_PROXY`, `NODE_USE_ENV_PROXY` | Node, checked by the server | optional; the schema checks their form |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | server and the OpenTelemetry preload | optional URL ([ADR 0046](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md)) |
| `NORTHMES_IMAGE_REF` | server | the image reference that Compose passes ([ADR 0051](0051-regulated-readiness-no-regret-rules.md)) |
| `BETTER_AUTH_TELEMETRY` | server | must be unset ([ADR 0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md)) |

* Each secret has its own `_FILE` key, so services and commands never share a key with different meanings. `compose.yaml` sets each service's `_FILE` keys under `environment:` to `/run/secrets/<name>`, and `northmes.env` holds the keys the services share ([ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)).
* `siteOnlyKeys` lists `NORTHMES_BIND_IP`, which only Compose reads, so the configuration reference covers the whole of `northmes.env`.
* The restore drill flag joins the schema when its task names it (M-48 in [16 open questions](../plan/16-open-questions.md#design-points-from-the-plan-documents)). Test switches such as `NORTHMES_AI_LIVE` and `NORTHMES_PYRAMID_LIVE` are read by tests, not by the server, and stay out of the schema ([ADR 0042](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md)).
* A new key is a schema entry with its metadata in the same pull request that reads it.

### Loading in the server

* At boot step 1, `main.ts` awaits `ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, cache: true, validate: loadEnv(serverEnvSchema), load: [secretsConfig] })`, which runs `validate` at once, and calls `readSecrets()` once. A bad key or secret file therefore stops boot before any manifest import ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md)). The root module imports that dynamic module at step 7, and `secretsConfig` returns the secrets already read.
* `ignoreEnvFile` is true in every environment, so the server never reads a `.env` file. Compose passes `northmes.env` through `env_file` and the `_FILE` keys through `environment:`. The stack script passes `.northmes/dev.env` to the processes it starts, and tests pass an explicit record.
* `loadEnv` runs `safeParse` and throws one `ConfigError` that lists every failing key with its rule, never its value. Boot exits 1 with that message.
* `forRoot` writes the validated values back into `process.env`. Secret values are never among them, because they are not environment values.
* A secret that carries the dev marker while `NODE_ENV` is `production` fails with `CONFIG_DEV_SECRET_IN_PRODUCTION` ([ADR 0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md)).

### Secrets

* `readSecrets` reads every `_FILE` path the entry point's schema requires, trims one trailing newline, and refuses a missing file, an empty file or a file whose mode grants read to others (`mode & 0o004`), naming the key. Group read is allowed, because `install.sh` writes each file 0440, owned by root and the app's group, and Compose bind-mounts file secrets with the host's mode ([ADR 0047](0047-secrets-and-the-installation-key.md)).
* Secret values live only in the `secrets` namespace (`registerAs('secrets', ...)`). They never enter `process.env`, a log line or an error message. The database pools, Better Auth and the secret store inject `secretsConfig.KEY` with `ConfigType<typeof secretsConfig>`.
* In dev the stack script writes the secrets as files under `.northmes/secrets/` with mode 0600 and points the `_FILE` keys in `.northmes/dev.env` at them, so dev and production read secrets the same way.

### Reading configuration in code

* Server code injects `ConfigService<ServerEnv, true>` and reads `config.get('NORTHMES_PUBLIC_ORIGIN', { infer: true })`, or injects `secretsConfig.KEY`.
* Biome `style/noProcessEnv` is an error everywhere except `packages/sdk/src/config/**`, test files, `scripts/**` and tool configuration files such as `vitest.config.ts` and `playwright.config.ts`. The OpenTelemetry preload and the image healthcheck script run before Nest and read their keys through `loadEnv`.
* Plugins and example plugins may not import `@nestjs/config` or `@northmes/sdk/config`, and `pnpm plugin:check` refuses such an import ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)). A plugin's behaviour comes from its settings ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)).
* Pure domain packages read no configuration at all ([ADR 0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md)).

### Other entry points and tests

* `northmes migrate` runs boot steps 1 to 10 without listening ([ADR 0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md)). In that mode `apps/server` validates `migrateEnvSchema`, the `secrets` namespace holds only the owner password, and step 5 runs as `nm_owner`. Providers that read keys or secrets the migrate schema lacks get the placeholders that `northmes schema print` uses; they construct no pool other than the owner's and send nothing.
* `northmes admin create` and `northmes admin reset-password` run in the one-off migrate container ([ADR 0011](0011-principals-credentials-and-same-origin-rules.md)) with `migrateEnvSchema`. Whether they also need the Better Auth secret, which [ADR 0047](0047-secrets-and-the-installation-key.md) gives only to `app`, is open (M-53 in [16 open questions](../plan/16-open-questions.md#design-points-from-the-plan-documents)).
* `northmes db bootstrap` runs without the Nest app and parses `bootstrapEnvSchema`: `DATABASE_URL`, `POSTGRES_PASSWORD_FILE` and the password file of each login role it creates.
* `northmes schema print` registers `ConfigModule` with a fixed placeholder record and placeholder secrets through `load`, with `validatePredefined: false`, `skipProcessEnv: true` and no `validate`. Providers that inject `ConfigService` or `secretsConfig.KEY` resolve, no pool is constructed, and `DATABASE_URL` stays unset ([ADR 0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md)).
* `@northmes/testing` exports `configForTest(overrides)`. It validates the record with the same `loadEnv` and registers the result through `load`, with `ignoreEnvFile: true`, `validatePredefined: false`, `skipProcessEnv: true` and no `validate`, so `forRoot` neither reads nor writes `process.env`. Two apps built in one Vitest process, as `createReplicas(2)` does, share no values ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)). The end-to-end fixture passes the environment, with `NODE_ENV=test`, to the spawned server.

### Consequences

* Good, because one schema validates the environment, types every read and generates the configuration reference.
* Good, because a bad value stops boot with every problem listed, before any manifest import.
* Good, because secret values stay out of `process.env`, so they do not reach child processes, `/proc/<pid>/environ` or a log line that dumps the environment. Plugin code still runs in the process with full access ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md)) and can reach the secrets, so this is not a plugin boundary.
* Good, because `ConfigService` is what Nest developers and coding agents already expect.
* Bad, because `@nestjs/config` brings dotenv and dotenv-expand, which NorthMES never uses because `ignoreEnvFile` is always true.
* Bad, because `ConfigService.get` takes string keys; the typed `ConfigService<ServerEnv, true>` with `infer` narrows that, but a rename still needs a search.
* Bad, because `migrate` and `schema print` need placeholder values for providers they never use.

### Confirmation

* `packages/sdk/test/config/server-env.test.ts`: a missing `NORTHMES_PUBLIC_ORIGIN` in production, `PORT` 70000 and `NORTHMES_ROLE` `web` give one `ConfigError` that lists all three keys and contains none of the values; `PORT` 0 is accepted; `NODE_ENV` defaults to `production` and `NORTHMES_ROLE` to `all`; an `http://127.0.0.1` origin passes with `NODE_ENV` `test` and fails with `production`; a set `BETTER_AUTH_TELEMETRY` fails.
* `packages/sdk/test/config/secrets.test.ts`: a missing file, an empty file and a file readable by others each fail naming the key; a 0440 file passes; one trailing newline is trimmed; a dev-marked secret with `NODE_ENV` `production` fails with `CONFIG_DEV_SECRET_IN_PRODUCTION`. This is the only test of the dev marker.
* `apps/server/test/boot/config.int.test.ts`: the built server with an invalid environment exits 1 before any manifest import, and stderr lists every bad key.
* `packages/testing/test/config-for-test.test.ts`: building two apps with `configForTest` leaves `process.env` unchanged.
* `apps/server/test/schema/print.int.test.ts` ([ADR 0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md)) still passes with `DATABASE_URL` unset.
* A lint test proves that `style/noProcessEnv` fires in `modules/*/server` and stays quiet in `packages/sdk/src/config`.
* `pnpm plugin:check` fails on an example plugin that imports `@nestjs/config`.
* The configuration reference generator test lists every key of the three schemas and every site-only key ([ADR 0048](0048-documentation-on-docs7-at-docs-northmes-dev.md)).
* The license gate passes `@nestjs/config` 12.0.1 (MIT) with dotenv (BSD-2-Clause), dotenv-expand 13.0.0 (BSD-2-Clause), es-toolkit (MIT) and `@standard-schema/spec` (MIT) ([ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md)).

## Pros and cons of the options

### @nestjs/config 12 with a Zod environment schema, a secrets namespace and a typed ConfigService

* Good, because version 12 validates with any Standard Schema, so the Zod schema plugs in directly.
* Good, because `registerAs` namespaces give typed injection for the secrets.
* Neutral, because NorthMES passes its own `validate` function instead of `validationSchema`, to control the error message.
* Bad, because of the unused dotenv dependencies.

### A plain provider with the parsed object

* Good, because it adds no dependency and the object is fully typed.
* Bad, because it is a NorthMES-only pattern where Nest already has one, and test overrides need their own helper.

### @nestjs/config with class-validator classes

* Good, because it is the older documented example.
* Bad, because it adds class-validator and class-transformer next to Zod, against [ADR 0017](0017-zod-contracts-as-the-single-source-for-inputs.md).
* Bad, because the configuration reference would need a second source.

## More information

* The earlier attempt's services used `@nestjs/config` with a Zod validate function per service. The `@nestjs/config` 12.0.0 sources show that `forRoot` runs `validate` when it is called, writes validated values into `process.env`, and creates `load` factories only at Nest create.
* Related ADRs: [0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md) boot sequence, [0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md) database roles, [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md) migrate, [0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md) Better Auth telemetry, [0011](0011-principals-credentials-and-same-origin-rules.md) public origin and admin commands, [0017](0017-zod-contracts-as-the-single-source-for-inputs.md) Zod, [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) settings, [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) plugin check, [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md) test fixtures, [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md) `northmes.env`, [0047](0047-secrets-and-the-installation-key.md) secrets per service, [0048](0048-documentation-on-docs7-at-docs-northmes-dev.md) configuration reference, [0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) stack script and dev secrets.
* Once this ADR is accepted, step 1 of the boot sequence in ADR 0002 also covers the environment, and the statement in ADRs 0022 and 0051 that environment variables hold "infrastructure settings and secrets" reads "infrastructure settings and the paths of secret files".
* Plan: [02 architecture](../plan/02-architecture.md) (boot sequence), [12 operations and security](../plan/12-operations-and-security.md) (`northmes.env` and secrets).
* Nest configuration documentation: https://docs.nestjs.com/application/configuration
* Revisit when a deployment target other than Compose needs another secret source, or when `@nestjs/config` changes its validation interface.
